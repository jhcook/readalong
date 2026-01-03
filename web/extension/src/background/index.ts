import { AudioCache } from './AudioCache';
import { setupTracing } from './tracing';
import { handleElevenLabsMessage } from './handlers/elevenLabsHandler';
import { handleGoogleMessage } from './handlers/googleHandler';
import { handleResembleMessage } from './handlers/resembleHandler';
import { handleAudioMessage } from './handlers/audioHandler';
import { handleSTTConnection } from './handlers/sttHandler';

// Initialize Global Services
setupTracing();
const audioCache = new AudioCache();

/**
 * Main Message Dispatcher
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. ElevenLabs Handlers
    if (['FETCH_VOICES', 'GENERATE_AUDIO'].includes(message.type)) {
        handleElevenLabsMessage(message, audioCache)
            .then(sendResponse)
            .catch(err => sendResponse({ success: false, error: err.toString() }));
        return true;
    }

    // 2. Google Handlers
    if (['FETCH_GOOGLE_VOICES', 'GENERATE_GOOGLE_AUDIO'].includes(message.type)) {
        handleGoogleMessage(message, audioCache)
            .then(sendResponse)
            .catch(err => sendResponse({ success: false, error: err.toString() }));
        return true;
    }

    // 3. Resemble Handlers
    if (['FETCH_RESEMBLE_VOICES', 'GENERATE_RESEMBLE_AUDIO'].includes(message.type)) {
        handleResembleMessage(message, audioCache)
            .then(sendResponse)
            .catch(err => sendResponse({ success: false, error: err.toString() }));
        return true;
    }

    // 4. Audio Playback & Utils
    if ([
        'PLAY_AUDIO', 'PAUSE_AUDIO', 'RESUME_AUDIO', 'STOP_AUDIO', 'SET_PLAYBACK_RATE',
        'FETCH_AUDIO', 'AUDIO_TIMEUPDATE', 'AUDIO_ENDED', 'AUDIO_ERROR'
    ].includes(message.type)) {
        handleAudioMessage(message, sender, audioCache)
            .then(res => {
                if (res) sendResponse(res);
            })
            .catch(err => sendResponse({ success: false, error: err.toString() }));
        return true;
    }

    // 5. Options Page
    if (message.type === 'OPEN_OPTIONS_PAGE') {
        chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
        return true;
    }

    return false; // Unknown message
});

/**
 * Long-Lived Connections (e.g. STT)
 */
chrome.runtime.onConnect.addListener((port) => {
    handleSTTConnection(port);
});
