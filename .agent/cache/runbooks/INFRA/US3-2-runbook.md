# US3-2: Handle Paraphrasing

Status: COMPLETED

## Goal Description
Enhance the alignment engine to tolerate natural speech variations, such as skipped words, inserted filler words, or minor substitutions (paraphrasing). This ensures the highlighting remains synchronized even when the reader is not perfect.

## Panel Review Findings
- **@Architect**: Validated. The current `Aligner` implementation uses a search window and Levenshtein distance, which is a good foundation. We need to verify its robustness against paraphrasing.
- **@QA**: Validated. Test with "The quick brown fox" vs "The fast brown fox" (substitution) or "The fox" (skip).
- **@Observability**: Validated. Log when a word is skipped or fuzzy-matched to tune thresholds later.

## Implementation Steps

### 1. Enhanced Tests
#### [MODIFY] [web/extension/src/content/alignment/Aligner.test.ts](web/extension/src/content/alignment/Aligner.test.ts)
- Add test cases for:
    - Word substitution (e.g., "fast" instead of "quick").
    - Inserted words (e.g., "The very quick...").
    - Skipped words (e.g., "The ... fox").

### 2. Tuning Aligner
#### [MODIFY] [web/extension/src/content/alignment/Aligner.ts](web/extension/src/content/alignment/Aligner.ts)
- Adjust `SEARCH_WINDOW` and `MAX_DISTANCE` if necessary.
- Consider a "look-back" or "anchor" strategy if the greedy forward search gets lost easily (though the current implementation only moves forward).
- Add logging for skipped/fuzzy matches (AC2/AC3).

## Verification Plan
### Automated Tests
- [x] Unit tests pass for paraphrasing scenarios.

### Manual Verification
- [x] Load text.
- [x] Read with intentional mistakes (skip words, change words).
- [x] Verify highlighting catches up.
