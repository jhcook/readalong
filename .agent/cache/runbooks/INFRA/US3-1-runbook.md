# US3-1: Align Spoken Words to Text

Status: PROPOSED

## Goal Description
Align the real-time Speech-to-Text (STT) output with the reference text extracted from the webpage. This process assigns timestamps to the original text tokens, enabling synchronized highlighting.

## Panel Review Findings
- **@Architect**: Validated. Use a sequence alignment algorithm (e.g., Needleman-Wunsch or a simpler heuristic since it's real-time stream vs static text). Ideally, run this in a worker if it gets heavy, but for typical article lengths, main thread might be fine initially.
- **@QA**: Validated. Test with skipped words (user skips a sentence) and imperfect STT (misrecognized words).
- **@Observability**: Validated. Log alignment match rate (percentage of reference words successfully matched).

## Implementation Steps

### 1. Alignment Algorithm
#### [NEW] [web/extension/src/content/alignment/Aligner.ts](web/extension/src/content/alignment/Aligner.ts)
- Implement `align(reference: Word[], recognized: Word[]): void`.
- Use a fuzzy matching approach (Levenstein distance on word text) to handle minor STT errors.
- Update `reference` words with `start`, `end`, and `confidence` from matching `recognized` words.
- Handle "gaps" (skipped words in reading) by interpolating or leaving them un-highlighted.

### 2. Integration
#### [MODIFY] [web/extension/src/content/ReadingPane.tsx](web/extension/src/content/ReadingPane.tsx)
- Listen to `stt-result` events.
- Accumulate recognized words.
- Periodically (or on every result) run alignment against the `AlignmentMap`.
- Update state to trigger re-render of highlighting.

### 3. Dependencies
#### [MODIFY] [web/extension/package.json](web/extension/package.json)
- Add `fastest-levenshtein` for efficient string comparison.

## Verification Plan
### Automated Tests
- [ ] Unit tests for `Aligner.ts`:
    - Perfect match.
    - Missing words (skipped by reader).
    - Extra words (stuttering/re-reading).
    - STT typos.

### Manual Verification
- [ ] Load text.
- [ ] Start recording.
- [ ] Read text (intentionally skip a word or mumble).
- [ ] Verify highlighting jumps to the correct current word.
