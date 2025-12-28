---
id: WEB-001
title: Implement Text-to-Speech Playback
status: IMPLEMENTED
owner: User
description: Implement text-to-speech functionality to allow the user to listen to the text being read aloud, with word-level highlighting.
---

# User Story

As a user, I want to have the text read back to me using synthesized speech so that I can listen to the content instead of just reading it.

# Acceptance Criteria
- [x] Clicking the "Cloud TTS" button initiates text-to-speech playback. (Implemented as "Read Aloud")
- [x] The text is read aloud using the browser's `speechSynthesis` API.
- [x] Words are highlighted in real-time as they are spoken (using `onboundary` events if available).
- [x] The playback can be paused and resumed.
- [x] The "Cloud TTS" button state reflects the current status (Play/Pause).
