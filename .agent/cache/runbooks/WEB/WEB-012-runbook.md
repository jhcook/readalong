---
storyId: WEB-012
title: Text Tokenization Runbook
---

# WEB-012 Runbook: Text Tokenization Engine

## Overview
This runbook covers verification of sentence and word tokenization.

## Prerequisites
- Extension built and loaded in Chrome
- Test content with various edge cases

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="tokenizer"
```

## Manual Verification

### Test Case 1: Abbreviation Handling
1. Load text containing: "Dr. Smith met Mr. Jones on Jan. 19."
2. Start read-aloud playback
3. Verify: This is treated as ONE sentence, not split at periods

### Test Case 2: Hyphenated Words
1. Load text containing: "The well-known sub-agents performed self-analysis."
2. Start playback
3. Verify: Hyphenated words highlight as single units

### Test Case 3: Long Content Performance
1. Navigate to a Wikipedia article (10KB+ of text)
2. Click "Load Text"
3. Verify: Tokenization completes in under 50ms (check console)

### Test Case 4: Punctuation Attachment
1. Load text containing: "Hello, world! How are you?"
2. Start playback
3. Verify: Commas and punctuation attach to preceding words

### Test Case 5: Quote Handling
1. Load text containing: She said, "Hello there."
2. Verify: Quotes are preserved and sentences are not split incorrectly

## Expected Results
- Abbreviations don't cause false sentence breaks
- Hyphenated words stay together
- Punctuation attaches to preceding words
