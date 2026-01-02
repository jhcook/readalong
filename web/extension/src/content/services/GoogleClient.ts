
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { GoogleAuthOptions, ServiceAccountJson } from '../../types/google-auth';

export interface GoogleVoice {
    name: string;
    languageCodes: string[];
    ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
    naturalSampleRateHertz: number;
}

export class GoogleClient {

    /**
     * Fetch available Google TTS voices
     */
    static async getVoices(): Promise<GoogleVoice[]> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('GoogleClient.getVoices', async (span) => {
            return new Promise<GoogleVoice[]>((resolve, reject) => {
                const message: any = { type: 'FETCH_GOOGLE_VOICES' };

                chrome.runtime.sendMessage(message, (response) => {
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

    /**
     * Generate audio using Google TTS
     */
    static async generateAudio(
        textSsml: string,
        voiceId: string,
        languageCode: string,
        ssmlGender: string
    ): Promise<{ audioId: string, timepoints: any[] }> {
        const tracer = trace.getTracer('readalong-extension');
        return tracer.startActiveSpan('GoogleClient.generateAudio', async (span) => {
            span.setAttribute('google.voice_id', voiceId);
            span.setAttribute('google.ssml_length', textSsml.length);

            try {
                return new Promise<{ audioId: string; timepoints: any[] }>((resolve, reject) => {
                    const message: any = {
                        type: 'GENERATE_GOOGLE_AUDIO',
                        text: textSsml,
                        voiceId,
                        languageCode,
                        ssmlGender
                    };

                    chrome.runtime.sendMessage(message, (response) => {
                        const lastError = chrome.runtime.lastError;
                        if (lastError) {
                            span.recordException(lastError.message || 'Unknown runtime error');
                            span.setStatus({ code: SpanStatusCode.ERROR, message: lastError.message });
                            reject(new Error(lastError.message || 'Unknown runtime error'));
                            return;
                        }
                        if (response === undefined) {
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
