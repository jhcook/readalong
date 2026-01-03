
export interface WordTimestamp {
    word: string;
    startTime: number; // seconds
    endTime: number;   // seconds
}

export class GoogleSTTClient {
    /**
     * Transcribes audio blob using Google STT V2 to get word timestamps.
     * Uses the existing cached 'googleServiceAccountJson' from storage via background proxy.
     */
    static async transcribeForTimestamps(
        audio: Blob | string,
        languageCode: string
    ): Promise<WordTimestamp[]> {
        let audioBase64: string;

        if (typeof audio === 'string') {
            // Already base64 (strip prefix if present)
            if (audio.includes(',')) {
                audioBase64 = audio.split(',')[1];
            } else {
                audioBase64 = audio;
            }
        } else {
            // Convert Blob to Base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                    const result = reader.result as string;
                    if (result.includes(',')) {
                        resolve(result.split(',')[1]);
                    } else {
                        resolve(result);
                    }
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(audio);
            audioBase64 = await base64Promise;
        }

        return new Promise<WordTimestamp[]>((resolve) => {
            // Use a long-lived connection to prevent "message channel closed" on long requests
            const port = chrome.runtime.connect({ name: 'stt_channel' });

            // Set a client-side safety timeout (e.g. 2 minutes)
            const timeoutId = setTimeout(() => {
                console.warn('[GoogleSTTClient] Transcription request timed out (client-side limit)');
                port.disconnect();
                resolve([]);
            }, 120000);

            port.onMessage.addListener((msg) => {
                if (msg.success) {
                    clearTimeout(timeoutId);
                    resolve(msg.timestamps || []);
                } else {
                    console.warn('[GoogleSTTClient] STT Error:', msg.error);
                    clearTimeout(timeoutId);
                    resolve([]);
                }
                port.disconnect();
            });

            port.onDisconnect.addListener(() => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                    console.warn('[GoogleSTTClient] Port disconnected with error:', chrome.runtime.lastError.message);
                } else {
                    // Logic: if we disconnected without receiving a message (and resolved), 
                    // it normally means the background script closed the port.
                    // But we handle success/error above. If we get here pending, assume failure.
                    console.warn('[GoogleSTTClient] Port disconnected unexpectedly');
                }
                // Ensure we resolve if we haven't already (Promise only resolves once)
                resolve([]);
            });

            // Send the request
            port.postMessage({
                type: 'TRANSCRIBE_AUDIO',
                payload: {
                    audioBase64,
                    languageCode
                }
            });
        });
    }
}
