# US5-1: Play/Pause Narration

Status: ACCEPTED

## Goal Description
Implement play/pause functionality to allow children to control the narration flow, including pausing/resuming TTS and recorded audio playback.

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
- Implemented `isPaused`, `isTtsPlaying`, `isAudioPlaying` state variables.
- Implemented `handlePause` and `handleResume` functions.
- `handlePause` pauses `window.speechSynthesis` or `audioRef`.
- `handleResume` resumes `window.speechSynthesis` or `audioRef`.
- Added Play/Pause button to UI that toggles state.

## Verification Plan
### Automated Tests
- `npm run test` in `web/extension` includes tests for `handlePause` and `handleResume` in `ReadingPane.test.tsx`.

### Manual Verification
- Verified clicking Pause stops audio and highlighting.
- Verified clicking Play resumes audio and highlighting from correct position.
