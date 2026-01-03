---
id: WEB-015
title: Background Service Worker
status: IMPLEMENTED
owner: User
description: Central message router and API proxy for extension communication in MV3.
---

# WEB-015: Background Service Worker

## State
IMPLEMENTED

## Problem Statement
Manifest V3 extensions cannot make cross-origin requests from content scripts. All API calls to ElevenLabs, Google Cloud, and Resemble must be proxied through the background service worker. Additionally, audio caching improves performance for repeated playback.

## User Story
As a system, I need a central service worker to route messages and proxy API requests so that content scripts can access cloud services securely.

## Acceptance Criteria
- [x] Message router dispatches to appropriate handlers
- [x] ElevenLabs handler fetches voices and generates audio
- [x] Google handler fetches voices and synthesizes with Chirp voices
- [x] Resemble handler fetches voices and generates audio with timestamps
- [x] STT handler processes speech-to-text requests
- [x] Audio handler manages playback in offscreen document
- [x] `AudioCache` stores generated audio in IndexedDB
- [x] `GoogleAuth` manages service account authentication
- [x] Errors are propagated back to content scripts

## Non-Functional Requirements
- Reliability: Service worker restarts gracefully after termination
- Security: API keys stored securely, not exposed to content scripts

## Linked ADRs
- ADR-001: Hybrid Local + Cloud Architecture

## Impact Analysis Summary
Components touched:
- `background/index.ts` - Message router
- `background/handlers/audioHandler.ts` - Offscreen audio control
- `background/handlers/elevenLabsHandler.ts` - ElevenLabs API
- `background/handlers/googleHandler.ts` - Google Cloud TTS API
- `background/handlers/resembleHandler.ts` - Resemble AI API
- `background/handlers/sttHandler.ts` - Speech-to-text API
- `background/AudioCache.ts` - IndexedDB audio cache
- `background/GoogleAuth.ts` - Service account JWT auth

## Test Strategy
- **Automated Tests**: `index.test.ts`, `AudioCache.test.ts`
- **Manual Verification**: Generate audio, verify caching, check API responses

## Rollback Plan
- Revert background/ directory
