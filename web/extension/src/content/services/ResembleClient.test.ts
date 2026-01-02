
import { ResembleClient } from './ResembleClient';

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
// Note: We need to ensure @opentelemetry/api is mocked or accessible
jest.mock('@opentelemetry/api', () => ({
    trace: {
        getTracer: jest.fn(() => ({
            startActiveSpan: jest.fn((name, callback) => callback({
                recordException: jest.fn(),
                setStatus: jest.fn(),
                setAttribute: jest.fn(),
                end: jest.fn(),
            })),
        })),
    },
    SpanStatusCode: {
        ERROR: 2
    }
}));

describe('ResembleClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChrome.runtime.lastError = undefined;
    });

    describe('getVoices', () => {
        it('resolves with voices when message succeeds', async () => {
            const mockVoices = [{ uuid: 'v1', name: 'Voice 1', project_uuid: 'p1' }];
            const messageResponse = { success: true, voices: mockVoices };

            mockSendMessage.mockImplementation(((message, callback) => {
                expect(message).toEqual({ type: 'FETCH_RESEMBLE_VOICES', apiKey: 'key' });
                callback(messageResponse);
            }) as any);

            const result = await ResembleClient.getVoices('key');
            expect(result).toEqual(mockVoices);
        });

        it('rejects with error when success is false', async () => {
            const messageResponse = { success: false, error: 'API Error' };

            mockSendMessage.mockImplementation(((message, callback) => {
                callback(messageResponse);
            }) as any);

            await expect(ResembleClient.getVoices('key')).rejects.toEqual('API Error');
        });
    });

    describe('generateAudio', () => {
        it('resolves with audio id', async () => {
            const audioId = 'abcd-1234';
            const alignment = { graph_times: [] };
            const messageResponse = { success: true, audioId, alignment };

            mockSendMessage.mockImplementation(((message, callback) => {
                expect(message).toEqual({
                    type: 'GENERATE_RESEMBLE_AUDIO',
                    apiKey: 'key',
                    voiceUuid: 'vid',
                    projectUuid: 'pid',
                    text: 'hello'
                });
                callback(messageResponse);
            }) as any);

            const result = await ResembleClient.generateAudio('key', 'vid', 'pid', 'hello');
            expect(result).toEqual({
                audioId: audioId,
                alignment: alignment
            });
        });
    });
});
