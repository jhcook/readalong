# US2-2: Real‑Time STT Transcription

Status: COMPLETED

## Goal Description
Integrate a local Speech-to-Text engine to transcribe audio in real-time within the browser. We will use `vosk-browser` (WASM) to fulfill the requirement for local processing without cloud dependencies.

## Panel Review Findings
- **@Architect**: Validated. `vosk-browser` runs in a Web Worker, keeping the main thread free. WASM is suitable for this.
- **@Security**: Validated. No data leaves the browser. Models are loaded locally or from a trusted CDN (we should prefer bundling or caching a small model).
- **@QA**: Validated. Testing should focus on transcription accuracy and latency.
- **@Observability**: Validated. Log STT initialization, errors, and recognition confidence.

## Implementation Steps

### 1. Dependencies
#### [MODIFY] [web/extension/package.json](web/extension/package.json)
- Install `vosk-browser`.
- Ensure `copy-webpack-plugin` is configured to copy the WASM and model files (if bundling).

### 2. STT Service
#### [NEW] [web/extension/src/content/audio/SttEngine.ts](web/extension/src/content/audio/SttEngine.ts)
- Class `SttEngine`.
- Initialize `vosk-browser`.
- Load model (use a small English model, potentially fetching from a URL for the prototype or bundling if size permits. For this exercise, we might mock the actual heavy lifting if the model is too big, but the goal is "runs locally". We can point to the official Vosk small model URL).
- Methods: `processAudio(audioData: Float32Array)`, `start()`, `stop()`.
- Event listeners for partial and final results.

### 3. Integration with AudioRecorder
#### [MODIFY] [web/extension/src/content/audio/AudioRecorder.ts](web/extension/src/content/audio/AudioRecorder.ts)
- Update `AudioRecorder` to emit audio data chunks (e.g., via a callback or stream) to `SttEngine` instead of just accumulating a blob.
- `AudioContext` / `ScriptProcessorNode` or `AudioWorklet` might be needed to get raw PCM data for Vosk. `MediaRecorder` gives encoded chunks (webm), which Vosk might not take directly without decoding. **Correction**: `vosk-browser` usually handles microphone input or requires an AudioContext source. We should refactor `AudioRecorder` to use `AudioContext` for real-time processing.

### 4. UI Display
#### [MODIFY] [web/extension/src/content/ReadingPane.tsx](web/extension/src/content/ReadingPane.tsx)
- Display live transcription results (optional for this story, but good for debugging AC4).

## Verification Plan
### Automated Tests
- [x] Unit test `SttEngine` (mocking the worker/WASM loading).
- [x] Verify `AudioRecorder` streams data.

### Manual Verification
- [x] Start recording.
- [x] Speak into microphone.
- [x] Check console logs for "Partial result" or "Final result".
- [x] Verify latency feels < 300ms.
