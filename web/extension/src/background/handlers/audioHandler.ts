import { AudioCache } from '../AudioCache';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creating: Promise<void> | null = null;
let activeAudioTabId: number | null = null;
let offscreenDocumentId: string | null = null; // Track if we created it? Chrome API tracks it.

// Firefox fallback: Audio element for playback when offscreen API unavailable
let fallbackAudio: HTMLAudioElement | null = null;
let fallbackPlaybackRate: number = 1.0;

async function setupOffscreenDocument(path: string): Promise<boolean> {
    // Firefox doesn't support offscreen API - use fallback
    if (typeof chrome.offscreen === 'undefined') {
        console.warn('[Background] Offscreen API not available, using fallback audio');
        return false;
    }

    if (await chrome.offscreen.hasDocument()) {
        return true;
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
    return true;
}

function handleFallbackAudio(message: any): { success: boolean } {
    switch (message.type) {
        case 'PLAY_AUDIO':
            if (fallbackAudio) {
                fallbackAudio.pause();
                fallbackAudio = null;
            }
            fallbackAudio = new Audio(message.audioData);
            fallbackAudio.playbackRate = message.playbackRate || fallbackPlaybackRate;

            fallbackAudio.ontimeupdate = () => {
                if (activeAudioTabId && fallbackAudio) {
                    chrome.tabs.sendMessage(activeAudioTabId, {
                        type: 'AUDIO_TIMEUPDATE',
                        currentTime: fallbackAudio.currentTime
                    }).catch(() => { });
                }
            };

            fallbackAudio.onended = () => {
                if (activeAudioTabId) {
                    chrome.tabs.sendMessage(activeAudioTabId, { type: 'AUDIO_ENDED' }).catch(() => { });
                }
                fallbackAudio = null;
            };

            fallbackAudio.onerror = (e) => {
                if (activeAudioTabId) {
                    chrome.tabs.sendMessage(activeAudioTabId, {
                        type: 'AUDIO_ERROR',
                        error: 'Audio playback failed'
                    }).catch(() => { });
                }
                fallbackAudio = null;
            };

            fallbackAudio.play().catch(err => {
                console.error('[Background] Fallback audio play error:', err);
            });
            break;

        case 'PAUSE_AUDIO':
            fallbackAudio?.pause();
            break;

        case 'RESUME_AUDIO':
            fallbackAudio?.play().catch(() => { });
            break;

        case 'STOP_AUDIO':
            if (fallbackAudio) {
                fallbackAudio.pause();
                fallbackAudio = null;
            }
            break;

        case 'SET_PLAYBACK_RATE':
            fallbackPlaybackRate = message.rate || 1.0;
            if (fallbackAudio) {
                fallbackAudio.playbackRate = fallbackPlaybackRate;
            }
            break;
    }
    return { success: true };
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

        const hasOffscreen = await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

        if (hasOffscreen) {
            // Chrome: Use offscreen document
            chrome.runtime.sendMessage({ ...message, target: 'OFFSCREEN' });
        } else {
            // Firefox: Use fallback audio
            return handleFallbackAudio(message);
        }
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

