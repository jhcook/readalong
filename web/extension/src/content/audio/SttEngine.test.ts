import { SttEngine } from './SttEngine';
import { createModel } from 'vosk-browser';

// Mock vosk-browser
jest.mock('vosk-browser', () => ({
    createModel: jest.fn(),
}));

// Mock AudioContext and related
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockAddModule = jest.fn();
const mockClose = jest.fn();

class MockAudioWorkletNode {
    port = {
        onmessage: null,
        postMessage: jest.fn(),
    };
    connect = mockConnect;
    disconnect = mockDisconnect;
}

class MockMediaStreamAudioSourceNode {
    connect = mockConnect;
    disconnect = mockDisconnect;
}

global.AudioWorkletNode = MockAudioWorkletNode as any;

const MockAudioContext = jest.fn().mockImplementation(() => ({
    audioWorklet: {
        addModule: mockAddModule,
    },
    createMediaStreamSource: jest.fn(() => new MockMediaStreamAudioSourceNode()),
    destination: {},
    close: mockClose,
}));

global.AudioContext = MockAudioContext as any;
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    clone: jest.fn(),
    blob: jest.fn().mockResolvedValue(new Blob([])),
}) as any;

if (typeof URL.createObjectURL === 'undefined') {
    Object.defineProperty(URL, 'createObjectURL', { value: jest.fn() });
} else {
    URL.createObjectURL = jest.fn();
}

const mockCache = {
    match: jest.fn(),
    put: jest.fn(),
};

global.caches = {
    open: jest.fn().mockResolvedValue(mockCache),
} as any;

describe('SttEngine', () => {
    let engine: SttEngine;

    beforeEach(() => {
        engine = new SttEngine();
        (createModel as jest.Mock).mockResolvedValue({
            KaldiRecognizer: jest.fn().mockImplementation(() => ({
                setWords: jest.fn(),
                on: jest.fn(),
                acceptWaveform: jest.fn(),
                remove: jest.fn(),
            })),
            terminate: jest.fn(),
        });

        // Mock chrome.runtime.getURL
        global.chrome = {
            runtime: {
                getURL: jest.fn((path) => path),
            },
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize successfully', async () => {
        await engine.initialize();
        expect(createModel).toHaveBeenCalled();
    });

    it('should start audio processing', async () => {
        const stream = {} as MediaStream;
        await engine.start(stream);
        expect(mockAddModule).toHaveBeenCalledWith('audio-processor.js');
        expect(global.AudioContext).toHaveBeenCalled();
    });

    it('should stop audio processing', async () => {
        const stream = {} as MediaStream;
        await engine.start(stream);
        engine.stop();
        expect(mockDisconnect).toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
    });
});
