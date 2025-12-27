# Critical User Flows

This document defines the critical user journeys that MUST be covered by automated E2E tests (Playwright for Web, Maestro for Mobile).

## 1. Authentication
*   **Sign Up**: User can create a new account (Email/Password).
*   **Login**: User can log in with existing credentials.
*   **Logout**: User can securely log out.
*   **Session Persistence**: User remains logged in after app restart (Mobile) or refresh (Web).

## 2. Core Functionality - Read Along
*   **New Conversation**: User can start a new session.
*   **Send Message**: User can send commands and receive a streaming response.
*   **Context usage**: Verify the text is highlighted in sync with the audio.
*   **Chat History**: User can rewind and fast forward and pause the session.

## 3. Settings & Account
*   **Profile Update**: User can update their display name.
*   **Subscription**: User can view their current plan (Free/Pro).

# App Functionality

## 1. Parent Voice Capture (Local STT)
Description
Capture the parent’s live voice, transcribe it locally, and generate timestamps for alignment.

Entry Points
Browser extension microphone access

Mobile app microphone access

Success Criteria
Microphone permission granted

Whisper.cpp/Vosk  starts streaming within 300ms

Transcription accuracy ≥ 85% for children’s literature

Word‑level timestamps generated

Failure Modes
Permission denied

Background noise reduces accuracy

STT engine fails to initialize

Mitigations
Clear permission prompts

Noise suppression

Retry logic with fallback messaging

## 2. Forced Alignment (Speech ↔ Text Mapping)
Description
Align spoken words to the text to enable precise highlighting.

Entry Points
After STT transcription

After loading text

Success Criteria
Alignment map generated with ≥ 90% sentence coverage

Graceful handling of paraphrasing

Confidence scores available

Failure Modes
Parent deviates heavily from text

Whisper timestamps insufficient

Alignment engine crashes

Mitigations
Fuzzy matching

Sentence‑level fallback

Alignment caching

## 3. Highlighting Engine (Real‑Time Sync)
Description
Highlight words or sentences in sync with audio or live speech.

Entry Points
Live reading

Cloned voice playback

Success Criteria
Highlight updates at ≥ 30fps

No drift between audio and text

Works across browsers and mobile

Failure Modes
DOM injection blocked

Animation lag

Incorrect tokenization

Mitigations
Virtualized rendering

Pre‑computed token maps

Browser‑specific fallbacks

## 4. Cloned Voice Narration (ElevenLabs API)
Description
Generate or stream narration in the parent’s cloned voice.

Entry Points
“Play in Parent’s Voice” button

Auto‑play after alignment

Success Criteria
Streaming starts within 1 second

Audio matches text boundaries

Caching works offline

Failure Modes
API unavailable

Network latency

Voice model missing

Mitigations
Retry with exponential backoff

Offline fallback to real‑voice alignment

Clear error messaging

## 5. Child Playback Controls (Navigation & Sync)
Description
Allow children to navigate the story safely and intuitively.

Entry Points
Play

Pause

Back

Forward

Repeat

Success Criteria
Controls respond within 100ms

Highlighting and audio remain in sync

Touch‑friendly on mobile

Failure Modes
Jumping breaks alignment

Audio desync

UI unresponsive

Mitigations
Pre‑indexed sentence boundaries

Audio seek with timestamp correction

Debounced input

## 6. Browser Extension Injection (Desktop)
Description
Inject reading UI into any webpage without breaking layout.

Entry Points
Extension icon click

Auto‑detect reading mode

Success Criteria
UI overlays cleanly

Text extraction succeeds

No interference with site scripts

Failure Modes
Shadow DOM conflicts

CSP restrictions

Dynamic content changes

Mitigations
Shadow DOM isolation

Fallback to manual text paste

Mutation observers

## 7. Mobile App Reading Flow (iOS & Android)
Description
Provide a consistent reading experience on mobile devices.

Entry Points
App home screen

“Start Reading” button

Success Criteria
Text loads in WebView or native renderer

Highlighting matches desktop behavior

Whisper.cpp  runs via native module

Failure Modes
Mobile CPU throttling

Background app suspension

Microphone permission issues

Mitigations
Model quantization

State persistence

Permission onboarding

## 8. Offline Mode (Local‑Only Operation)
Description
Allow reading without internet access.

Entry Points
No network detected

Parent selects “Offline Mode”

Success Criteria
Local STT works

Highlighting works

Cached audio plays

Failure Modes
No cached audio

Alignment missing

Whisper model not downloaded

Mitigations
Pre‑download prompt

Local alignment fallback

Graceful degradation

## 9. Data Persistence (Alignment + Audio Caching)
Description
Store alignment maps, audio files, and progress.

Entry Points
After alignment

After TTS generation

Success Criteria
IndexedDB (browser) and secure storage (mobile)

Versioned alignment maps

Cache eviction policy

Failure Modes
Storage quota exceeded

Corrupted alignment map

Cache mismatch

Mitigations
LRU eviction

Integrity checks

Rebuild alignment on demand

## 10. Child‑Safe Mode (Restricted UX)
Description
Provide a safe, simplified interface for children.

Entry Points
Parent enables Child Mode

App auto‑detects child profile

Success Criteria
Minimal UI

No external links

PIN‑locked settings

Failure Modes
Child escapes to parent mode

UI too complex

Unsafe content exposed

Mitigations
Strong PIN enforcement

UI simplification rules

Content filtering

## 🧪 Testing Requirements for Critical Flows
Each flow must be validated through:

Unit tests

Integration tests

Cross‑browser tests

Mobile device tests

Performance benchmarks

Accessibility audits

Privacy compliance checks

A flow is considered release‑blocking if any critical path fails.

## 🏁 Summary
These critical flows define the non‑negotiable backbone of ReadAlong+.
If any of these fail, the product fails its core promise.

This document should be used for:

Release gating

Architecture reviews

Test planning

Risk assessment

Developer onboarding
