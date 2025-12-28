# WEB-001: Implement Text-to-Speech Playback

Status: ACCEPTED

## Goal Description
Implement basic Text-to-Speech (TTS) functionality using the browser's `speechSynthesis` API to allow users to listen to text with synchronized highlighting.

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
- Implemented `handleReadAloud` function.
- Uses `speechSynthesis.speak` with `SpeechSynthesisUtterance`.
- Uses `utterance.onboundary` to track word progress and update `currentWordIndex`.
- Added "Read Aloud" button to trigger playback.
- Handles voice loading via `speechSynthesis.getVoices()`.

## Verification Plan
### Automated Tests
- `npm run test` in `web/extension` includes tests for TTS initiation and event handling.

### Manual Verification
- Verified clicking "Read Aloud" starts audio.
- Verified words are highlighted in sync with audio.
