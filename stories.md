## Epic 1 — Core Text Rendering & Highlighting Engine
US1.1 — Ingest Text From Webpage
As a parent I want to load text from the current webpage So that I can read along or generate narration.

Acceptance Criteria
AC1: User can click “Load Text” in the extension/app.
AC2: System extracts visible text from the DOM.
AC3: System removes ads, navigation, and irrelevant elements.
AC4: Extracted text is displayed in a clean reading pane.
AC5: Errors are shown if extraction fails.

US1.2 — Tokenize Text Into Sentences and Words
As a system I want to break text into sentences and words So that highlighting can sync with audio.

Acceptance Criteria
AC1: Text is split into sentences using NLP rules.
AC2: Sentences are split into words with punctuation handling.
AC3: Tokenization works for English initially.
AC4: Tokenization output is stored for alignment.

US1.3 — Highlight Words in Sync
As a child I want words to highlight as they are spoken So that I can follow along easily.

Acceptance Criteria
AC1: Highlighting updates at least 30fps.
AC2: Only one word is highlighted at a time.
AC3: Highlight color meets accessibility contrast standards.
AC4: Highlighting pauses when audio pauses.
AC5: Highlighting resumes correctly after pause.

US1.4 — Accessibility Modes
As a parent I want to enable dyslexia‑friendly and high‑contrast modes So that my child can read comfortably.

Acceptance Criteria
AC1: User can toggle dyslexia font.
AC2: User can toggle high‑contrast mode.
AC3: Settings persist locally.

## Epic 2 — Local Speech‑to‑Text (Parent Voice Capture)
US2.1 — Capture Parent’s Voice Locally
As a parent I want the system to capture my voice locally So that my child’s data stays private.

Acceptance Criteria
AC1: Microphone access is requested with clear permission text.
AC2: Audio is processed locally (no cloud transmission).
AC3: Recording can be started/stopped manually.
AC4: Errors are shown if microphone access is denied.

US2.2 — Real‑Time STT Transcription
As a system I want to transcribe speech in real time So that I can align spoken words to text.

Acceptance Criteria
AC1: Whisper.cpp  or Vosk runs locally.
AC2: Transcription latency is under 300ms.
AC3: Timestamps are generated for each word or phrase.
AC4: Transcription accuracy is logged for debugging.

US2.3 — Offline Mode
As a parent I want the system to work without internet So that my child can read anywhere.

Acceptance Criteria
AC1: Local STT works offline.
AC2: Highlighting works offline.
AC3: ElevenLabs features are disabled with clear messaging.

## Epic 3 — Forced Alignment Engine
US3.1 — Align Spoken Words to Text
As a system I want to align timestamps to text tokens So that highlighting is accurate.

Acceptance Criteria
AC1: Alignment uses Whisper timestamps or Gentle/Aeneas.
AC2: Alignment handles skipped words gracefully.
AC3: Alignment produces a confidence score per word.
AC4: Alignment is stored for reuse.

US3.2 — Handle Paraphrasing
As a parent I want the system to tolerate natural speech variations So that I don’t have to read perfectly.

Acceptance Criteria
AC1: Minor paraphrasing does not break alignment.
AC2: System skips unmatched words with fallback logic.
AC3: Highlighting continues smoothly.

## Epic 4 — ElevenLabs Integration
US4.1 — Generate Audio in Parent’s Cloned Voice
As a parent I want to generate narration in my cloned voice So that my child can listen even when I’m not reading.

Acceptance Criteria
AC1: User can select a cloned voice.
AC2: Text is sent to ElevenLabs API.
AC3: Audio is returned and cached locally.
AC4: Errors are shown if API fails.

US4.2 — Stream TTS Audio
As a child I want narration to start quickly So that I don’t wait for full audio generation.

Acceptance Criteria
AC1: Streaming TTS begins playback within 1 second.
AC2: Highlighting syncs with streaming timestamps.
AC3: Playback handles network interruptions gracefully.

## Epic 5 — Child Playback Controls
US5.1 — Play/Pause Narration
As a child I want to pause and resume So that I can follow at my own pace.

Acceptance Criteria
AC1: Play/pause button is large and touch‑friendly.
AC2: Highlighting pauses/resumes with audio.
AC3: State persists if the app is backgrounded.

US5.2 — Back One Sentence
As a child I want to go back one sentence So that I can re‑read something I missed.

Acceptance Criteria
AC1: Back button jumps to previous sentence.
AC2: Highlighting updates immediately.
AC3: Audio restarts from the beginning of that sentence.

US5.3 — Forward One Sentence
As a child I want to skip ahead So that I can move faster.

Acceptance Criteria
AC1: Forward button jumps to next sentence.
AC2: Highlighting updates immediately.
AC3: Audio restarts from the beginning of that sentence.

## Epic 6 — Browser Extension (Desktop)
US6.1 — Install Extension
As a parent I want to install the extension easily So that I can use it on any webpage.

Acceptance Criteria
AC1: Extension is available for Chrome, Firefox, Edge, Safari.
AC2: Installation instructions are provided.
AC3: Permissions are clearly explained.

US6.2 — Inject Reading UI Into Webpage
As a child I want a simple reading interface So that I can focus on the story.

Acceptance Criteria
AC1: UI overlays cleanly on any webpage.
AC2: UI can be minimized or closed.
AC3: UI does not break page layout.

## Epic 7 — Mobile App (iOS + Android)
US7.1 — Launch Mobile App
As a parent I want a mobile app So that my child can read on a tablet or phone.

Acceptance Criteria
AC1: App installs on iOS and Android.
AC2: App opens to a simple home screen.
AC3: Permissions are requested clearly.

US7.2 — Read in Mobile WebView
As a child I want to read inside the app So that I don’t need a browser.

Acceptance Criteria
AC1: Text loads in a WebView or native renderer.
AC2: Highlighting works identically to desktop.
AC3: Child controls are touch‑optimized.

## Epic 8 — Data & Storage Layer
US8.1 — Save Alignment Maps Locally
As a system I want to store alignment data So that playback is fast on repeat reads.

Acceptance Criteria
AC1: Alignment maps stored in IndexedDB (browser).
AC2: Alignment maps stored in secure storage (mobile).
AC3: Storage is versioned.

US8.2 — Cache Audio Files
As a child I want narration to load quickly So that I can start reading immediately.

Acceptance Criteria
AC1: Audio is cached after first generation.
AC2: Cache size is configurable.
AC3: Cache can be cleared manually.

## Epic 9 — Privacy, Security, Compliance
US9.1 — Local‑Only Voice Capture
As a parent I want my voice to stay on the device So that my privacy is protected.

Acceptance Criteria
AC1: No raw audio is sent to cloud.
AC2: Local STT is used by default.
AC3: UI clearly indicates local processing.

US9.2 — Child‑Safe Mode
As a parent I want a restricted mode So that my child cannot access unsafe content.

Acceptance Criteria
AC1: Child mode hides advanced settings.
AC2: Child mode locks with a PIN.
AC3: Child mode restricts external links.

## Epic 10 — UX, Accessibility, Onboarding
US10.1 — Parent Onboarding
As a parent I want a simple setup flow So that I can start reading quickly.

Acceptance Criteria
AC1: Onboarding explains voice capture.
AC2: Onboarding explains ElevenLabs integration.
AC3: Onboarding takes under 2 minutes.

US10.2 — Child‑Friendly UI
As a child I want a simple interface So that I can use it without help.

Acceptance Criteria
AC1: Buttons are large and labeled with icons.
AC2: No more than 3 primary actions visible.
AC3: UI uses friendly colors and animations.
