import { SttEngine } from './SttEngine';

// Mock AudioContext and related
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockAddModule = jest.fn();
const mockClose = jest.fn();

class MockAudioWorkletNode {
    port = {
        onmessage: null as ((event: any) => void) | null,
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
    sampleRate: 44100,
    destination: {},
    close: mockClose,
}));

global.AudioContext = MockAudioContext as any;

describe('SttEngine', () => {
    let engine: SttEngine;
    let originalCreateElement: any;
    let originalAddEventListener: any;
    let originalRemoveEventListener: any;
    let messageHandler: ((event: any) => void) | null = null;
    let capturedIframe: HTMLIFrameElement | null = null;
    let mockPostMessage: jest.Mock;

    beforeEach(() => {
        engine = new SttEngine();
        mockPostMessage = jest.fn();
        capturedIframe = null;

        // Spy on createElement
        originalCreateElement = document.createElement;
        jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
            const el = originalCreateElement.call(document, tagName, options);
            if (tagName === 'iframe') {
                capturedIframe = el as HTMLIFrameElement;
                // Mock contentWindow
                Object.defineProperty(el, 'contentWindow', {
                    value: {
                        postMessage: mockPostMessage,
                    },
                    writable: true
                });
            }
            return el;
        });

        // Spy on window.addEventListener
        originalAddEventListener = window.addEventListener;
        jest.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
            if (type === 'message') {
                messageHandler = handler as any;
            }
        });

        originalRemoveEventListener = window.removeEventListener;
        jest.spyOn(window, 'removeEventListener').mockImplementation((type, handler) => {
            if (type === 'message' && handler === messageHandler) {
                messageHandler = null;
            }
        });

        // Mock chrome.runtime.getURL
        global.chrome = {
            runtime: {
                getURL: jest.fn((path) => path),
            },
        } as any;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        mockPostMessage.mockClear();
        mockConnect.mockClear();
        mockDisconnect.mockClear();
        mockClose.mockClear();
        if (capturedIframe && capturedIframe.parentNode) {
            capturedIframe.parentNode.removeChild(capturedIframe);
        }
    });

    const triggerIframeLoad = () => {
        if (capturedIframe) {
            // SttEngine sets direct .onload property
            if (capturedIframe.onload) {
                (capturedIframe.onload as any)(new Event('load'));
            }
        }
    };

    it('should initialize successfully (create iframe)', async () => {
        const initPromise = engine.initialize();

        // Wait for microtask or force sync? SttEngine awaits generic Promise around onload.
        // We need to trigger onload.
        setTimeout(triggerIframeLoad, 0);

        await initPromise;

        expect(document.createElement).toHaveBeenCalledWith('iframe');
        expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'INITIALIZE'
        }), '*');
    });

    it('should start audio processing and forward audio to sandbox', async () => {
        const stream = {} as MediaStream;

        const initPromise = engine.initialize();
        setTimeout(triggerIframeLoad, 0);
        await initPromise;
        mockPostMessage.mockClear();

        await engine.start(stream);

        expect(mockAddModule).toHaveBeenCalledWith('audio-processor.js');
        expect(global.AudioContext).toHaveBeenCalled();

        // Trigger onmessage on worklet node
        const workletNode = (engine as any).workletNode;
        expect(workletNode).toBeDefined();

        const float32Data = new Float32Array([0.1, 0.2, 0.3]);
        workletNode.port.onmessage({ data: float32Data });

        expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'PROCESS_AUDIO',
            data: float32Data
        }), '*');
    });

    it('should dispatch stt-result event on message from sandbox', async () => {
        const initPromise = engine.initialize();
        setTimeout(triggerIframeLoad, 0);
        await initPromise;

        const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

        if (messageHandler && capturedIframe) {
            messageHandler({
                source: capturedIframe.contentWindow,
                data: {
                    type: 'STT_RESULT',
                    result: { text: 'hello world' }
                }
            });
        }

        expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
        const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
        expect(event.type).toBe('stt-result');
        expect(event.detail).toEqual({ text: 'hello world' });
    });

    it('should stop audio processing', async () => {
        const stream = {} as MediaStream;
        const initPromise = engine.initialize();
        setTimeout(triggerIframeLoad, 0);
        await initPromise;

        await engine.start(stream);
        engine.stop();

        expect(mockDisconnect).toHaveBeenCalled();
        expect(mockClose).toHaveBeenCalled();
    });
});
