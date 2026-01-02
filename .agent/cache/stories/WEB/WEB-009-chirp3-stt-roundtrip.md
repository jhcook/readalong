# WEB-009: Google TTS Chirp 3 Word Timestamps via STT Round-Trip

## State
COMMITTED

## Problem Statement
Chirp 3 HD voices from Google Cloud TTS produce excellent audio quality but do **not support SSML `<mark>` tags**, meaning no word-level timepoints are returned. This prevents word-by-word highlighting during playback.

### Current Limitation
- Wavenet/Neural2/Standard voices: Return timepoints via `enableTimePointing: ["SSML_MARK"]`
- Chirp 3 HD voices: Return 0 timepoints (marks not supported)

### Proposed Solution: STT Round-Trip
Generate TTS audio with Chirp 3, then pass that audio through Google Speech-to-Text V2 with `enable_word_time_offsets=true` to extract precise word timestamps.

```
TTS (Chirp 3 HD)     →    Audio Blob     →    STT (Chirp 2)     →    Word Timestamps
en-AU-Chirp3-HD-*        base64/blob         Chirp 2 model          [{word, offset, duration}]
```

---

## User Story
**As a** user who prefers Chirp 3's natural voice quality,
**I want** word-level highlighting during playback,
**So that** I get both premium audio quality and synchronized text highlighting.

---

## Acceptance Criteria

### Functional
- [ ] Chirp 3 voices trigger STT round-trip when no timepoints returned
- [ ] STT returns word timestamps with >95% accuracy
- [ ] Timestamps map correctly to original text for highlighting
- [ ] Fallback to no highlighting if STT fails

### Performance
- [ ] STT processing adds <3s latency per chunk
- [ ] Prefetching includes STT processing to hide latency
- [ ] Caching includes STT results

### Configuration
- [ ] Optional toggle: "Enable High Accuracy Mode" (uses STT)
- [ ] Works with existing Service Account JSON (same project)

---

## Technical Specification

### New Components

#### 1. `GoogleSTTClient.ts` [NEW]
```typescript
interface WordTimestamp {
    word: string;
    startTime: number;  // seconds
    endTime: number;    // seconds
}

class GoogleSTTClient {
    static async transcribeForTimestamps(
        auth: GoogleAuthOptions,
        audioBlob: Blob,
        languageCode: string
    ): Promise<WordTimestamp[]>;
}
```

#### 2. Background Handler: `TRANSCRIBE_AUDIO_FOR_TIMESTAMPS`
- Accept: audio base64, languageCode, serviceAccountJson
- Call: Google STT V2 API with Chirp 2 model
- Return: Array of word timestamps

#### 3. GoogleProvider Enhancement
- Detect when timepoints array is empty
- Trigger STT transcription
- Map STT words to SSML words for alignment

### API Integration

**Endpoint:** `https://speech.googleapis.com/v2/projects/{project}/locations/{location}/recognizers/_:recognize`

**Request:**
```json
{
    "config": {
        "explicit_decoding_config": {
            "encoding": "MP3",
            "sample_rate_hertz": 24000
        },
        "features": {
            "enable_word_time_offsets": true
        },
        "model": "chirp_2",
        "language_codes": ["en-AU"]
    },
    "content": "<base64 audio>"
}
```

**Response (relevant fields):**
```json
{
    "results": [{
        "alternatives": [{
            "words": [
                { "word": "Technical", "startOffset": "0.100s", "endOffset": "0.600s" },
                { "word": "VP", "startOffset": "0.650s", "endOffset": "0.900s" }
            ]
        }]
    }]
}
```

---

## Word Mapping Strategy

Since STT might return slightly different word counts/text than TTS input:
1. Use fuzzy matching with Levenshtein distance
2. Align STT words to original words using sequence alignment
3. Accept tolerance for minor differences (contractions, punctuation)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `services/GoogleSTTClient.ts` | NEW | STT V2 API client |
| `background/index.ts` | MODIFY | Add TRANSCRIBE_AUDIO handler |
| `providers/GoogleProvider.ts` | MODIFY | Trigger STT when no timepoints |

---

## Testing Strategy

### Integration Tests
- Mock STT API response
- Verify word timestamp extraction
- Verify word alignment accuracy

### Manual Testing
1. Select Chirp 3 voice
2. Click "Read Aloud"
3. Verify word highlighting syncs with speech
4. Verify ignored sentences are skipped correctly

---

## Cost Estimate
- STT V2 with Chirp: ~$0.016 / minute of audio
- For a typical article (~5 min audio): ~$0.08 additional cost per article
