---
storyId: US8-2
title: Cache Audio Files Runbook
---

# US8-2 Runbook: Cache Audio Files

## Overview
Verification steps for audio caching to speed up repeat playback.

## Prerequisites
- Extension built and loaded
- Cloud TTS configured (ElevenLabs, Google, or Resemble)

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="AudioCache"
```

## Manual Verification

### Test Case 1: Cache on First Play
1. Generate audio for text passage
2. Note generation time
3. Open DevTools > Application > IndexedDB
4. Verify: Audio blob is cached

### Test Case 2: Cache Hit on Repeat
1. Play same passage again
2. Measure time to audio start
3. Verify: Significantly faster than first play
4. Verify: No network request for audio

### Test Case 3: Configurable Cache Size
1. Check settings for cache size option
2. Adjust cache size
3. Verify: Old entries evicted when limit reached

### Test Case 4: Manual Cache Clear
1. Use settings to clear audio cache
2. Verify: Cache is emptied
3. Play audio again
4. Verify: Audio is regenerated

## Expected Results
- Audio cached after first generation
- Cache hits are near-instant
- Cache size is configurable
