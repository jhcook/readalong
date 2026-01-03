---
id: WEB-012
title: Text Tokenization Engine
status: IMPLEMENTED
owner: User
description: Tokenize extracted text into sentences and words for audio-text synchronization.
---

# WEB-012: Text Tokenization Engine

## State
IMPLEMENTED

## Problem Statement
Text-to-speech highlighting requires precise word and sentence boundaries. Native segmentation APIs handle edge cases poorly (abbreviations, hyphenated words, punctuation attachment).

## User Story
As a system, I need to break text into sentences and words with accurate boundaries so that highlighting can synchronize with audio playback.

## Acceptance Criteria
- [x] Uses `Intl.Segmenter` for language-aware segmentation
- [x] Handles common abbreviations (Mr., Dr., Jan., etc.) without false sentence breaks
- [x] Preserves hyphenated words as single tokens
- [x] Attaches punctuation to preceding words correctly
- [x] Produces `AlignmentMap` structure with sentence and word indices
- [x] Handles empty/whitespace-only input gracefully

## Non-Functional Requirements
- Performance: Tokenizes 10KB text in under 50ms
- Accuracy: 99%+ correct sentence boundaries on English text

## Linked ADRs
- ADR-001: Hybrid Local + Cloud Architecture

## Impact Analysis Summary
Components touched:
- `tokenizer.ts` - Main tokenization function
- `types.ts` - AlignmentMap, Sentence, Word interfaces

## Test Strategy
- **Automated Tests**: `tokenizer.test.ts`, `tokenizer.repro.test.ts`
- **Manual Verification**: Paste text with abbreviations, verify sentence splits

## Rollback Plan
- Revert tokenizer.ts changes
