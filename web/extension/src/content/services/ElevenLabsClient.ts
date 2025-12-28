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

    static async generateAudio(apiKey: string, voiceId: string, text: string): Promise<string> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('ElevenLabsClient.generateAudio', async (span) => {
            span.setAttribute('elevenlabs.voice_id', voiceId);
            span.setAttribute('elevenlabs.text_length', text.length);

            return new Promise<string>((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'GENERATE_AUDIO', apiKey, voiceId, text }, (response) => {
                    if (chrome.runtime.lastError) {
                        span.recordException(chrome.runtime.lastError.message || 'Unknown error');
                        span.setStatus({ code: SpanStatusCode.ERROR, message: chrome.runtime.lastError.message });
                        span.end();
                        return reject(chrome.runtime.lastError.message);
                    }
                    if (response && response.success) {
                        span.end();
                        resolve(response.audioData); // Data URL
                    } else {
                        const err = response?.error || 'Unknown error generating audio';
                        span.recordException(err);
                        span.setStatus({ code: SpanStatusCode.ERROR, message: err });
                        span.end();
                        reject(err);
                    }
                });
            });
        });
    }
}
