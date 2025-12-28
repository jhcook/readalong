import { AudioCache } from './AudioCache';
import { setupTracing } from './tracing';
import { trace, SpanStatusCode } from '@opentelemetry/api';

setupTracing();
const audioCache = new AudioCache();

// Helpers for Hashing
async function generateId(voiceId: string, text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(voiceId + '::' + text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface GenerateRequest {
    voiceId: string;
    text: string;
    apiKey: string;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_VOICES') {
        const { apiKey } = message;
        const tracer = trace.getTracer('readalong-extension');
        tracer.startActiveSpan('Background.fetchVoices', (span) => {
            fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': apiKey
                }
            })
                .then(async res => {
                    if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(`API Error: ${res.status} ${errorText}`);
                    }
                    return res.json();
                })
                .then(data => {
                    sendResponse({ success: true, voices: data.voices });
                    span.end();
                })
                .catch(err => {
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
                    sendResponse({ success: false, error: err.toString() });
                    span.end();
                });
        });

        return true; // Keep channel open
    }

    if (message.type === 'GENERATE_AUDIO') {
        const { voiceId, text, apiKey } = message as GenerateRequest;

        const tracer = trace.getTracer('readalong-extension');
        tracer.startActiveSpan('Background.generateAudio', async (span) => {
            span.setAttribute('elevenlabs.voice_id', voiceId);

            try {
                const id = await generateId(voiceId, text);

                // 1. Check Cache
                const cachedData = await audioCache.getAudio(id);
                if (cachedData) {
                    console.log('Background: Cache hit for', id);
                    span.addEvent('cache_hit');
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        sendResponse({ success: true, audioData: reader.result, alignment: cachedData.alignment }); // Base64
                        span.end();
                    };
                    reader.readAsDataURL(cachedData.blob);
                    return;
                }

                span.addEvent('cache_miss');

                // 2. Fetch from API
                console.log('Background: Fetching from ElevenLabs...');
                const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: "eleven_monolingual_v1",
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.5
                        }
                    })
                });

                if (!resp.ok) {
                    const errorText = await resp.text();
                    throw new Error(`API Error: ${resp.status} ${errorText}`);
                }

                const data = await resp.json();
                const audioBase64 = data.audio_base64;
                const alignment = data.alignment;

                if (!audioBase64) {
                    throw new Error('No audio data received');
                }

                // Convert base64 to Blob
                const byteCharacters = atob(audioBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'audio/mpeg' });


                // 3. Cache it
                await audioCache.saveAudio(id, blob, alignment);

                // 4. Return as Data URL
                const reader = new FileReader();
                reader.onloadend = () => {
                    sendResponse({ success: true, audioData: reader.result, alignment: alignment });
                    span.end();
                };
                reader.readAsDataURL(blob);

            } catch (err: any) {
                console.error('Background Error:', err);
                span.recordException(err);
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
                sendResponse({ success: false, error: err.toString() });
                span.end();
            }
        });

        return true; // Keep channel open
    }
});
