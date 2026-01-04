# ReadAlong+: Immersive Reading System
A cross‑platform, privacy‑first read‑along experience for everyone
Supports Chrome, Firefox, Edge, Safari, iOS, Android

## Overview
ReadAlong+ is a hybrid, cross‑platform reading companion that allows users to follow along with stories using custom, personalized voices. While primarily designed to help children develop reading skills through familiar voices (like a parent's), it is built for anyone interested in an immersive reading experience with voices tailored to their liking.

> [!NOTE]
> **Current Status**: The core functionality is currently available as a **Web Extension** for Chrome, Edge, Firefox, and Safari. The mobile app and standalone web app are in the roadmap.

The system is designed to run on:

A custom personalized voice (captured and aligned locally)

A high-quality cloned voice (via ElevenLabs API)

Word‑by‑word or sentence‑by‑sentence highlighting

Simple playback controls (back, forward, pause, repeat)

The system is designed to run on:

Desktop browsers (Chrome, Firefox, Edge, Safari) via extensions

Mobile devices (iOS, Android) via a native app

Web via a responsive reading interface

The architecture prioritizes privacy, offline capability, and high‑quality narration, blending local processing with cloud‑based voice synthesis.

# Key Features
## Custom Voice Integration
Local speech‑to‑text using Whisper.cpp or Vosk

Forced alignment to match spoken words with text

No raw audio leaves the device

## Cloned Voice Narration (Optional)
ElevenLabs API integration

Streaming or pre‑generated TTS

Multiple voice profiles (parent, narrator, characters)

## Read‑Along Highlighting
Word‑level or sentence‑level highlighting

Smooth animations

Accessibility‑friendly color schemes

## Intuitive Playback Controls
Play / Pause

Back one sentence

Forward one sentence

Repeat

Adjustable reading speed

## Cross‑Platform Support
Chrome, Firefox, Edge, Safari (desktop)

iOS & Android (native app)

Web app fallback

## Privacy & Safety
Local‑only voice capture

COPPA‑aligned child mode

Secure storage for alignments and audio

## Architecture
```bash
 ┌──────────────────────────────────────────────────────────────┐
 │                          Front-End UI                        │
 │  (Browser Extension / Mobile App / Web App)                  │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Text Rendering & Highlight Engine            │
 │  (DOM injection or native renderer)                          │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Local Processing Layer                       │
 │  - Whisper.cpp / Vosk STT                                    │
 │  - Forced alignment (Gentle/Aeneas/Whisper timestamps)       │
 │  - Offline mode                                              │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Cloud Integration Layer                      │
 │  - ElevenLabs TTS API                                        │
 │  - Optional cloud STT fallback                               │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Data & Storage Layer                         │
 │  - IndexedDB (browser)                                       │
 │  - Secure storage (mobile)                                   │
 │  - Optional cloud sync                                       │
 └──────────────────────────────────────────────────────────────┘
```

## Project Structure (Proposed)
```bash
readalong-plus/
│
├── extensions/
│   ├── chrome/
│   ├── firefox/
│   ├── edge/
│   └── safari/
│
├── mobile/
│   ├── ios/
│   └── android/
│
├── web/
│   ├── public/
│   └── src/
│
├── core/
│   ├── stt/
│   ├── alignment/
│   ├── highlighting/
│   └── storage/
│
├── api/
│   └── elevenlabs/
│
└── docs/
    ├── architecture/
    ├── user-stories/
    └── roadmap/
```

## Epics & Deliverables
This project is organized into 10 major epics:

Core Text Rendering & Highlighting

Local Speech‑to‑Text

Forced Alignment Engine

ElevenLabs Integration

Intuitive Playback Controls

Browser Extensions

Mobile App

Data & Storage Layer

Privacy & Compliance

UX, Accessibility, Onboarding

Each epic includes fully formed user stories with acceptance criteria (see /docs/user-stories).

## Technology Stack
Frontend
TypeScript

React / React Native / Flutter

WebExtensions API

Safari Web Extension wrapper

Local Processing
Whisper.cpp

Vosk

Gentle / Aeneas

Cloud
ElevenLabs TTS API

Optional cloud STT fallback

Storage
IndexedDB

Secure mobile storage (Keychain/Keystore)

## Privacy Principles
Voice recordings never leave the device

No third‑party analytics in child mode

All cloud calls are opt‑in

COPPA‑aligned design

## Testing Strategy
Unit tests for tokenization, alignment, highlighting

Integration tests for STT + alignment

Browser extension automated tests (Playwright)

Mobile UI tests (Detox / Flutter Driver)

Accessibility audits (WCAG 2.2)

## Roadmap (High‑Level)
Phase 1 — Foundations
Text rendering, highlighting, local STT, basic alignment

Phase 2 — Desktop Extensions
Chrome → Edge → Firefox → Safari

Phase 3 — ElevenLabs Integration
Streaming TTS, voice selection, sync

Phase 4 — Mobile App
iOS + Android with native Whisper modules

Phase 5 — Privacy & UX Hardening
Privacy mode, accessibility, performance

## Contributing
Contributions are welcome. Please see:

/docs/architecture/

/docs/user-stories/

/docs/roadmap/

Before submitting a PR, ensure:

Code is linted

Tests pass

Documentation is updated

## License
To be determined (MIT, Apache 2.0, or proprietary).
