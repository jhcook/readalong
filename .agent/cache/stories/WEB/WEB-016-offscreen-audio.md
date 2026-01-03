---
id: WEB-016
title: Offscreen Audio Playback
status: IMPLEMENTED
owner: User
description: MV3 offscreen document for audio playback when content script audio is blocked.
---

# WEB-016: Offscreen Audio Playback

## State
IMPLEMENTED

## Problem Statement
Manifest V3 restricts audio playback in service workers. Some websites also block Audio elements in content scripts via CSP. An offscreen document provides a reliable context for audio playback.

## User Story
As a system, I need an offscreen document to play audio reliably so that text-to-speech works on all websites regardless of their CSP policies.

## Acceptance Criteria
- [x] Offscreen document is created on demand
- [x] Handles PLAY_AUDIO messages with audio URL or base64 data
- [x] Supports PAUSE_AUDIO and STOP_AUDIO control messages
- [x] Cleans up audio resources when stopped
- [x] Reports playback state back to background script
- [x] Offscreen document is closed when not in use
- [x] Works with cloud TTS providers (ElevenLabs, Google, Resemble)

## Non-Functional Requirements
- Reliability: Audio continues even if content script is blocked
- Performance: Playback starts within 100ms of message receipt

## Linked ADRs
- ADR-001: Hybrid Local + Cloud Architecture

## Impact Analysis Summary
Components touched:
- `offscreen/offscreen.ts` - Message handling and Audio element management
- `offscreen/offscreen.html` - Minimal HTML shell
- `manifest.json` - Offscreen permission declaration

## Test Strategy
- **Manual Verification**: Generate cloud TTS audio, verify playback via offscreen document
- **Edge Cases**: Test on CSP-strict sites like GitHub

## Rollback Plan
- Revert offscreen/ directory and manifest.json offscreen permission
