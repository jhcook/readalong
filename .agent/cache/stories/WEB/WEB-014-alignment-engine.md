---
id: WEB-014
title: Forced Alignment Engine
status: IMPLEMENTED
owner: User
description: Align spoken words to reference text using Levenshtein distance matching for accurate highlighting.
---

# WEB-014: Forced Alignment Engine

## State
IMPLEMENTED

## Problem Statement
Speech recognition output rarely matches reference text exactly due to paraphrasing, filler words, and transcription errors. We need fuzzy matching to align spoken words to text for accurate highlighting during recorded playback.

## User Story
As a system, I need to align transcribed words to the reference text so that highlighting is accurate even when the speaker paraphrases or skips words.

## Acceptance Criteria
- [x] `Aligner` class maintains cursor position through reference text
- [x] Uses Levenshtein distance for fuzzy word matching
- [x] Configurable search window (default: 10 words ahead)
- [x] Configurable max distance threshold (default: 2)
- [x] Updates word objects with timing information in-place
- [x] Handles skipped words gracefully (logs and continues)
- [x] Handles extra spoken words (insertions) by skipping them
- [x] Produces confidence scores per word

## Non-Functional Requirements
- Performance: Aligns 100 words in under 10ms
- Accuracy: Correctly aligns 95%+ of clearly spoken words

## Linked ADRs
- ADR-001: Hybrid Local + Cloud Architecture

## Impact Analysis Summary
Components touched:
- `alignment/Aligner.ts` - Core alignment logic
- Uses `fastest-levenshtein` library for edit distance

## Test Strategy
- **Automated Tests**: `Aligner.test.ts`
- **Manual Verification**: Record speech with paraphrasing, verify highlighting tracks correctly

## Rollback Plan
- Revert alignment/ directory
