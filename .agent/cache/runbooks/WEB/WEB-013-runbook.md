---
storyId: WEB-013
title: Audio Recording & STT Runbook
---

# WEB-013 Runbook: Audio Recording & Speech-to-Text

## Overview
This runbook covers verification of local audio recording and Vosk-based speech-to-text.

## Prerequisites
- Extension built and loaded in Chrome
- Working microphone
- Quiet environment for testing

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="AudioRecorder|SttEngine"
```

## Manual Verification

### Test Case 1: Microphone Permission
1. Open extension on a webpage
2. Click "Record Voice"
3. Verify: Browser permission dialog appears
4. Grant permission
5. Verify: Recording indicator appears

### Test Case 2: Recording Start/Stop
1. Start recording
2. Speak a few sentences
3. Click stop
4. Verify: Recording blob is created (check console)

### Test Case 3: Real-time Transcription
1. Enable STT mode (if available)
2. Speak clearly into microphone
3. Verify: Transcription appears in near real-time (<300ms latency)
4. Verify: Word timestamps are included in results

### Test Case 4: Privacy Verification
1. Open browser DevTools Network tab
2. Record audio
3. Verify: No audio data is sent to external servers
4. Verify: All processing happens locally

### Test Case 5: Permission Denial
1. Deny microphone permission
2. Attempt to record
3. Verify: Clear error message is displayed

## Expected Results
- Microphone permission requested clearly
- Recording works reliably
- No cloud transmission of audio
