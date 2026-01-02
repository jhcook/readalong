# Runbook for WEB-007: Resemble.ai Voice Source Integration

## Overview
Integration of Resemble.ai as a premium Text-to-Speech (TTS) provider with word-level timestamp alignment for synchronized text highlighting.

---

## Architecture

### Component Flow
```
ReadingPane.tsx (UI)
    ↓ (settings: apiKey, voiceUuid)
ResembleProvider.ts (Provider)
    ↓ (message: GENERATE_RESEMBLE_AUDIO)
ResembleClient.ts (Client)
    ↓ (chrome.runtime.sendMessage)
background/index.ts (Background Script)
    ↓ (fetch to Resemble API v2)
Resemble.ai API
    ↓ (audio + timestamps)
AudioCache.ts (Cache)
    ↓ (playback: PLAY_AUDIO)
offscreen/offscreen.ts (Audio Playback)
```

---

## Files

### 1. ResembleClient.ts
**Path:** `web/extension/src/content/services/ResembleClient.ts`

#### Interface
```typescript
export interface ResembleVoice {
    uuid: string;
    name: string;
    project_uuid?: string;  // Auto-assigned by background script
    preview_url?: string;
}
```

#### Methods
| Method | Description |
|--------|-------------|
| `getVoices(apiKey)` | Fetches available voices from Resemble API. Also auto-creates/finds "ReadAlong" project. |
| `generateAudio(apiKey, voiceUuid, projectUuid, text)` | Generates audio with timestamp alignment. Returns `{ audioId, alignment }`. |
| `fetchAudio(audioId)` | Retrieves cached audio as base64 DataURL for fallback playback. |

---

### 2. ResembleProvider.ts
**Path:** `web/extension/src/content/providers/ResembleProvider.ts`

#### Implements
`ReadingProvider` interface (same as ElevenLabs, Google, System, Recorded)

#### Key Features
- **Chunking:** Uses `ChunkManager` to split long text into manageable chunks
- **Caching:** Reuses generated audio via `audioId` key
- **Prefetching:** Loads next chunk while current chunk plays
- **Dual Playback Paths:**
  1. **Offscreen Document** (preferred): Uses `chrome.offscreen` API for background playback
  2. **Local Fallback**: Direct `<audio>` element in content script if offscreen fails
- **Playback Rate:** Stores rate and applies on both playback paths

#### Timestamp Alignment
Resemble returns `graph_times` and `graph_chars`:
```json
{
  "graph_times": [[0.0, 0.05], [0.05, 0.1], ...],  // [start, end] per character
  "graph_chars": ["H", "e", "l", "l", "o", ...]
}
```
Provider maps character timestamps to word boundaries for highlighting.

---

### 3. Background Script Handlers
**Path:** `web/extension/src/background/index.ts`

#### Message Handlers

| Message Type | Description |
|--------------|-------------|
| `FETCH_RESEMBLE_VOICES` | Fetches voices, finds/creates "ReadAlong" project, attaches project UUID to all voices |
| `GENERATE_RESEMBLE_AUDIO` | Creates clip via API, downloads audio, caches with timestamps, auto-deletes remote clip |

#### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/voices?page=1` | GET | List available voices |
| `/api/v2/projects?page=1` | GET | List projects (find "ReadAlong") |
| `/api/v2/projects` | POST | Create "ReadAlong" project if missing |
| `/api/v2/projects/{uuid}/clips` | POST | Generate TTS clip with timestamps |
| `/api/v2/projects/{uuid}/clips/{uuid}` | DELETE | Cleanup generated clip after caching |

#### Request Body for Clip Generation
```json
{
  "title": "ReadAlong-Clip",
  "body": "<text to synthesize>",
  "voice_uuid": "<selected voice UUID>",
  "is_public": false,
  "is_archived": false,
  "include_timestamps": true
}
```

---

### 4. UI Integration
**Path:** `web/extension/src/content/ReadingPane.tsx`

#### Settings Persisted
- `resembleApiKey`: User's Resemble.ai API Key
- `selectedResembleVoiceUuid`: Selected voice UUID

