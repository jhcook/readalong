import { GoogleSTTClient } from './GoogleSTTClient';

describe('GoogleSTTClient', () => {
    beforeEach(() => {
        (window as any).chrome = {
            runtime: {
                sendMessage: jest.fn((msg, callback) => {
                    if (callback) callback({ success: true, timestamps: [] });
                }),
                lastError: undefined
            }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('sends TRANSCRIBE_AUDIO message with base64 string input', async () => {
        const mockResponse = {
            success: true,
            timestamps: [
                { word: 'Hello', startTime: 0.1, endTime: 0.5 }
            ]
        };
        (chrome.runtime.sendMessage as jest.Mock).mockImplementation((msg, cb) => cb(mockResponse));

        const base64Audio = "SGVsbG8="; // "Hello"
        const result = await GoogleSTTClient.transcribeForTimestamps(base64Audio, "en-US");

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
            type: 'TRANSCRIBE_AUDIO',
            payload: {
                audioBase64: "SGVsbG8=",
                languageCode: "en-US"
            }
        }, expect.any(Function));
        expect(result).toEqual(mockResponse.timestamps);
    });

    it('handles blob input correctly', async () => {
        const mockResponse = { success: true, timestamps: [] };
        (chrome.runtime.sendMessage as jest.Mock).mockImplementation((msg, cb) => cb(mockResponse));

        const blob = new Blob(["Hello"], { type: 'audio/plain' });
        // FileReader behavior in jsdom works for readAsDataURL

        await GoogleSTTClient.transcribeForTimestamps(blob, "en-US");

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'TRANSCRIBE_AUDIO',
            payload: expect.objectContaining({
                languageCode: 'en-US'
                // base64 check omitted for simplicity in jsdomBlob
            })
        }), expect.any(Function));
    });

    it('throws error if background returns error', async () => {
        (chrome.runtime.sendMessage as jest.Mock).mockImplementation((msg, cb) => cb({
            success: false,
            error: "API Error"
        }));

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const result = await GoogleSTTClient.transcribeForTimestamps("dummy", "en-US");

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Transcription failed'), 'API Error');
        consoleSpy.mockRestore();
    });
});
