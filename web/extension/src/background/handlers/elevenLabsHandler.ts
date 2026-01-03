import { traceAsync } from '../utils/trace';
import { AudioCache } from '../AudioCache';
import { generateId } from '../utils/hash';

export async function handleElevenLabsMessage(
    message: any,
    audioCache: AudioCache
): Promise<any> {
    if (message.type === 'FETCH_VOICES') {
        const { apiKey } = message;
        return traceAsync('Background.fetchVoices', async (span) => {
            const res = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': apiKey }
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`API Error: ${res.status} ${errorText}`);
            }
            const data = await res.json();
            return { success: true, voices: data.voices };
        });
    }

    if (message.type === 'GENERATE_AUDIO') {
        const { voiceId, text, apiKey } = message;
        return traceAsync('Background.generateAudio', async (span) => {
            span.setAttribute('elevenlabs.voice_id', voiceId);

            const id = await generateId(voiceId, text);

            // Check Cache
            const cachedData = await audioCache.getAudio(id);
            if (cachedData) {
                console.log('Background: Cache hit for', id);
                span.addEvent('cache_hit');
                return { success: true, audioId: id, alignment: cachedData.alignment };
            }

            span.addEvent('cache_miss');
            console.log('Background: Fetching from ElevenLabs...');

            const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
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

            return { success: true, audioId: id, alignment: alignment };
        });
    }

    return null; // Not handled
}
