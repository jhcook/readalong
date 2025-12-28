# US5-2: Back One Sentence

Status: ACCEPTED

## Goal Description
Implement "Back One Sentence" functionality to allow children to easily re-read the previous sentence.

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
- Implemented `handleBackOneSentence` function.
- Calculates current sentence index based on `currentWordIndex` or `currentChunkIndex`.
- Decrements sentence index.
- Restarts playback from the beginning of the previous sentence.
- Includes debounce logic to handle rapid clicking.
- Added "Back" button to UI.
- Integrated OpenTelemetry tracing.

## Verification Plan
### Automated Tests
- `npm run test` in `web/extension` includes tests for `handleBackOneSentence` in `ReadingPane.test.tsx`.

### Manual Verification
- Verified clicking "Back" jumps to start of previous sentence.
- Verified multiple rapid clicks navigate back multiple sentences.
- Verified highlighting updates immediately.
