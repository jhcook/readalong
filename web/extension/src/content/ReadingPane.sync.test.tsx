
import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import ReadingPane from './ReadingPane';
import { AlignmentMap } from './types';
import { ElevenLabsClient } from './services/ElevenLabsClient';

// Mock dependencies
jest.mock('./audio/AudioRecorder', () => ({
    AudioRecorder: jest.fn().mockImplementation(() => ({
        prepare: jest.fn().mockResolvedValue({}),
        startRecording: jest.fn(),
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
        getVoices: jest.fn(() => Promise.resolve([])),
        generateAudio: jest.fn()
    }
}));

jest.mock('./services/GoogleClient', () => ({
    GoogleClient: {
        getVoices: jest.fn(() => Promise.resolve([])),
        generateAudio: jest.fn()
    }
}));

jest.mock('./services/ResembleClient', () => ({
    ResembleClient: {
        getVoices: jest.fn(() => Promise.resolve([])),
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
const mockGetVoices = jest.fn().mockReturnValue([{ name: 'System Voice', lang: 'en-US', voiceURI: 'system-us' }]);

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
        jest.spyOn(console, 'error').mockImplementation(() => { });

        // Force mock return values to be safe
        const { GoogleClient } = require('./services/GoogleClient');
        if (GoogleClient.getVoices.mockReturnValue) {
            GoogleClient.getVoices.mockReturnValue(Promise.resolve([]));
        }

        const { ResembleClient } = require('./services/ResembleClient');
        if (ResembleClient.getVoices.mockReturnValue) {
            ResembleClient.getVoices.mockReturnValue(Promise.resolve([]));
        }

        mockAudioInstances.length = 0;
        // Reset chrome mock
        const mockChrome = {
            storage: {
                local: {
                    get: jest.fn((keys, cb) => cb({})),
                    set: jest.fn()
                }
            },
            runtime: {
                sendMessage: jest.fn((msg, cb) => {
                    if (!cb) return;

                    if (msg.type === 'PLAY_AUDIO') {
                        // Simulate failure to force fallback
                        cb({ success: false, error: "Force fallback" });
                    } else if (msg.type === 'FETCH_AUDIO') {
                        // Return dummy base64
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
        (global as any).chrome = mockChrome;
        (window as any).chrome = mockChrome;

        // Mock scrollIntoView
        HTMLElement.prototype.scrollIntoView = jest.fn();
    });

    it('Syncs TTS highlighting using onboundary events', async () => {
        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        const ttsButton = screen.getByTitle('Read Aloud');
        act(() => {
            ttsButton.click();
        });

        // Wait for voices to load and init
        await waitFor(() => {
            expect(mockSpeak).toHaveBeenCalled();
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
            }
        });

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        const ttsButton = await screen.findByTitle('Read Aloud'); // Wait for initial render

        await act(async () => {
            ttsButton.click();
        });

        await waitFor(() => {
            expect(ElevenLabsClient.generateAudio).toHaveBeenCalled();
        });

        // Find captured audio instance
        expect(mockAudioInstances.length).toBeGreaterThan(0);
        const audioInstance = mockAudioInstances[0];

        // Simulate time update on the Audio element
        // Time 0.1 -> 'H' -> Index 0 ("Hello")
        act(() => {
            audioInstance.currentTime = 0.15;
            audioInstance._trigger('timeupdate');
        });

        expect(screen.getByText('Hello')).toHaveClass('active');
        expect(screen.getByText('world')).not.toHaveClass('active');

        // Time 0.8 -> 'o' (in world) -> Index 1 ("world")
        act(() => {
            audioInstance.currentTime = 0.85;
            audioInstance._trigger('timeupdate');
        });

        expect(screen.getByText('world')).toHaveClass('active');
        expect(screen.getByText('Hello')).not.toHaveClass('active');
    });
});
