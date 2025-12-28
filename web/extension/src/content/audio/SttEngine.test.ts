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

const mockCreateBuffer = jest.fn().mockImplementation((channels, length, sampleRate) => ({
    copyToChannel: jest.fn(),
    numberOfChannels: channels,
    length: length,
    sampleRate: sampleRate,
    getChannelData: jest.fn(), // If needed by other tests
}));

const MockAudioContext = jest.fn().mockImplementation(() => ({
    audioWorklet: {
        addModule: mockAddModule,
    },
    createMediaStreamSource: jest.fn(() => new MockMediaStreamAudioSourceNode()),
    createBuffer: mockCreateBuffer,
    sampleRate: 44100,
    destination: {},
    close: mockClose,
    // ...
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
    let mockAcceptWaveform: jest.Mock;
    let mockAcceptWaveformFloat: jest.Mock;

    beforeEach(() => {
        engine = new SttEngine();
        mockAcceptWaveform = jest.fn();
        mockAcceptWaveformFloat = jest.fn();
        (createModel as jest.Mock).mockResolvedValue({
            KaldiRecognizer: jest.fn().mockImplementation(() => ({
                setWords: jest.fn(),
                on: jest.fn(),
                acceptWaveform: mockAcceptWaveform,
                acceptWaveformFloat: mockAcceptWaveformFloat,
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

    it('should initialize successfully (model only)', async () => {
        await engine.initialize();
        expect(createModel).toHaveBeenCalled();
        // Recognizer is not created yet
        const model = await createModel('');
        expect(model.KaldiRecognizer).not.toHaveBeenCalled();
    });

    it('should start audio processing and create recognizer with correct sample rate', async () => {
        const stream = {} as MediaStream;
        await engine.start(stream);
        expect(mockAddModule).toHaveBeenCalledWith('audio-processor.js');
        expect(global.AudioContext).toHaveBeenCalled();

        // Verify recognizer creation with correct sample rate (44100 from mock)
        const model = await createModel('');
        expect(model.KaldiRecognizer).toHaveBeenCalledWith(44100);
    });

    it('should handle audio data from worklet', async () => {
        const stream = {} as MediaStream;
        await engine.start(stream);

        // Access the worklet node that was created
        // We can't access private property easily, but we know usage.
        // We know SttEngine sets onmessage.
        // But in our mock, we need to trigger it.
        // The MockAudioWorkletNode is instantiated inside start().
        // We need to capture the instance or just the onmessage handler.
        // Since AudioWorkletNode is mocked globally, we can spy on it or its instances?
        // Actually, we can just grab the getLastInstance if we had a way, or...
        // Wait, SttEngine creates `this.workletNode`. It assigns `this.workletNode.port.onmessage`.
        // Our MockAudioWorkletNode has `port = { onmessage: null ... }`.

        // Let's use a spy on AudioWorkletNode constructor to get the instance?
        // Or simpler: verify mockCreateBuffer implies flow worked?

        // We need to simulate the message event.
        // Using a spy on the constructor is cleaner maybe?

        // Better yet:
        // We can inspect the implementation of SttEngine to see it assigns onmessage.
        // But SttEngine is the SUT (System Under Test).

        // Let's modify the Global MockAudioWorkletNode to store instances we can access in test?
        // Or simpler: we can't easily access the private `workletNode` property of `engine`.
        // But we can cast engine to any.

        const workletNode = (engine as any).workletNode;
        expect(workletNode).toBeDefined();
        expect(workletNode.port.onmessage).toBeDefined();

        const float32Data = new Float32Array([0.1, 0.2, 0.3]);
        workletNode.port.onmessage({ data: float32Data });


        expect(mockAcceptWaveform).toHaveBeenCalledWith(expect.objectContaining({
            sampleRate: 44100,
            length: float32Data.length,
            numberOfChannels: 1,
            copyToChannel: expect.any(Function),
        }));
    });

    it('should stop audio processing', async () => {
        const stream = {} as MediaStream;
        await engine.start(stream);
        engine.stop();
        expect(mockDisconnect).toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
    });
});
