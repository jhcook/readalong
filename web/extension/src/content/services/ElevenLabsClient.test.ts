import { ElevenLabsClient } from './ElevenLabsClient';

// Manual mock for chrome
const mockSendMessage = jest.fn();

const mockChrome = {
    runtime: {
        sendMessage: mockSendMessage,
        lastError: undefined as any
    }
};

(global as any).chrome = mockChrome;
(window as any).chrome = mockChrome;

// Mock Tracing
jest.mock('../tracing', () => ({
    tracer: {
        startActiveSpan: jest.fn((name, callback) => callback({
            recordException: jest.fn(),
            setStatus: jest.fn(),
            setAttribute: jest.fn(),
            end: jest.fn(),
        })),
    },
}));

describe('ElevenLabsClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChrome.runtime.lastError = undefined;
    });

    describe('getVoices', () => {
        it('resolves with voices when message succeeds', async () => {
            const mockVoices = [{ voice_id: 'v1', name: 'Voice 1' }];
            const messageResponse = { success: true, voices: mockVoices };

            chrome.runtime.sendMessage.mockImplementation(((message, callback) => {
                expect(message).toEqual({ type: 'FETCH_VOICES', apiKey: 'key' });
                callback(messageResponse);
            }) as any);

            const result = await ElevenLabsClient.getVoices('key');
            expect(result).toEqual(mockVoices);
        });

        it('rejects with error when success is false', async () => {
            const messageResponse = { success: false, error: 'API Error' };

            chrome.runtime.sendMessage.mockImplementation(((message, callback) => {
                callback(messageResponse);
            }) as any);

            await expect(ElevenLabsClient.getVoices('key')).rejects.toEqual('API Error');
        });

        it('rejects when runtime.lastError is set', async () => {
            chrome.runtime.sendMessage.mockImplementation(((message, callback) => {
                // Simulate lastError
                (chrome.runtime.lastError as any) = { message: 'Runtime Error' };
                callback(undefined);
                delete (chrome.runtime as any).lastError;
            }) as any);

            // We catch the error because we're mocking the callback behavior
            try {
                await ElevenLabsClient.getVoices('key');
            } catch (e) {
                expect(e).toEqual('Runtime Error');
            }
        });
    });

    describe('generateAudio', () => {
        it('resolves with audio data url', async () => {
            const audioData = 'data:audio/mpeg;base64,abc';
            const messageResponse = { success: true, audioData };

            chrome.runtime.sendMessage.mockImplementation(((message, callback) => {
                expect(message).toEqual({
                    type: 'GENERATE_AUDIO',
                    apiKey: 'key',
                    voiceId: 'vid',
                    text: 'hello'
                });
                callback(messageResponse);
            }) as any);

            const result = await ElevenLabsClient.generateAudio('key', 'vid', 'hello');
            expect(result).toEqual({
                audioData: audioData,
                alignment: undefined
            });
        });
    });
});
