---
storyId: WEB-016
title: Offscreen Audio Playback Runbook
---

# WEB-016 Runbook: Offscreen Audio Playback

## Overview
This runbook covers verification of the MV3 offscreen document for audio playback.

## Prerequisites
- Extension built and loaded in Chrome
- Cloud TTS provider configured (ElevenLabs, Google, or Resemble)

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Manual Verification

### Test Case 1: Basic Offscreen Playback
1. Navigate to any website
2. Load text and start cloud TTS playback
3. Open chrome://extensions and inspect the offscreen document
4. Verify: Offscreen document is created
5. Verify: Audio plays correctly

### Test Case 2: CSP-Strict Site
1. Navigate to github.com (has strict CSP)
2. Load text from the page
3. Start cloud TTS playback
4. Verify: Audio plays despite CSP restrictions

### Test Case 3: Pause/Resume
1. Start playback
2. Click pause
3. Verify: Audio pauses
4. Click resume
5. Verify: Audio resumes from correct position

### Test Case 4: Stop and Cleanup
1. Start playback
2. Click stop
3. Inspect offscreen document
4. Verify: Audio resources are cleaned up

### Test Case 5: Multiple Playback Sessions
1. Play audio, then stop
2. Navigate to different page
3. Play audio again
4. Verify: No leftover state from previous session

### Test Case 6: Offscreen Document Lifecycle
1. Start and stop playback several times
2. Wait 30 seconds of inactivity
3. Check chrome://extensions
4. Verify: Offscreen document is closed when idle

## Expected Results
- Reliable audio playback on all sites
- Proper cleanup on stop
- No memory leaks
