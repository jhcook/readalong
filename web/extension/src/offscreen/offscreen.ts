import { AudioCache } from '../background/AudioCache';

const audio = new Audio();
const audioCache = new AudioCache();

// State
let currentAudioId: string | null = null;
let currentBlobUrl: string | null = null;

// Listen for messages from background/content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'OFFSCREEN') {
        handleMessage(message);
    }
    return false;
});

async function handleMessage(message: any) {
    console.debug("[Offscreen] Received:", message);

    switch (message.type) {
        case 'PLAY_AUDIO':
            await playAudio(message.audioId, message.startTime, message.rate);
            break;
        case 'PAUSE_AUDIO':
            audio.pause();
            break;
        case 'RESUME_AUDIO':
            audio.play();
            break;
        case 'STOP_AUDIO':
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
                currentBlobUrl = null;
            }
            audio.pause();
            audio.currentTime = 0;
            currentAudioId = null;
            break;
        case 'SET_PLAYBACK_RATE':
            if (message.rate) audio.playbackRate = message.rate;
            break;
    }
}

async function playAudio(audioId: string, startTime: number = 0, rate: number = 1) {
    try {
        if (currentAudioId !== audioId) {
            // New track
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
            }

            const data = await audioCache.getAudio(audioId);
            if (!data || !data.blob) {
                console.error(`[Offscreen] Audio not found for id: ${audioId}`);
                chrome.runtime.sendMessage({ type: 'AUDIO_ERROR', error: 'Audio not found in cache' });
                return;
            }

            currentBlobUrl = URL.createObjectURL(data.blob);
            audio.src = currentBlobUrl;
            currentAudioId = audioId;
        }

        audio.playbackRate = rate;

        // Robust Seek: Wait for metadata if needed
        if (startTime > 0) {
            if (audio.readyState >= 1) { // HAVE_METADATA
                audio.currentTime = startTime;
            } else {
                await new Promise<void>(resolve => {
                    const onMetadata = () => {
                        audio.currentTime = startTime;
                        audio.removeEventListener('loadedmetadata', onMetadata);
                        resolve();
                    };
                    audio.addEventListener('loadedmetadata', onMetadata);
                });
            }
        } else {
            audio.currentTime = 0;
        }

        await audio.play();

    } catch (err: any) {
        console.error("[Offscreen] Play error", err);
        chrome.runtime.sendMessage({ type: 'AUDIO_ERROR', error: err.message || String(err) });
    }
}

// Audio Event Listeners
audio.addEventListener('timeupdate', () => {
    chrome.runtime.sendMessage({
        type: 'AUDIO_TIMEUPDATE',
        currentTime: audio.currentTime
    });
});

audio.addEventListener('ended', () => {
    chrome.runtime.sendMessage({ type: 'AUDIO_ENDED' });
});

audio.addEventListener('error', (e) => {
    const errCode = audio.error ? audio.error.code : 'unknown';
    const errMsg = audio.error ? audio.error.message : 'Unknown playback error';
    console.error(`[Offscreen] <audio> error. Code: ${errCode}, Message: ${errMsg}`, e);
    chrome.runtime.sendMessage({
        type: 'AUDIO_ERROR',
        error: `Playback Error (${errCode}): ${errMsg}`
    });
});
