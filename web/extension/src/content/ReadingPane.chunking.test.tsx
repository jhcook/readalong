import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReadingPane from './ReadingPane';
import { ElevenLabsClient } from './services/ElevenLabsClient';
import { SttEngine } from './audio/SttEngine';
import { AudioRecorder } from './audio/AudioRecorder';

// Mock Dependencies
jest.mock('./services/ElevenLabsClient');
jest.mock('./audio/SttEngine');
jest.mock('./audio/AudioRecorder');

// Mock Chrome API
const mockChrome = {
    storage: {
        local: {
            get: jest.fn((keys, cb) => cb({
                elevenLabsApiKey: 'test-key',
                selectedVoiceId: 'voice-1',
                voiceSource: 'elevenlabs'
            })),
            set: jest.fn(),
        },
    },
};
(window as any).chrome = mockChrome;

// Mock window.speechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
    value: {
        getVoices: jest.fn(() => []),
        cancel: jest.fn(),
        speak: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
    },
    writable: true,
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:url');
global.URL.revokeObjectURL = jest.fn();

// Mock Audio Play
Object.defineProperty(global.window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    get() {
        return () => Promise.resolve();
    },
});

describe('ReadingPane Chunked Playback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (ElevenLabsClient.generateAudio as jest.Mock).mockResolvedValue({
            audioData: 'blob:audio-url',
            alignment: { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] }
        });
    });

    const createMockAlignmentMap = (text: string) => ({
        fullText: text,
        sentences: text.split('. ').map((s, i) => ({
            text: s,
            index: i,
            words: s.split(' ').map((w, wi) => ({ text: w, index: wi }))
        }))
    });

    test('Cost Conscious Playback: Fetches only as needed', async () => {
        // Create text long enough to split into 3 chunks (Chunk limit default 2500)
        // We mock ChunkManager behaviour or just rely on its implementation. 
        // Let's rely on real ChunkManager logic but with long text.
        const sentence = "A".repeat(1000); // 1000 chars
        // 3 sentences = 3000 chars. Should result in 2 chunks? (Limit 2500)
        // Chunk 1: S1 (1000) + S2 (1000) = 2000. 
        // Chunk 2: S3 (1000).
        const text = `${sentence}. ${sentence}. ${sentence}.`;
        const alignmentMap = createMockAlignmentMap(text);

        await act(async () => {
            render(<ReadingPane alignmentMap={alignmentMap} onClose={() => { }} />);
        });

        // Open settings/ensure keys loaded (mock handles this)

        // Click Read Aloud
        const readAloudBtn = screen.getByText('Read Aloud');
        await act(async () => {
            fireEvent.click(readAloudBtn);
        });

        // 1. Verify GENERATION called for Chunk 0 immediately
        await waitFor(() => {
            expect(ElevenLabsClient.generateAudio).toHaveBeenCalledTimes(1);
        });
        // Check argument was NOT full text, but approx 1/3 or 2/3 of it.
        const firstCallText = (ElevenLabsClient.generateAudio as jest.Mock).mock.calls[0][2];
        expect(firstCallText.length).toBeLessThan(text.length);
        expect(firstCallText).toContain(sentence);

        // 2. Simulate Audio Play (onPlay event)
        // We need to find the hidden audio element.
        // Logic: setActiveAudioUrl -> renders <audio src="...">
        const audioEl = document.querySelector('audio');
        expect(audioEl).toBeInTheDocument();

        // Trigger onPlay to simulate user actually listening
        await act(async () => {
            fireEvent.play(audioEl!);
        });

        // 3. THIS IS THE KEY TEST:
        // onPlay of Chunk 0 should trigger PREFETCH of Chunk 1.
        // So generateAudio should be called a 2nd time.
        await waitFor(() => {
            expect(ElevenLabsClient.generateAudio).toHaveBeenCalledTimes(2);
        });

        // 4. Verify we do NOT fetch Chunk 2 yet (because Chunk 1 hasn't played).
        // Wait a bit to ensure no spurious calls.
        await new Promise(r => setTimeout(r, 100));
        expect(ElevenLabsClient.generateAudio).toHaveBeenCalledTimes(2);
    });
});
