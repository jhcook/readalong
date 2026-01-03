import { getAccessToken, validateServiceAccountJson } from '../GoogleAuth';
import { ServiceAccountJson } from '../../types/google-auth';

export function handleSTTConnection(port: chrome.runtime.Port) {
    if (port.name !== 'stt_channel') return;

    port.onMessage.addListener((message) => {
        if (message.type === 'TRANSCRIBE_AUDIO') {
            const { audioBase64, languageCode } = message.payload;
            console.log('[Background] TRANSCRIBE_AUDIO (Port) request. AudioLength:', audioBase64?.length);

            // Run async
            (async () => {
                try {
                    console.log('[Background] TRANSCRIBE_AUDIO: [1] Getting credentials...');
                    const { googleServiceAccountJson } = await chrome.storage.local.get(['googleServiceAccountJson']);
                    console.log('[Background] TRANSCRIBE_AUDIO: [2] Credentials retrieved.');

                    if (!googleServiceAccountJson || !validateServiceAccountJson(googleServiceAccountJson)) {
                        throw new Error('Google Service Account JSON required for STT.');
                    }

                    console.log('[Background] TRANSCRIBE_AUDIO: [3] Getting Access Token...');
                    const accessToken = await getAccessToken(googleServiceAccountJson);
                    const projectId = googleServiceAccountJson.project_id;
                    console.log('[Background] TRANSCRIBE_AUDIO: [4] AccessToken obtained. Project:', projectId);

                    const url = `https://speech.googleapis.com/v2/projects/${projectId}/locations/global/recognizers/_:recognize`;

                    const requestBody = {
                        config: {
                            autoDecodingConfig: {},
                            features: {
                                enableWordTimeOffsets: true
                            },
                            model: "long",
                            languageCodes: [languageCode]
                        },
                        content: audioBase64
                    };

                    console.log('[Background] TRANSCRIBE_AUDIO: [5] Fetching Google API...');
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                    console.log('[Background] TRANSCRIBE_AUDIO: [6] Fetch returned. Status:', resp.status);

                    if (!resp.ok) {
                        const errorText = await resp.text();
                        console.error('[Background] TRANSCRIBE_AUDIO: API Error', resp.status, errorText);
                        throw new Error(`Google STT API Error: ${resp.status} ${errorText}`);
                    }

                    const data = await resp.json();
                    console.log('[Background] TRANSCRIBE_AUDIO: [7] Success. Results:', data.results?.length);

                    const timestamps: any[] = [];
                    if (data.results) {
                        for (const result of data.results) {
                            if (result.alternatives && result.alternatives[0].words) {
                                for (const wordInfo of result.alternatives[0].words) {
                                    timestamps.push({
                                        word: wordInfo.word,
                                        startTime: parseFloat((wordInfo.startOffset || "0s").replace('s', '')),
                                        endTime: parseFloat((wordInfo.endOffset || "0s").replace('s', ''))
                                    });
                                }
                            }
                        }
                    }

                    console.log('[Background] TRANSCRIBE_AUDIO: [8] Sending Response via Port with', timestamps.length, 'timestamps');
                    port.postMessage({ success: true, timestamps });

                } catch (err: any) {
                    console.error('Background STT Error:', err);
                    try {
                        port.postMessage({ success: false, error: err.toString() });
                    } catch (e) {
                        console.warn('[Background] Failed to send error via port:', e);
                    }
                }
            })();
        }
    });
}
