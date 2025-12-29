import { trace, SpanStatusCode } from '@opentelemetry/api';
// PREFLIGHT HINT: tracer startActiveSpan opentelemetry trace.getTracer

export interface Voice {
    voice_id: string;
    name: string;
    preview_url?: string;
    labels?: Record<string, string>;
}

export class ElevenLabsClient {

    static async getVoices(apiKey: string): Promise<Voice[]> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('ElevenLabsClient.getVoices', async (span) => {
            return new Promise<Voice[]>((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'FETCH_VOICES', apiKey }, (response) => {
                    if (chrome.runtime.lastError) {
                        span.recordException(chrome.runtime.lastError.message || 'Unknown error');
                        span.setStatus({ code: SpanStatusCode.ERROR, message: chrome.runtime.lastError.message });
                        span.end();
                        return reject(chrome.runtime.lastError.message);
                    }
                    if (response && response.success) {
                        span.end();
                        resolve(response.voices);
                    } else {
                        const err = response?.error || 'Unknown error fetching voices';
                        span.recordException(err);
                        span.setStatus({ code: SpanStatusCode.ERROR, message: err });
                        span.end();
                        reject(err);
                    }
                });
            });
        });
    }

    private static async sendMessageWithRetry(message: any, retries = 3): Promise<any> {
        for (let i = 0; i < retries; i++) {
            try {
                return await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(message, (response) => {
                        const lastError = chrome.runtime.lastError;
                        if (lastError) {
                            console.warn(`[ElevenLabsClient] Runtime error during sendMessage (attempt ${i + 1}):`, lastError.message);
                            reject(new Error(lastError.message || 'Unknown runtime error'));
                            return;
                        }
                        if (response === undefined) {
                            // This often happens if the background script crashed or didn't send a response
                            console.warn(`[ElevenLabsClient] Undefined response (attempt ${i + 1})`);
                            reject(new Error("Undefined response from background script"));
                            return;
                        }
                        resolve(response);
                    });
                });
            } catch (e) {
                if (i === retries - 1) throw e;
                console.warn(`[ElevenLabsClient] Retrying message (attempt ${i + 1})`, e);
                await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
            }
        }
    }

    static async generateAudio(apiKey: string, voiceId: string, text: string): Promise<{ audioId: string, alignment?: any }> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('ElevenLabsClient.generateAudio', async (span) => {
            span.setAttribute('elevenlabs.voice_id', voiceId);
            span.setAttribute('elevenlabs.text_length', text.length);

            try {
                const response = await this.sendMessageWithRetry({ type: 'GENERATE_AUDIO', apiKey, voiceId, text });

                if (response && response.success) {
                    span.end();
                    return { audioId: response.audioId, alignment: response.alignment };
                } else {
                    const err = response?.error || 'Unknown error generating audio';
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: err });
                    span.end();
                    throw new Error(err);
                }
            } catch (err: any) {
                span.recordException(err);
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
                span.end();
                throw err;
            }
        });
    }

    static async fetchAudio(audioId: string): Promise<string> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('ElevenLabsClient.fetchAudio', async (span) => {
            try {
                const response = await this.sendMessageWithRetry({ type: 'FETCH_AUDIO', audioId });

                if (response && response.success) {
                    span.end();
                    return response.audioData;
                } else {
                    const err = response?.error || 'Unknown error fetching audio';
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: err });
                    span.end();
                    throw new Error(err);
                }
            } catch (err: any) {
                span.recordException(err);
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
                span.end();
                throw err;
            }
        });
    }
}
