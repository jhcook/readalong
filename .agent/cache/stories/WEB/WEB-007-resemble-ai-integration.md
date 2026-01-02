# WEB-007: Resemble.ai Integration

## Goal Description
Integrate Resemble.ai as a high-quality TTS provider, following the pattern established for ElevenLabs. This will allow users to use Resemble.ai's voice cloning and stock voices within the ReadAlong extension. Resemble.ai offers granular timestamps for word-level alignment, which is critical for our highlighter.

## Compliance Checklist
- [ ] @Security approved? (API interactions must be secure, keys stored in local storage)
- [ ] @Architect approved? (Must follow Provider pattern)
- [ ] @QA approved? (Verify alignment and playback)
- [ ] @Docs approved? (Settings updated in documentation)
- [ ] @Compliance approved? (No PII sent other than text to synthesize)

## Proposed Changes

### 1. New Service: `ResembleClient`
Create `web/extension/src/content/services/ResembleClient.ts`.
- **Purpose**: specific client to handle Resemble.ai API requests.
- **Methods**:
    - `getVoices(apiKey)`: Fetch available project/voice lists.
    - `generateAudio(apiKey, voiceUuid, text)`: Request TTS generation. **Crucially**, request strict timestamps (often called `timestamps=true` or similar in their API) to map "start" and "end" times to characters/words.
    - `fetchAudio(url)`: Retrieve the audio data (if URL provided) or handle base64 if returned directly.

### 2. New Provider: `ResembleProvider`
Create `web/extension/src/content/providers/ResembleProvider.ts`.
- **Implements**: `ReadingProvider` interface.
- **Logic**:
    - Manage chunking of text (similar to ElevenLabs).
    - Handle caching of generated audio segments.
    - Implement `play(sentenceIndex)`, `pause()`, `resume()`, `stop()`.
    - Handle `onTimeUpdate` to map audio time -> character offset -> word index using the returned timestamps from Resemble.

### 3. Settings & UI (`ReadingPane.tsx`)
- Add "Resemble.ai" to the `Voice Generation` source dropdown.
- Add input field for `Resemble.ai API Key`.
- Add dropdown for `Resemble.ai Voice`.
- Persist these settings to `chrome.storage.local`.

### 4. Background Script (if needed)
- If CORS issues arise (likely), proxy Resemble.ai requests through the background script (`web/extension/src/background/index.ts`) similar to how `fetch` requests are proxied for ElevenLabs.

## API Reference (Resemble.ai)
(User to provide specific docs or we follow standard /v2/ calls)
- Endpoint: `https://app.resemble.ai/api/v2/projects/{project_uuid}/clips` (or streaming endpoint)
- Clustering/Streaming might be supported.
- **Alignment**: Resemble sends timestamps if requested. Format usually involves JSON with word/character start/end times.

## Verification Plan
1. **Manual Test**:
    - Enter valid Resemble API Key.
    - Select a Voice.
    - Click "Read Aloud".
    - Verify audio plays and words highlight in sync.
2. **Unit Tests**:
    - Mock ResembleClient to return fake alignment data.
    - Verify Provider correctly calculating current word based on mocked time updates.
