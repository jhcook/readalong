import { traceAsync } from '../utils/trace';
import { AudioCache } from '../AudioCache';
import { generateId } from '../utils/hash';
import { getAccessToken, validateServiceAccountJson } from '../GoogleAuth';
import { ServiceAccountJson } from '../../types/google-auth';

export async function handleGoogleMessage(
    message: any,
    audioCache: AudioCache
): Promise<any> {
    if (message.type === 'FETCH_GOOGLE_VOICES') {
        return traceAsync('Background.fetchGoogleVoices', async (span) => {
            // Securely retrieve credentials from storage
            const { googleApiKey, googleServiceAccountJson } = await chrome.storage.local.get(['googleApiKey', 'googleServiceAccountJson']);

            let headers: HeadersInit = {};
            let url = 'https://texttospeech.googleapis.com/v1beta1/voices';

            if (googleServiceAccountJson && validateServiceAccountJson(googleServiceAccountJson)) {
                // OAuth2 path - use Service Account
                span.addEvent('auth_mode_service_account');
                const accessToken = await getAccessToken(googleServiceAccountJson);
                headers = { 'Authorization': `Bearer ${accessToken}` };
            } else if (googleApiKey) {
                // Legacy API Key path
                span.addEvent('auth_mode_api_key');
                url = `${url}?key=${googleApiKey}`;
            } else {
                throw new Error('No authentication provided (API Key or Service Account JSON)');
            }

            const res = await fetch(url, { headers });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Google API Error: ${res.status} ${errorText}`);
            }

            const data = await res.json();
            return { success: true, voices: data.voices };
        });
    }

    if (message.type === 'GENERATE_GOOGLE_AUDIO') {
        const { text, voiceId, languageCode, ssmlGender } = message;

        return traceAsync('Background.generateGoogleAudio', async (span) => {
            span.setAttribute('google.voice_id', voiceId);

            // Generate ID based on SSML text + voice
            const id = await generateId(voiceId, text);

            // Check Cache
            const cachedData = await audioCache.getAudio(id);
            if (cachedData) {
                console.log('Background: Google Cache hit for', id);
                span.addEvent('cache_hit');
                return { success: true, audioId: id, timepoints: cachedData.alignment };
            }

            span.addEvent('cache_miss');

            // Securely retrieve credentials from storage
            const { googleApiKey, googleServiceAccountJson } = await chrome.storage.local.get(['googleApiKey', 'googleServiceAccountJson']);

            // Determine authentication method
            let headers: HeadersInit = { 'Content-Type': 'application/json' };
            let url = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';

            if (googleServiceAccountJson && validateServiceAccountJson(googleServiceAccountJson)) {
                // OAuth2 path - use Service Account
                span.addEvent('auth_mode_service_account');
                const accessToken = await getAccessToken(googleServiceAccountJson);
                headers['Authorization'] = `Bearer ${accessToken}`;
            } else if (googleApiKey) {
                // Legacy API Key path
                span.addEvent('auth_mode_api_key');
                url = `${url}?key=${googleApiKey}`;
            } else {
                throw new Error('No authentication provided (API Key or Service Account JSON)');
            }

            // Fetch from Google API
            const requestBody = {
                input: { ssml: text },
                voice: { languageCode: languageCode, name: voiceId, ssmlGender: ssmlGender },
                audioConfig: {
                    audioEncoding: "MP3"
                },
                enableTimePointing: ["SSML_MARK"]
            };
            console.log('Background: Google TTS Request:', JSON.stringify(requestBody, null, 2));
            const resp = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
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

            return { success: true, audioId: id, timepoints: timepoints };
        });
    }

    return null;
}
