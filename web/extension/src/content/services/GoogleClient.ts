
import { trace, SpanStatusCode } from '@opentelemetry/api';

export interface GoogleVoice {
    name: string;
    languageCodes: string[];
    ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
    naturalSampleRateHertz: number;
}

export class GoogleClient {

    static async getVoices(apiKey: string): Promise<GoogleVoice[]> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('GoogleClient.getVoices', async (span) => {
            return new Promise<GoogleVoice[]>((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'FETCH_GOOGLE_VOICES', apiKey }, (response) => {
                    if (chrome.runtime.lastError) {
                        span.recordException(chrome.runtime.lastError.message || 'Unknown error');
                        span.setStatus({ code: SpanStatusCode.ERROR, message: chrome.runtime.lastError.message });
                        span.end();
                        return reject(chrome.runtime.lastError.message);
                    }
                    if (response && response.success) {
                        span.end();
                        resolve((response as { success: boolean; voices: GoogleVoice[] }).voices);
                    } else {
                        const err = response?.error || 'Unknown error fetching google voices';
                        span.recordException(err);
                        span.setStatus({ code: SpanStatusCode.ERROR, message: err });
                        span.end();
                        reject(err);
                    }
                });
            });
        });
    }

    static async generateAudio(apiKey: string, textSsml: string, voiceId: string, languageCode: string, ssmlGender: string): Promise<{ audioId: string, timepoints: any[] }> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('GoogleClient.generateAudio', async (span) => {
            span.setAttribute('google.voice_id', voiceId);
            span.setAttribute('google.ssml_length', textSsml.length);

            try {
                return new Promise<{ audioId: string; timepoints: any[] }>((resolve, reject) => {
                    const message = {
                        type: 'GENERATE_GOOGLE_AUDIO',
                        apiKey,
                        text: textSsml,
                        voiceId,
                        languageCode,
                        ssmlGender
                    };
                    chrome.runtime.sendMessage(message, (response) => {
                        const lastError = chrome.runtime.lastError;
                        if (lastError) {
                            // Original code had `reject(chrome.runtime.lastError.message); return;`
                            // This new block provides more detailed error handling similar to the user's provided snippet.
                            span.recordException(lastError.message || 'Unknown runtime error');
                            span.setStatus({ code: SpanStatusCode.ERROR, message: lastError.message });
                            reject(new Error(lastError.message || 'Unknown runtime error'));
                            return;
                        }
                        if (response === undefined) {
                            // This often happens if the background script crashed or didn't send a response
                            const errorMsg = "Undefined response from background script";
                            span.recordException(errorMsg);
                            span.setStatus({ code: SpanStatusCode.ERROR, message: errorMsg });
                            reject(new Error(errorMsg));
                            return;
                        }
                        if (response && response.success) {
                            resolve({ audioId: response.audioId, timepoints: response.timepoints });
                        } else {
                            const err = response?.error || 'Unknown error generating google audio';
                            span.recordException(err);
                            span.setStatus({ code: SpanStatusCode.ERROR, message: err });
                            reject(err);
                        }
                    });
                });
            } catch (err: any) {
                span.recordException(err);
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
                span.end();
                throw err;
            }
        });
    }
}
