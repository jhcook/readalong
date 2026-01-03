# WEB-010: Dynamic Ignore During Playback

## State
COMMITTED

## Problem Statement
When users click to ignore text while the voice is actively reading, the ignored text is still spoken. The current implementation only applies ignored sentences when playback **starts** (via `initProvider`), but does not react to changes in `ignoredSentenceIndices` during active playback.

## User Story
As a user, I want to be able to ignore text while the voice is reading, and have the voice skip the ignored content without restarting the current sentence, so that playback feels natural and uninterrupted.

## Acceptance Criteria
- [x] When a sentence is ignored during active playback, the voice stops reading that sentence immediately
- [x] When a future sentence is ignored, the current sentence continues naturally
- [x] When playback reaches an ignored sentence, it automatically skips to the next non-ignored sentence
- [x] If all remaining sentences are ignored, playback stops gracefully
- [x] Works with all voice sources (System, ElevenLabs, Google, Resemble, Recorded)
- [x] Existing tests continue to pass

## Non-Functional Requirements
- Performance: No perceptible delay when ignoring during playback
- User Experience: Current sentence continues naturally when ignoring future sentences

## Linked ADRs
- ADR-001: Hybrid Local + Cloud Architecture

## Impact Analysis Summary
Components touched:
- `ReadingPane.tsx` - Added `prevIgnoredRef` and `prevSentenceIdxRef` refs, two useEffects for dynamic ignore handling

Workflows affected:
- Standard playback flow

## Test Strategy
- **Automated Tests**: Test case for "ignoring sentence during playback skips to next"
- **Manual Verification**: Build extension, start reading, click ignore button during playback

## Rollback Plan
- Revert changes to ReadingPane.tsx