#### State Variables
| Variable | Type | Description |
|----------|------|-------------|
| `resembleApiKey` | string | API key stored in `chrome.storage.local` |
| `resembleVoices` | ResembleVoice[] | Fetched voices list |
| `selectedResembleVoiceUuid` | string | Currently selected voice |

---

## Playback Rate Fix

### Problem
Speed slider changes only took effect during active playback, not when configured before pressing "Read Aloud".

### Root Cause
1. `setPlaybackRate()` only applied rate to `localAudio` if it already existed
2. `PLAY_AUDIO` message to offscreen document didn't include rate parameter

### Solution
1. Added `private playbackRate: number = 1.0` to store configured rate
2. Updated `setPlaybackRate()` to store rate first: `this.playbackRate = rate`
3. Updated `playLocalAudio()` to apply rate before `.play()`: `this.localAudio.playbackRate = this.playbackRate`
4. Added `rate: this.playbackRate` to `PLAY_AUDIO` message for offscreen playback

---

## Implementation Checklist

### 1. ResembleClient
- [x] Create `web/extension/src/content/services/ResembleClient.ts`
  - [x] Implement `getVoices` with message passing
  - [x] Implement `generateAudio` with retry logic and timestamps
  - [x] Implement `fetchAudio` for fallback playback

### 2. Background Handlers
- [x] Update `web/extension/src/background/index.ts`
  - [x] Add `FETCH_RESEMBLE_VOICES` handler with `?page=1` pagination fix
  - [x] Add "ReadAlong" project auto-creation logic
  - [x] Add `GENERATE_RESEMBLE_AUDIO` handler
  - [x] Implement clip cleanup after caching

### 3. ResembleProvider
- [x] Create `web/extension/src/content/providers/ResembleProvider.ts`
  - [x] Implement `ReadingProvider` interface
  - [x] Handle chunking via `ChunkManager`
  - [x] Implement timestamp-to-word mapping
  - [x] Dual playback (offscreen + fallback)
  - [x] Prefetching next chunk
  - [x] **Playback rate persistence fix**

### 4. UI Integration
- [x] Update `web/extension/src/content/ReadingPane.tsx`
  - [x] Add "Resemble.ai" to Voice Source dropdown
  - [x] Add API Key input field
  - [x] Add Voice selection dropdown
  - [x] Persist settings to `chrome.storage.local`
  - [x] Initialize provider with `playbackRate`

---

## Verification

### Manual Testing
1. **Setup:**
   - Enter valid Resemble.ai API Key in Settings
   - Wait for voices to load (should auto-create "ReadAlong" project)
   - Select a voice

2. **Playback Test:**
   - Navigate to any article
   - Adjust speed slider to 1.5x **before** pressing "Read Aloud"
   - Press "Read Aloud"
   - Verify playback starts at 1.5x speed
   - Verify word highlighting syncs with audio

3. **Speed Change During Playback:**
   - While playing, adjust speed slider
   - Verify speed changes immediately

4. **Navigation:**
   - Use ⏮ / ⏭ buttons to skip sentences
   - Verify highlighting and audio sync correctly

### Error Handling
| Error | Expected Behavior |
|-------|-------------------|
| Invalid API Key | Alert: "ERR_UNAUTHORIZED: Invalid Resemble API Key." |
| Quota Exceeded | Alert: "ERR_PAYMENT_REQUIRED: Resemble AI quota exceeded..." |
| Rate Limited | Alert: "ERR_TOO_MANY_REQUESTS: Resemble AI rate limit exceeded." |

---

## Known Limitations
1. **Character-Level Mapping:** Resemble returns character timestamps, not word timestamps. Mapping is approximate if TTS normalizes text (e.g., "1" → "one").
2. **Project Requirement:** Audio generation requires a project UUID. The extension auto-manages a "ReadAlong" project.
3. **Clip Cleanup:** Generated clips are deleted after caching. If deletion fails, clips may accumulate in Resemble dashboard.
