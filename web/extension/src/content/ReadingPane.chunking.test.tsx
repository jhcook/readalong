
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
jest.mock('./audio/AudioRecorder', () => ({
    AudioRecorder: jest.fn().mockImplementation(() => ({
        prepare: jest.fn().mockResolvedValue({}),
        startRecording: jest.fn(),
        stop: jest.fn(),
        isRecording: jest.fn().mockReturnValue(false)
    }))
}));

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
    runtime: {
        sendMessage: jest.fn((msg, cb) => {
            if (!cb) return;
            if (msg.type === 'PLAY_AUDIO') {
                cb({ success: false, error: "Force fallback" });
            } else if (msg.type === 'FETCH_AUDIO') {
                cb({ success: true, audioData: "data:audio/mp3;base64,mockdata" });
            } else if (msg.type === 'GENERATE_AUDIO') {
                cb({ success: true, audioId: 'mock-audio', alignment: {} });
            } else {
                cb({ success: true });
            }
        }),
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn()
        }
    }
};
(window as any).chrome = mockChrome;
(global as any).chrome = mockChrome;

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

// Mock Audio
const mockAudioInstances: any[] = [];
class MockAudio {
    src: string = '';
    currentTime: number = 0;
    playbackRate: number = 1;
    paused: boolean = true;
    error: any = null;

    _listeners: Record<string, Function[]> = {};

    constructor(src?: string) {
        if (src) this.src = src;
        mockAudioInstances.push(this);
    }

    play() {
        this.paused = false;
        // Trigger play event
        this._trigger('play');
        return Promise.resolve();
    }

    pause() {
        this.paused = true;
        this._trigger('pause');
    }

    addEventListener(event: string, handler: Function) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
    }

    removeEventListener(event: string, handler: Function) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(h => h !== handler);
        }
    }

    removeAttribute(attr: string) {
        if (attr === 'src') this.src = '';
    }

    load() { }

    // Helper to simulate events
    _trigger(event: string, data?: any) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(h => h(data || { target: this, currentTarget: this }));
        }
    }
}
(window as any).Audio = MockAudio;

describe('ReadingPane Chunked Playback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAudioInstances.length = 0;
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
        const sentence = "A".repeat(1000); // 1000 chars
        const text = `${sentence}. ${sentence}. ${sentence}.`;
        const alignmentMap = createMockAlignmentMap(text);

        await act(async () => {
            render(<ReadingPane alignmentMap={alignmentMap} onClose={() => { }} />);
        });

        // Click Read Aloud
        const readAloudBtn = screen.getByText('Read Aloud');
        await act(async () => {
            fireEvent.click(readAloudBtn);
        });

        // 1. Verify GENERATION called (Chunk 0 play triggers Chunk 1 prefetch)
        // With immediate prefetch, we get invocation for current AND next.
        await waitFor(() => {
            expect(ElevenLabsClient.generateAudio).toHaveBeenCalledTimes(2);
        });

        // Check argument was NOT full text, but approx 1/3 or 2/3 of it.
        const firstCallText = (ElevenLabsClient.generateAudio as jest.Mock).mock.calls[0][2];
        expect(firstCallText.length).toBeLessThan(text.length);
        expect(firstCallText).toContain(sentence);

        // 2. Simulate Audio Play (triggering prefetch)
        // Find mocked audio
        expect(mockAudioInstances.length).toBeGreaterThan(0);
        const audioInstance = mockAudioInstances[0];

        // Trigger play on instance
        await act(async () => {
            await audioInstance.play();
        });

        // 3. THIS IS THE KEY TEST:
        // onPlay of Chunk 0 should trigger PREFETCH of Chunk 1.
        // So generateAudio should be called a 2nd time.
        // But wait, my implementation triggers prefetch AFTER 'play' happens.
        // `ElevenLabsProvider.ts`:
        // await this.audio.play();
        // if (index + 1 < length) prefetchChunk(index+1);

        // Since play is stubbed as resolving promise immediately, it should trigger subsequent code.

        await waitFor(() => {
            expect(ElevenLabsClient.generateAudio).toHaveBeenCalledTimes(2);
        });

        // 4. Verify we do NOT fetch Chunk 2 yet (because Chunk 1 hasn't played).
        // Wait a bit to ensure no spurious calls.
        await new Promise(r => setTimeout(r, 100));
        expect(ElevenLabsClient.generateAudio).toHaveBeenCalledTimes(2);
    });
});
