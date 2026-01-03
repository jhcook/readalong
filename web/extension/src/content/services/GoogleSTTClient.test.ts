import { GoogleSTTClient } from './GoogleSTTClient';

describe('GoogleSTTClient', () => {
    let mockPort: any;

    beforeEach(() => {
        mockPort = {
            name: 'stt_channel',
            postMessage: jest.fn(),
            disconnect: jest.fn(),
            onMessage: {
                addListener: jest.fn(),
                removeListener: jest.fn()
            },
            onDisconnect: {
                addListener: jest.fn(),
                removeListener: jest.fn()
            }
        };

        (window as any).chrome = {
            runtime: {
                connect: jest.fn().mockReturnValue(mockPort),
                lastError: undefined
            }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('opens persistent port and sends TRANSCRIBE_AUDIO message', async () => {
        const mockResponse = {
            success: true,
            timestamps: [
                { word: 'Hello', startTime: 0.1, endTime: 0.5 }
            ]
        };

        // Mock postMessage to trigger the onMessage listener with success
        mockPort.postMessage.mockImplementation(() => {
            const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0][0];
            onMessageCallback(mockResponse);
        });

        const base64Audio = "SGVsbG8="; // "Hello"
        const result = await GoogleSTTClient.transcribeForTimestamps(base64Audio, "en-US");

        expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'stt_channel' });
        expect(mockPort.postMessage).toHaveBeenCalledWith({
            type: 'TRANSCRIBE_AUDIO',
            payload: {
                audioBase64: "SGVsbG8=",
                languageCode: "en-US"
            }
        });
        expect(result).toEqual(mockResponse.timestamps);
        expect(mockPort.disconnect).toHaveBeenCalled();
    });

    it('handles blob input correctly', async () => {
        const mockResponse = { success: true, timestamps: [] };

        mockPort.postMessage.mockImplementation(() => {
            const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0][0];
            onMessageCallback(mockResponse);
        });

        const blob = new Blob(["Hello"], { type: 'audio/plain' });

        await GoogleSTTClient.transcribeForTimestamps(blob, "en-US");

        expect(mockPort.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'TRANSCRIBE_AUDIO',
            payload: expect.objectContaining({
                languageCode: 'en-US'
            })
        }));
    });

    it('returns empty array if background reports error via message', async () => {
        mockPort.postMessage.mockImplementation(() => {
            const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0][0];
            onMessageCallback({ success: false, error: "API Failure" });
        });

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const result = await GoogleSTTClient.transcribeForTimestamps("dummy", "en-US");

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('STT Error'), 'API Failure');
        consoleSpy.mockRestore();
    });

    it('handles unexpected port disconnection', async () => {
        mockPort.postMessage.mockImplementation(() => {
            // Do NOT call onMessage. Call onDisconnect instead.
            const onDisconnectCallback = mockPort.onDisconnect.addListener.mock.calls[0][0];
            onDisconnectCallback();
        });

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const result = await GoogleSTTClient.transcribeForTimestamps("dummy", "en-US");

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Port disconnected unexpectedly'));
        consoleSpy.mockRestore();
    });
});
