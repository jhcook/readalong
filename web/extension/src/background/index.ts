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

    // 1.6 Fetch Resemble Voices
    if (message.type === 'FETCH_RESEMBLE_VOICES') {
        const { apiKey } = message;
        const tracer = trace.getTracer('readalong-extension');
        tracer.startActiveSpan('Background.fetchResembleVoices', (span) => {
            // First fetch projects to get a valid project_uuid if needed, 
            // but primarily we need voices. Confusingly, Resemble has "Voices" and "Projects".
            // We'll fetch Projects first, then Voices.
            // Actually, let's just fetch Projects and assume we use the first project for context if needed,
            // or maybe we just list Voices. 
            // Let's try fetching Voices directly.
            fetch('https://app.resemble.ai/api/v2/voices?page=1', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            })
                .then(async res => {
                    if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(`Resemble API Error: ${res.status} ${errorText}`);
                    }
                    return res.json();
                })
                .then(async data => {
                    // data.items should contain voices
                    // We also need a project UUID to generate audio. 
                    // Let's fetch projects and just attach the first one's UUID to all voices for now
                    // or check if voices have project_uuid.

                    const voices = data.items || [];

                    // Fetch projects to find "ReadAlong" or create it
                    let defaultProjectUuid = '';
                    try {
                        const projRes = await fetch('https://app.resemble.ai/api/v2/projects?page=1', {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        // Helper to find project
                        const findReadAlongProject = (items: any[]) => items.find((p: any) => p.name === 'ReadAlong');

                        if (projRes.ok) {
                            const projData = await projRes.json();
                            const projects = projData.items || [];

                            // 1. Try to find "ReadAlong"
                            let targetProject = findReadAlongProject(projects);

                            // 2. If not found, create it
                            if (!targetProject) {
                                console.log('[Background] "ReadAlong" project not found in Resemble. Creating...');
                                const createRes = await fetch('https://app.resemble.ai/api/v2/projects', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${apiKey}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        name: 'ReadAlong',
                                        description: 'Automatically created by ReadAlong extension for audio generation',
                                        is_public: false,
                                        is_collaborative: false,
                                        is_archived: false
                                    })
                                });

                                if (createRes.ok) {
                                    const createData = await createRes.json();
                                    // Resemble create response structure: { success: true, item: { ... } } or just item?
                                    // Typically returns the created item.
                                    targetProject = createData.item || createData;
                                    console.log('[Background] Created "ReadAlong" project:', targetProject?.uuid);
                                } else {
                                    console.warn('[Background] Failed to create "ReadAlong" project', await createRes.text());
                                }
                            }

                            // 3. Set UUID
                            if (targetProject && targetProject.uuid) {
                                defaultProjectUuid = targetProject.uuid;
                            } else if (projects.length > 0) {
                                // Fallback to first project if creation failed
                                defaultProjectUuid = projects[0].uuid;
                            }
                        }
                    } catch (e) {
                        console.warn("Failed to manage projects", e);
                    }

                    // Map voices
                    const mappedVoices = voices.map((v: any) => ({
                        uuid: v.uuid,
                        name: v.name,
                        project_uuid: defaultProjectUuid, // Auto-assigned project UUID
                        preview_url: v.preview_url
                    }));

                    sendResponse({ success: true, voices: mappedVoices });
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
                    let errMsg = `API Error: ${resp.status} ${errorText}`;

                    if (resp.status === 401) {
                        errMsg = "ERR_UNAUTHORIZED: Invalid ElevenLabs API Key.";
                    } else if (resp.status === 402) {
                        errMsg = "ERR_PAYMENT_REQUIRED: ElevenLabs quota exceeded or payment required.";
                    } else if (resp.status === 429) {
                        errMsg = "ERR_TOO_MANY_REQUESTS: ElevenLabs rate limit exceeded. Please wait.";
                    }

                    throw new Error(errMsg);
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

    // 2.6 Generate Resemble Audio
    if (message.type === 'GENERATE_RESEMBLE_AUDIO') {
        const { text, voiceUuid, projectUuid, apiKey } = message;
        const tracer = trace.getTracer('readalong-extension');

        tracer.startActiveSpan('Background.generateResembleAudio', async (span) => {
            span.setAttribute('resemble.voice_uuid', voiceUuid);

            try {
                // Generate ID based on text + voice
                const id = await generateId(voiceUuid, text);

                // Check Cache
                const cachedData = await audioCache.getAudio(id);
                if (cachedData) {
                    console.log('Background: Resemble Cache hit for', id);
                    span.addEvent('cache_hit');
                    sendResponse({ success: true, audioId: id, alignment: cachedData.alignment });
                    span.end();
                    return;
                }

                span.addEvent('cache_miss');

                // Generate Clip
                console.log('Background: Generating Resemble Clip...');
                if (!projectUuid) throw new Error("Project UUID required for Resemble Audio");

                const resp = await fetch(`https://app.resemble.ai/api/v2/projects/${projectUuid}/clips`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: 'ReadAlong-Clip',
                        body: text,
                        voice_uuid: voiceUuid,
                        is_public: false,
                        is_archived: false,
                        include_timestamps: true
                    })
                });

                if (!resp.ok) {
                    const errorText = await resp.text();
                    let errMsg = `Resemble API Error: ${resp.status} ${errorText}`;

                    if (resp.status === 401) {
                        errMsg = "ERR_UNAUTHORIZED: Invalid Resemble API Key.";
                    } else if (resp.status === 402) {
                        errMsg = "ERR_PAYMENT_REQUIRED: Resemble AI quota exceeded or payment required.";
                    } else if (resp.status === 429) {
                        errMsg = "ERR_TOO_MANY_REQUESTS: Resemble AI rate limit exceeded.";
                    }

                    throw new Error(errMsg);
                }

                const data = await resp.json();
                const item = data.item;
                if (!item || !item.audio_src) throw new Error('No audio_src in response');

                // Download Audio
                const audioSrc = item.audio_src;
                const audioResp = await fetch(audioSrc);
                if (!audioResp.ok) throw new Error("Failed to download generated audio from Resemble");
                const audioBlob = await audioResp.blob();

                // Get Timestamps
                const timestamps = item.timestamps;

                // Cache it
                await audioCache.saveAudio(id, audioBlob, timestamps);

                sendResponse({ success: true, audioId: id, alignment: timestamps });
                span.end();

                // Cleanup: Delete the clip from Resemble to avoid clutter
                // Since we have it cached locally, we don't need it on the server.
                if (projectUuid && item.uuid) {
                    fetch(`https://app.resemble.ai/api/v2/projects/${projectUuid}/clips/${item.uuid}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }).then(delRes => {
                        if (delRes.ok) console.log('[Background] Cleaned up Resemble clip:', item.uuid);
                        else console.warn('[Background] Failed to cleanup Resemble clip:', item.uuid);
                    }).catch(e => console.warn('[Background] Error cleaning up Resemble clip:', e));
                }

            } catch (err: any) {
                console.error('Background Resemble Error:', err);
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
