---
id: WEB-013
title: Audio Recording & Speech-to-Text
status: IMPLEMENTED
owner: User
description: Local microphone capture and real-time speech-to-text using Vosk in a sandboxed iframe.
---

# WEB-013: Audio Recording & Speech-to-Text

## State
IMPLEMENTED

## Problem Statement
To enable parent voice recording without cloud transmission, we need local audio capture and speech-to-text processing. Browser security constraints require Vosk to run in a sandboxed context.

## User Story
As a parent, I want to record my voice locally so that my child's data stays private and I can create personalized narrations.

## Acceptance Criteria
- [x] `AudioRecorder` requests microphone permission with clear messaging
- [x] Audio is captured using MediaRecorder API
- [x] Recording can be started/stopped manually
- [x] `SttEngine` runs Vosk in a sandboxed iframe
- [x] Real-time transcription results are dispatched as custom events
- [x] Word-level timestamps are provided for alignment
- [x] No raw audio is transmitted to cloud services

## Non-Functional Requirements
- Privacy: All audio processing is local-only
- Latency: Transcription results within 300ms of speech
- Compatibility: Works in Chrome, Edge (MV3 compatible)

## Linked ADRs
- ADR-001: Hybrid Local + Cloud Architecture

## Impact Analysis Summary
Components touched:
- `audio/AudioRecorder.ts` - Microphone capture
- `audio/SttEngine.ts` - Vosk sandbox communication
- `sandbox/sandbox.ts` - Vosk model loading and recognition
- `public/sandbox.html` - Sandbox iframe HTML

## Test Strategy
- **Automated Tests**: `AudioRecorder.test.ts`, `SttEngine.test.ts`
- **Manual Verification**: Record audio, verify transcription events fire

## Rollback Plan
- Revert audio/ directory and sandbox files
