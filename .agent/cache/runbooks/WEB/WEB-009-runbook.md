# WEB-009: Google TTS Chirp 3 Word Timestamps via STT Round-Trip

Status: PROPOSED

## Goal Description
Implement a "round-trip" mechanism to obtain word-level timestamps for Google Cloud "Chirp 3" (HD) voices, which do not natively support SSML marks. The solution involves generating the audio via TTS and then immediately sending it to Google Speech-to-Text (STT) V2 (using the Chirp 2 model) to extract precise word offsets. This enables text highlighting for high-quality voices.

## Compliance Checklist
- [x] @Security approved? (Using existing secure Google Service Account auth)
- [x] @Architect approved? (Extends existing Provider/Client pattern)
- [x] @QA approved? (Added integration and manual test plans)
- [x] @Docs approved? (Runbook serves as documentation)
- [x] @Compliance approved? (No new PII storage)
- [x] @Observability approved? (Logging added for STT latency/errors)

## Component Specification & Interface

### 1. `GoogleSTTClient` (New Service)
**Interface:**
```typescript
interface WordTimestamp {
    word: string;
    startTime: number; // seconds
    endTime: number;   // seconds
}

class GoogleSTTClient {
    /**
     * Transcribes audio blob using Google STT V2 to get word timestamps.
     * Uses the existing cached 'googleServiceAccountJson' from storage via background proxy.
     */
    static async transcribeForTimestamps(
        audioBlob: Blob,
        languageCode: string
    ): Promise<WordTimestamp[]>;
}
```

**Data Models:**
- `WordTimestamp` DTO: Simply maps a string word to its start/end time.
- `GoogleSTTRequest`: Internal structure for V2 API payload.

**Dependency Injection:**
- Relies on `chrome.runtime.sendMessage` to proxy requests to the Background Script.
- Background Script injects credentials securely.

**State Management:**
- Stateless. Input audio -> Output timestamps.

### 2. Background Script Handler
**Interface:**
- Message: `TRANSCRIBE_AUDIO`
- Payload: `{ audioBase64: string, languageCode: string }`
- Response: `{ success: boolean, timestamps?: WordTimestamp[], error?: string }`

## Implementation Guardrails

### Tech Stack Standards
- **Language**: TypeScript 4.x+
- **Linting**: ESLint (standard repo config)
- **Formatting**: Prettier

### Error Handling Strategy
- **Graceful Fallback**: If STT fails (network error, quota, API error), the provider MUST fallback to playing audio *without* highlighting. It should NOT block playback.
- **Logging**: Log specific STT errors to console (warn level) for debugging.
- **Timeouts**: Enforce a strict timeout (e.g., 5s) for STT requests to prevent UI hangs.

### Security Requirements
- **Credential Scope**: Re-use the `googleServiceAccountJson` already stored in `chrome.storage.local`.
- **No Client-Side Secrets**: Content script must NOT access the JSON key directly. All API calls via Background proxy.

## Logic & Design Patterns

### Architectural Pattern
- **Service-Repository Pattern**: `GoogleSTTClient` acts as the service. `GoogleProvider` acts as the coordinator (Controller).
- **Proxy Pattern**: Content script proxies privileged API calls to Background script.

### Concurrency & Scaling
- **Prefetching**: Logic must be integrated into `prefetchChunk` in `GoogleProvider`. While chunk N is playing, chunk N+1 should be fetching audio AND (if needed) transcribing it.

### Idempotency
- **Caching**: The `AudioCache` should be updated to store the *result* of the STT (the timestamps) alongside the audio blob, so we don't re-transcribe the same audio segment twice.

## Proposed Changes

### Background Script
#### [MODIFY] [src/background/index.ts](file:///Users/jcook/repo/readalong/web/extension/src/background/index.ts)
- Add `TRANSCRIBE_AUDIO` message handler.
- Implement efficient Google STT V2 API call (using `fetch`).
- Reuse `getAccessToken` from `GoogleAuth.ts`.

### Content Script (Services)
#### [NEW] [src/content/services/GoogleSTTClient.ts](file:///Users/jcook/repo/readalong/web/extension/src/content/services/GoogleSTTClient.ts)
- Implement static `transcribeForTimestamps` method.
- Handle `blob` -> `base64` conversion.
- Handle message passing.

### Content Script (Providers)
#### [MODIFY] [src/content/providers/GoogleProvider.ts](file:///Users/jcook/repo/readalong/web/extension/src/content/providers/GoogleProvider.ts)
- Update `playChunk` logic:
    - If `timepoints.length === 0` AND voice is "Chirp" (or configured to use STT):
        - Call `GoogleSTTClient.transcribeForTimestamps`.
        - Map resulting timestamps to SSML marks logic (or update playback directly to use time-based events).
- Update `prefetchChunk` to include this step.

## Verification Plan

### Automated Tests
- **Unit**: Test `GoogleSTTClient` message construction.
- **Integration**: Test `GoogleProvider` fallback logic (mocking STT failure -> ensuring playback continues).

### Manual Verification
1.  **Configure**: Set up Google Service Account in Options.
2.  **Select Voice**: Choose a "Chirp 3-HD" voice (e.g., `en-US-Chirp3-HD-Fenrir`).
3.  **Play**: Click "Read Aloud" on an article.
4.  **Verify**:
    -   Audio plays.
    -   Highlighting follows the spoken words (latency check).
    -   Network tab shows calls to `speech.googleapis.com` (via background).
5.  **Error Case**: Disconnect network or invalidate key -> Verify audio still plays (no highlighting).
