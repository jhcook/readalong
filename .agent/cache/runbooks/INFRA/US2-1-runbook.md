# US2-1: Capture Parent’s Voice Locally

Status: COMPLETED

## Goal Description
Implement audio recording functionality within the browser extension using the `MediaRecorder` API. This feature must operate entirely locally to respect privacy (ADR-008).

## Panel Review Findings
- **@Architect**: Validated. Use `MediaRecorder` API. It is standard in modern browsers.
- **@Security**: Validated. Ensure no data is sent to any external endpoint.
- **@QA**: Validated. Test permissions denial and success flows. Verify supported MIME types (usually `audio/webm` or `audio/mp4`).
- **@Observability**: Validated. Log permission success/failure events.

## Implementation Steps

### 1. Audio Recorder Service
#### [NEW] [web/extension/src/content/audio/AudioRecorder.ts](web/extension/src/content/audio/AudioRecorder.ts)
- Class `AudioRecorder`.
- Methods: `start()`, `stop()`, `isRecording()`, `requestPermission()`.
- Use `navigator.mediaDevices.getUserMedia`.
- Handle permission errors.

### 2. UI Integration
#### [MODIFY] [web/extension/src/content/ReadingPane.tsx](web/extension/src/content/ReadingPane.tsx)
- Add "Record" button (microphone icon).
- Handle recording state (recording vs idle).
- Show visual feedback (recording indicator).
- Handle permission denial alerts.

### 3. Permissions
#### [MODIFY] [web/extension/public/manifest.json](web/extension/public/manifest.json)
- Add `capture_audio` permission (actually for extension pages, content scripts usually rely on page permissions, but we might need to inject an iframe or handle it carefully. Note: Content scripts cannot directly access `getUserMedia` in some contexts without user interaction or if restricted by CSP. We might need to do this in the Popup or a separate tab if content script fails, but let's try content script first as it's part of the overlay).
- *Correction*: `getUserMedia` in content scripts is tricky. A common pattern is to use an offscreen document or do it in the popup. However, `ReadingPane` is injected into the page. It acts like the page. If the page is `https`, it should work if the user grants permission to the page. *Better approach for extensions*: Use an offscreen document or the background/popup context if possible, OR if injected, it relies on the host page context.
- *Decision*: We will attempt to run it in the `ReadingPane` (context of the page). If that fails due to page CSP, we might need a fallback. For US2-1, we assume standard `https` pages.

## Verification Plan
### Automated Tests
- [x] Unit tests for `AudioRecorder` (mocking `navigator.mediaDevices`).
- [x] Integration test: verify `start()` calls `getUserMedia`.

### Manual Verification
- [x] Click Record.
- [x] Accept Permissions.
- [x] Verify "Recording..." state.
- [x] Click Stop.
- [x] Verify AudioBlob is available (log size).
