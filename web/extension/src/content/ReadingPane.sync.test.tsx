import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import ReadingPane from './ReadingPane';
import { AlignmentMap } from './types';
import { ElevenLabsClient } from './services/ElevenLabsClient';

// Mock dependencies
jest.mock('./audio/AudioRecorder', () => ({
    AudioRecorder: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        isRecording: jest.fn().mockReturnValue(false)
    }))
}));

jest.mock('./audio/SttEngine', () => ({
    SttEngine: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn()
    }))
}));

jest.mock('./alignment/Aligner', () => ({
    Aligner: jest.fn().mockImplementation(() => ({
        align: jest.fn().mockReturnValue(-1),
        reset: jest.fn()
    }))
}));

jest.mock('./services/ElevenLabsClient', () => ({
    ElevenLabsClient: {
        getVoices: jest.fn(),
        generateAudio: jest.fn()
    }
}));

// Mock URL
global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock SpeechSynthesis
const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockResume = jest.fn();
const mockPause = jest.fn();
const mockGetVoices = jest.fn().mockReturnValue([{ name: 'Google US English', lang: 'en-US', voiceURI: 'google-us' }]);

Object.defineProperty(window, 'speechSynthesis', {
    value: {
        speak: mockSpeak,
        cancel: mockCancel,
        resume: mockResume,
        pause: mockPause,
        getVoices: mockGetVoices,
        paused: false,
        speaking: false,
        pending: false,
        onvoiceschanged: null
    },
    writable: true,
});

// Mock SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
    text: string;
    voice: any;
    onboundary: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    onerror: ((event: any) => void) | null = null;

    constructor(text: string) {
        this.text = text;
    }
}
global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;

const mockAlignmentMap: AlignmentMap = {
    fullText: "Hello world",
    sentences: [
        {
            text: "Hello world",
            index: 0,
            words: [
                { text: "Hello", index: 0, start: 0, end: 1 },
                { text: "world", index: 1, start: 1, end: 2 }
            ]
        }
    ]
};

describe('ReadingPane Synchronization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset chrome mock
        (global as any).chrome = {
            storage: {
                local: {
                    get: jest.fn((keys, cb) => cb({})),
                    set: jest.fn()
                }
            },
            runtime: {
                sendMessage: jest.fn()
            }
        };
    });

    it('Syncs TTS highlighting using onboundary events', async () => {
        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        const ttsButton = screen.getByTitle('Read Aloud');
        act(() => {
            ttsButton.click();
        });

        const utterance = (mockSpeak.mock.calls[0][0] as MockSpeechSynthesisUtterance);

        // Simulate start
        act(() => {
            if (utterance.onstart) utterance.onstart();
        });

        // Verify initial state
        const helloWord = screen.getByText('Hello');
        expect(helloWord).toHaveClass('active');

        // Simulate boundary event for "world" (index 6 chars in "Hello world")
        act(() => {
            if (utterance.onboundary) {
                utterance.onboundary({ name: 'word', charIndex: 6 } as any);
            }
        });

        const worldWord = screen.getByText('world');
        expect(worldWord).toHaveClass('active');
        expect(helloWord).not.toHaveClass('active');
    });

    it('Syncs ElevenLabs highlighting using alignment data', async () => {
        // Setup ElevenLabs settings
        (global as any).chrome.storage.local.get = jest.fn((keys, cb) => {
            cb({
                voiceSource: 'elevenlabs',
                elevenLabsApiKey: 'test-key',
                selectedVoiceId: 'voice-123'
            });
        });

        // Mock generateAudio response with alignment
        (ElevenLabsClient.generateAudio as jest.Mock).mockResolvedValue({
            audioData: 'data:audio/mp3;base64,...',
            alignment: {
                characters: ['H', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd'],
                character_start_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
                character_end_times_seconds: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2]
            }
        });

        // Create a mock Audio element
        const pauseStub = jest.fn();
        const playStub = jest.fn().mockResolvedValue(undefined);

        /* eslint-disable-next-line */
        window.HTMLMediaElement.prototype.play = playStub;
        window.HTMLMediaElement.prototype.pause = pauseStub;

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        // Open settings (to trigger setting usage if needed, though we mocked storage)

        const ttsButton = await screen.findByTitle('Read Aloud'); // Wait for initial render

        await act(async () => {
            ttsButton.click();
        });

        expect(ElevenLabsClient.generateAudio).toHaveBeenCalled();

        // Simulate time update on the Audio element
        // Since the Audio element is rendered conditionally *after* audio is set, we need to find it.
        // It's hidden, so getByRole might not find it easily, but we can querySelector.

        const audioElement = document.querySelector('audio');
        expect(audioElement).toBeInTheDocument();

        // Time 0.1 -> 'H' -> Index 0 ("Hello")
        act(() => {
            fireEvent.timeUpdate(audioElement!, { target: { currentTime: 0.15 } });
        });

        expect(screen.getByText('Hello')).toHaveClass('active');
        expect(screen.getByText('world')).not.toHaveClass('active');

        // Time 0.8 -> 'o' (in world) -> Index 1 ("world")
        act(() => {
            fireEvent.timeUpdate(audioElement!, { target: { currentTime: 0.85 } });
        });

        expect(screen.getByText('world')).toHaveClass('active');
        expect(screen.getByText('Hello')).not.toHaveClass('active');
    });
});
