# US5-3: Forward One Sentence

Status: ACCEPTED

## Goal Description
Implement "Forward One Sentence" functionality to allow children to skip ahead to the next sentence.

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
- Implemented `handleForwardOneSentence` function.
- Calculates current sentence index based on `currentWordIndex` or `currentChunkIndex`.
- Increments sentence index.
- Restarts playback from the beginning of the next sentence.
- Includes debounce logic.
- Added "Forward" button to UI.
- Integrated OpenTelemetry tracing.

## Verification Plan
### Automated Tests
- `npm run test` in `web/extension` includes tests for `handleForwardOneSentence` in `ReadingPane.test.tsx`.

### Manual Verification
- Verified clicking "Forward" jumps to start of next sentence.
- Verified multiple rapid clicks navigate forward multiple sentences.
- Verified highlighting updates immediately.
