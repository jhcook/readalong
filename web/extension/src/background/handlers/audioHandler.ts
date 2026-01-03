import { AudioCache } from '../AudioCache';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creating: Promise<void> | null = null;
let activeAudioTabId: number | null = null;
let offscreenDocumentId: string | null = null; // Track if we created it? Chrome API tracks it.

async function setupOffscreenDocument(path: string) {
    if (typeof chrome.offscreen === 'undefined') {
        throw new Error("Offscreen API not supported in this browser");
    }

    if (await chrome.offscreen.hasDocument()) {
        return;
    }

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

export async function handleAudioMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    audioCache: AudioCache
): Promise<any> {

    // Playback Control
    if (['PLAY_AUDIO', 'PAUSE_AUDIO', 'RESUME_AUDIO', 'STOP_AUDIO', 'SET_PLAYBACK_RATE'].includes(message.type)) {
        if (message.type === 'PLAY_AUDIO' && sender.tab?.id) {
            activeAudioTabId = sender.tab.id;
        }
        if (message.type === 'STOP_AUDIO') {
            activeAudioTabId = null;
        }

        await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
        chrome.runtime.sendMessage({ ...message, target: 'OFFSCREEN' });
        return { success: true };
    }

    // Fetch Audio Data (for fallback playback in Content Script)
    if (message.type === 'FETCH_AUDIO') {
        const { audioId } = message;
        console.log('[Background] FETCH_AUDIO request for:', audioId);

        const cachedData = await audioCache.getAudio(audioId);
        console.log('[Background] FETCH_AUDIO: Cache hit?', !!cachedData);

        if (!cachedData) {
            return { success: false, error: 'Audio not found in cache' };
        }

        // Convert Blob to Base64/DataURL
        const reader = new FileReader();
        return new Promise((resolve) => {
            reader.onloadend = () => {
                console.log('[Background] FETCH_AUDIO: FileReader success.');
                const base64data = reader.result as string;
                resolve({ success: true, audioData: base64data });
            };
            reader.onerror = () => {
                console.error('[Background] FETCH_AUDIO: FileReader error');
                resolve({ success: false, error: 'Failed to read blob' });
            };
            reader.readAsDataURL(cachedData.blob);
        });
    }

    // Relay Events (Offscreen -> Content)
    // Note: These messages usually come FROM Offscreen via runtime.sendMessage, 
    // so we need to relay them to the active tab.
    if (['AUDIO_TIMEUPDATE', 'AUDIO_ENDED', 'AUDIO_ERROR'].includes(message.type)) {
        if (activeAudioTabId) {
            chrome.tabs.sendMessage(activeAudioTabId, message).catch(() => {
                activeAudioTabId = null;
            });
        }
        // No response needed for relay, but we processed it.
        return null;
    }

    return null;
}
