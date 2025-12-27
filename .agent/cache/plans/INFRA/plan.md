# 📘 High‑Level Plan: Cross‑Browser, Cross‑Device Read‑Along System
Parent‑Voice Narration + Text Highlighting + Child Controls
Supports Chrome, Firefox, Edge, Safari on Desktop & Mobile

## 1. Program Overview
A cross‑platform read‑along system that:
* Highlights text word‑by‑word
* Syncs to parent’s real voice (local STT + alignment)
* Optionally syncs to parent’s cloned voice (ElevenLabs API)
* Provides child‑friendly controls (back, forward, pause, repeat)
* Works on desktop browsers, mobile browsers, and mobile apps
* Uses a hybrid architecture for privacy, performance, and quality

## Architecture Overview

 ┌──────────────────────────────────────────────────────────────┐
 │                          Front-End UI                        │
 │  (Browser Extension on Desktop / WebView in Mobile App)      │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Text Rendering & Highlight Engine            │
 │  (DOM injection on desktop / in-app renderer on mobile)      │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Local Processing Layer                       │
 │  - Whisper.cpp or Vosk STT                                   │
 │  - Forced alignment (Gentle/Aeneas/Whisper timestamps)       │
 │  - Local caching & offline mode                              │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Cloud Integration Layer                      │
 │  - ElevenLabs API (TTS, cloned voice)                        │
 │  - Optional cloud STT fallback                               │
 └──────────────────────────────────────────────────────────────┘
                 │
                 ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 Data & Storage Layer                         │
 │  - Local storage (browser)                                   │
 │  - Secure mobile storage                                     │
 │  - Optional cloud sync                                       │
 └──────────────────────────────────────────────────────────────┘

## 3. Epics & High‑Level Deliverables
### Epic 1 — Core Text Rendering & Highlighting Engine
Goal: Render text and highlight words in sync with audio.
Features
F1.1: Text ingestion (webpage extraction, file upload, or pasted text)
F1.2: Sentence and word tokenization
F1.3: Highlight engine with animation states
F1.4: Multi‑mode highlighting (word, sentence, paragraph)
F1.5: Accessibility modes (contrast, dyslexia font, zoom)

### Epic 2 — Local Speech‑to‑Text (Parent Voice Capture)
Goal: Capture parent’s voice and align it to text locally.
Features
F2.1: Whisper.cpp  integration (desktop + mobile)
F2.2: Real‑time STT streaming
F2.3: Offline mode support
F2.4: Timestamp extraction
F2.5: Error handling for background noise, interruptions

### Epic 3 — Forced Alignment Engine
Goal: Map spoken words to text for accurate highlighting.
Features
F3.1: Alignment using Whisper timestamps
F3.2: Optional Gentle/Aeneas alignment for refinement
F3.3: Handling paraphrasing, skipped words, and natural speech
F3.4: Alignment confidence scoring
F3.5: Alignment caching for re‑use

### Epic 4 — ElevenLabs Integration (Cloned Voice Playback)
Goal: Generate high‑quality narration in the parent’s cloned voice.
Features
F4.1: ElevenLabs API integration
F4.2: Streaming TTS support
F4.3: Voice selection UI (parent, narrator, characters)
F4.4: Audio caching for offline playback
F4.5: Syncing TTS audio with highlight engine

### Epic 5 — Child Playback Controls
Goal: Provide intuitive controls for children.
Features
F5.1: Play / Pause
F5.2: Back one word / sentence
F5.3: Forward one word / sentence
F5.4: Repeat sentence
F5.5: Speed control
F5.6: Touch‑friendly UI for mobile

### Epic 6 — Browser Extension (Desktop)
Goal: Support Chrome, Firefox, Edge, Safari (macOS).
Features
F6.1: Manifest V3 extension (Chrome/Edge)
F6.2: Firefox extension (Manifest V2 compatibility layer)
F6.3: Safari Web Extension (Xcode wrapper)
F6.4: Content script for DOM injection
F6.5: Background worker for STT + alignment
F6.6: Permissions & sandboxing compliance

### Epic 7 — Mobile App (iOS + Android)
Goal: Provide full functionality on mobile devices.
Features
F7.1: React Native or Flutter app shell
F7.2: Embedded WebView for reading mode
F7.3: Native modules for Whisper.cpp
F7.4: Local secure storage
F7.5: Offline mode
F7.6: Child‑safe UI

### Epic 8 — Data & Storage Layer
Goal: Store alignments, audio, and reading progress.
Features
F8.1: Local browser storage (IndexedDB)
F8.2: Mobile secure storage (Keychain/Keystore)
F8.3: Optional cloud sync (parent login)
F8.4: Versioned alignment maps
F8.5: Cleanup & retention policies

### Epic 9 — Privacy, Security, and Compliance
Goal: Ensure safe handling of parent and child data.
Features
F9.1: Local‑only voice capture
F9.2: Encryption at rest (mobile)
F9.3: No raw audio sent to cloud unless explicitly enabled
F9.4: COPPA‑aligned child safety controls
F9.5: Permissions transparency

### Epic 10 — UX, Accessibility, and Onboarding
Goal: Make the experience intuitive for parents and children.
Features
F10.1: Parent onboarding flow
F10.2: Child mode with simplified UI
F10.3: Voice setup wizard
F10.4: Reading progress tracking
F10.5: Accessibility compliance (WCAG 2.2)

## 4. Cross‑Platform Support Matrix
Component	Chrome	Firefox	Edge	Safari (macOS)	iOS	Android
Browser Extension	✔️	✔️	✔️	✔️ (via Xcode wrapper)	❌	❌
Web App	✔️	✔️	✔️	✔️	✔️	✔️
Local STT	✔️	✔️	✔️	✔️	✔️ (native)	✔️ (native)
ElevenLabs API	✔️	✔️	✔️	✔️	✔️	✔️
Highlight Engine	✔️	✔️	✔️	✔️	✔️	✔️
Child Controls	✔️	✔️	✔️	✔️	✔️	✔️

## 5. Delivery Roadmap (High‑Level)
Phase 1 — Foundations (Weeks 1–6)
Text renderer
Highlight engine
Whisper.cpp  integration
Basic alignment

Phase 2 — Desktop Browser Extensions (Weeks 6–14)
Chrome/Edge extension
Firefox port
Safari Web Extension

Phase 3 — ElevenLabs Integration (Weeks 14–20)
TTS streaming
Voice selection
Sync with highlighting

Phase 4 — Mobile App (Weeks 20–32)
React Native/Flutter shell
Native Whisper modules
Child‑friendly UI

Phase 5 — Privacy, UX, and Hardening (Weeks 32–40)
COPPA alignment
Accessibility
Performance tuning


