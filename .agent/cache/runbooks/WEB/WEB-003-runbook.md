# WEB-003: Add Voice Selection Menu to Settings (System & ElevenLabs)

Status: ACCEPTED

## Goal Description
Add a voice selection menu to the settings, allowing users to choose between specific system voices and ElevenLabs cloned voices.

## Compliance Checklist
- [x] @Security approved?
- [x] @Architect approved?
- [x] @QA approved?
- [x] @Docs approved?
- [x] @Compliance approved?
- [x] @Observability approved?

## Proposed Changes
### Web Extension
#### [MODIFY] [ReadingPane.tsx](file:///Users/jcook/repo/readalong/web/extension/src/content/ReadingPane.tsx)
- Added state for `voiceSource` ('system' | 'elevenlabs'), `systemVoiceURI`, `elevenLabsApiKey`, `selectedVoiceId`.
- Added UI in Settings menu to:
    - Select Voice Source.
    - Select specific System Voice.
    - Input ElevenLabs API Key.
    - Select ElevenLabs Voice.
- Implemented logic to persist these settings to `chrome.storage.local`.
- Updated `handleReadAloud` and playback logic to respect selected voice.

#### [MODIFY] [ElevenLabsClient.ts](file:///Users/jcook/repo/readalong/web/extension/src/content/services/ElevenLabsClient.ts)
- Helper class to fetch voices and generate audio from ElevenLabs API.

## Verification Plan
### Automated Tests
- `ReadingPane.test.tsx` mocks storage and checks for settings persistance.

### Manual Verification
- Verified System Voice selection changes the TTS voice.
- Verified ElevenLabs integration fetches voices and generates audio.
- Verified settings persist across reloads.
