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

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function setupOffscreenDocument(path: string) {
    // Safari does not support chrome.offscreen
    if (typeof chrome.offscreen === 'undefined') {
        throw new Error("Offscreen API not supported in this browser");
    }

    // Check if offscreen document already exists
    if (await chrome.offscreen.hasDocument()) {
        return;
    }

    // Create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
            justification: 'Playback of generated audio',
        });
        await creating;
        creating = null;
    }
}
let creating: Promise<void> | null = null;
let activeAudioTabId: number | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. Fetch Voices
    if (message.type === 'FETCH_VOICES') {
        const { apiKey } = message;
        const tracer = trace.getTracer('readalong-extension');
        tracer.startActiveSpan('Background.fetchVoices', (span) => {
            fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': apiKey }
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
        return true;
    }

    // 1.5 Fetch Google Voices
    if (message.type === 'FETCH_GOOGLE_VOICES') {
        const { apiKey } = message;
        const tracer = trace.getTracer('readalong-extension');
        tracer.startActiveSpan('Background.fetchGoogleVoices', (span) => {
            fetch(`https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`)
                .then(async res => {
                    if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(`Google API Error: ${res.status} ${errorText}`);
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
        return true;
    }

    // 2. Generate Audio
    if (message.type === 'GENERATE_AUDIO') {
        const { voiceId, text, apiKey } = message as GenerateRequest;

        const tracer = trace.getTracer('readalong-extension');
        tracer.startActiveSpan('Background.generateAudio', async (span) => {
            span.setAttribute('elevenlabs.voice_id', voiceId);

            try {
                const id = await generateId(voiceId, text);

                // Check Cache
                const cachedData = await audioCache.getAudio(id);
                if (cachedData) {
                    console.log('Background: Cache hit for', id);
                    span.addEvent('cache_hit');

                    // We return audioId so content script can request playback via offscreen
                    // We also return alignment.
                    // Note: We no longer strictly need to return base64 audioData unless
                    // specific parts of UI need it? 
                    // But to keep backward compat (if we simply swapped providers), we could.
                    // But returning huge base64 strings is costly.
                    // Let's return the audioId and alignment.
                    sendResponse({ success: true, audioId: id, alignment: cachedData.alignment });
                    span.end();
                    return;
                }

                span.addEvent('cache_miss');

                // Fetch from API
                console.log('Background: Fetching from ElevenLabs...');
                // USE NEW MODEL: eleven_multilingual_v2
                const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: "eleven_multilingual_v2", // UPDATED MODEL
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75 // Slightly higher boost for consistency
                        }
                    })
                });

                console.log(`[Background] Generated audio for VoiceID: ${voiceId} with Model: eleven_multilingual_v2`);



                if (!resp.ok) {
                    const errorText = await resp.text();
                    throw new Error(`API Error: ${resp.status} ${errorText}`);
                }

                const data = await resp.json();
                const audioBase64 = data.audio_base64;
                const alignment = data.alignment;

                if (!audioBase64) throw new Error('No audio data received');

                // Convert base64 to Blob
                const byteCharacters = atob(audioBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'audio/mpeg' });

                // Cache it
                await audioCache.saveAudio(id, blob, alignment);

                // Return
                sendResponse({ success: true, audioId: id, alignment: alignment });
                span.end();

            } catch (err: any) {
                console.error('Background Error:', err);
                span.recordException(err);
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
                sendResponse({ success: false, error: err.toString() });
                span.end();
            }
        });
        return true;
    }

    // 2.5 Generate Google Audio
    if (message.type === 'GENERATE_GOOGLE_AUDIO') {
        const { text, voiceId, apiKey, languageCode, ssmlGender } = message;

        const tracer = trace.getTracer('readalong-extension');
        tracer.startActiveSpan('Background.generateGoogleAudio', async (span) => {
            span.setAttribute('google.voice_id', voiceId);

            try {
                // Generate ID based on SSML text + voice
                const id = await generateId(voiceId, text);

                // Check Cache
                const cachedData = await audioCache.getAudio(id);
                if (cachedData) {
                    console.log('Background: Google Cache hit for', id);
                    span.addEvent('cache_hit');
                    sendResponse({ success: true, audioId: id, timepoints: cachedData.alignment });
                    span.end();
                    return;
                }

                span.addEvent('cache_miss');

                // Fetch from Google API
                console.log('Background: Fetching from Google Cloud TTS...');
                const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: { ssml: text },
                        voice: { languageCode: languageCode, name: voiceId, ssmlGender: ssmlGender },
                        audioConfig: {
                            audioEncoding: "MP3",
                            enableTimePointing: ["SSML_MARK"]
                        }
                    })
                });

                if (!resp.ok) {
                    const errorText = await resp.text();
                    throw new Error(`Google API Error: ${resp.status} ${errorText}`);
                }

                const data = await resp.json();
                const audioBase64 = data.audioContent;
                const timepoints = data.timepoints || [];

                if (!audioBase64) throw new Error('No audio content received from Google');

                // Convert base64 to Blob
                const byteCharacters = atob(audioBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'audio/mpeg' });

                // Cache it
                await audioCache.saveAudio(id, blob, timepoints);

                // Return
                sendResponse({ success: true, audioId: id, timepoints: timepoints });
                span.end();

            } catch (err: any) {
                console.error('Background Google Error:', err);
                span.recordException(err);
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.toString() });
                sendResponse({ success: false, error: err.toString() });
                span.end();
            }
        });
        return true;
    }

    // 3. Audio Playback Proxy (Content -> Background -> Offscreen)
    if (['PLAY_AUDIO', 'PAUSE_AUDIO', 'RESUME_AUDIO', 'STOP_AUDIO', 'SET_PLAYBACK_RATE'].includes(message.type)) {
        // Track the tab that requested playback
        if (message.type === 'PLAY_AUDIO' && sender.tab?.id) {
            activeAudioTabId = sender.tab.id;
        }
        if (message.type === 'STOP_AUDIO') {
            activeAudioTabId = null;
        }

        (async () => {
            try {
                // Ensure offscreen doc exists
                await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

                // Forward message to offscreen
                // We add target: 'OFFSCREEN' to distinguish
                chrome.runtime.sendMessage({ ...message, target: 'OFFSCREEN' });

                sendResponse({ success: true });
            } catch (err: any) {
                console.error("Proxy error", err);
                sendResponse({ success: false, error: err.toString() });
            }
        })();
        return true;
    }

    // 4. Fetch Audio Data (for fallback playback in Content Script)
    if (message.type === 'FETCH_AUDIO') {
        const { audioId } = message;
        (async () => {
            try {
                const cachedData = await audioCache.getAudio(audioId);
                if (!cachedData) {
                    sendResponse({ success: false, error: 'Audio not found in cache' });
                    return;
                }

                // Convert Blob to Base64/DataURL
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    sendResponse({ success: true, audioData: base64data });
                };
                reader.onerror = () => {
                    sendResponse({ success: false, error: 'Failed to read blob' });
                };
                reader.readAsDataURL(cachedData.blob);
            } catch (err: any) {
                console.error("Fetch Audio error", err);
                sendResponse({ success: false, error: err.toString() });
            }
        })();
        return true;
    }

    // 5. Relay Events (Offscreen -> Content)
    if (['AUDIO_TIMEUPDATE', 'AUDIO_ENDED', 'AUDIO_ERROR'].includes(message.type)) {
        if (activeAudioTabId) {
            chrome.tabs.sendMessage(activeAudioTabId, message).catch(() => {
                // Tab likely closed
                activeAudioTabId = null;
            });
        }
    }
});
