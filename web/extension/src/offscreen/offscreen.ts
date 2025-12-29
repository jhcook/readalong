import { AudioCache } from '../background/AudioCache';

const audio = new Audio();
const audioCache = new AudioCache();

// State
let currentAudioId: string | null = null;
let currentBlobUrl: string | null = null;

// Listen for messages from background/content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'OFFSCREEN') return;

    handleMessage(message);
    // Be async if needed
    if (message.type === 'PLAY_AUDIO') return true;
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
        audio.currentTime = startTime; // If seeking
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
    console.error("[Offscreen] <audio> error", e);
    chrome.runtime.sendMessage({
        type: 'AUDIO_ERROR',
        error: audio.error?.message || 'Unknown playback error'
    });
});
