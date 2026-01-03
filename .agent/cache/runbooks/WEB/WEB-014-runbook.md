---
storyId: WEB-014
title: Forced Alignment Engine Runbook
---

# WEB-014 Runbook: Forced Alignment Engine

## Overview
This runbook covers verification of the Levenshtein-based word alignment for recorded voice playback.

## Prerequisites
- Extension built and loaded in Chrome
- Working microphone
- Test text for recording

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="Aligner"
```

## Manual Verification

### Test Case 1: Exact Match Alignment
1. Load a short text: "The quick brown fox jumps over the lazy dog."
2. Record yourself reading it exactly
3. Play back the recording
4. Verify: Each word highlights in sync with audio

### Test Case 2: Paraphrasing Tolerance
1. Load text: "The quick brown fox jumps."
2. Record yourself saying: "A quick brown fox jumps."
3. Play back
4. Verify: Highlighting still tracks despite "The" vs "A" mismatch

### Test Case 3: Skipped Words
1. Load text: "The quick brown fox jumps over the lazy dog."
2. Record yourself skipping "brown": "The quick fox jumps over the lazy dog."
3. Play back
4. Verify: Highlighting skips "brown" gracefully, continues with "fox"

### Test Case 4: Extra Words (Filler)
1. Load text: "The fox jumps."
2. Record yourself adding fillers: "The, um, fox, uh, jumps."
3. Play back
4. Verify: Highlighting ignores filler words, tracks "The", "fox", "jumps"

### Test Case 5: Partial Recording
1. Load long text (3+ sentences)
2. Record only the first sentence
3. Play back
4. Verify: Highlighting stops at end of recorded content

## Expected Results
- Accurate alignment for clean speech
- Graceful degradation for paraphrasing
- Smooth highlighting without jumps
