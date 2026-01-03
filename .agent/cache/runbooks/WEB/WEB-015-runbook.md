---
storyId: WEB-015
title: Background Service Worker Runbook
---

# WEB-015 Runbook: Background Service Worker

## Overview
This runbook covers verification of the background service worker's message routing and API proxying.

## Prerequisites
- Extension built and loaded in Chrome
- API keys configured (ElevenLabs, Google, Resemble)

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="index.test|AudioCache"
```

## Manual Verification

### Test Case 1: ElevenLabs Voice Fetch
1. Configure ElevenLabs API key in settings
2. Open voice selection menu
3. Verify: ElevenLabs voices appear in the list

### Test Case 2: Google TTS Synthesis
1. Configure Google service account
2. Select a Chirp voice
3. Start read-aloud
4. Verify: Audio plays correctly

### Test Case 3: Resemble Voice Generation
1. Configure Resemble API key
2. Select a Resemble voice
3. Start read-aloud
4. Verify: Audio plays with word-level timestamps

### Test Case 4: Audio Caching
1. Generate audio for a text passage
2. Note the generation time
3. Play the same passage again
4. Verify: Second playback starts faster (cached)

### Test Case 5: Service Worker Recovery
1. Open chrome://serviceworker-internals
2. Find and stop the extension's service worker
3. Trigger an action (e.g., load text)
4. Verify: Service worker restarts and handles request

### Test Case 6: Error Propagation
1. Use an invalid API key
2. Attempt to fetch voices
3. Verify: Error message appears in UI

## Expected Results
- All API proxying works correctly
- Caching improves repeat performance
- Errors are reported clearly
