
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

        const response = await new Promise<any>((resolve) => {
            const timeoutId = setTimeout(() => {
                console.warn('[GoogleSTTClient] Transcription request timed out after 30s');
                resolve({ error: 'Timeout waiting for STT response' });
            }, 30000);

            chrome.runtime.sendMessage({
                type: 'TRANSCRIBE_AUDIO',
                payload: {
                    audioBase64,
                    languageCode
                }
            }, (res) => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                    console.error('[GoogleSTTClient] Runtime error sending message:', chrome.runtime.lastError);
                    resolve({ error: chrome.runtime.lastError.message });
                } else {
                    resolve(res);
                }
            });
        });

        if (!response || response.error) {
            console.warn('[GoogleSTTClient] Transcription failed/skipped:', response?.error || "No response");
            return [];
        }

        return response.timestamps || [];
    }
}
