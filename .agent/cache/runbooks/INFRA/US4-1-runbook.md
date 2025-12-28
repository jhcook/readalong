# US4-1: Generate Audio in Parent’s Cloned Voice

Status: PROPOSED

## Goal Description
Enable parents to generate narration for stories using their own cloned voice via ElevenLabs. This feature ensures children can hear their parent's voice even when reading is not possible. The implementation will include integration with the ElevenLabs API for TTS generation and leverage local caching strategies (IndexedDB) for offline playback and cost optimization.

## Compliance Checklist
- [ ] @Security approved?
- [ ] @Architect approved?
- [ ] @QA approved?
- [ ] @Docs approved?
- [ ] @Compliance approved?
- [ ] @Observability approved?

## Proposed Changes

### INFRA
#### [MODIFY] [backend-governance.yml](file:///Users/jcook/repo/readalong/.github/workflows/backend-governance.yml)
- Update CI/CD to handle new environment variables for ElevenLabs.

### BACKEND
#### [NEW] [elevenlabs_service.py](file:///Users/jcook/repo/readalong/app/services/elevenlabs_service.py)
- Implement `ElevenLabsService` to handle API interactions.
- Methods: `clone_voice`, `generate_audio`.
- Error handling for API limits and network issues.

#### [MODIFY] [audio_router.py](file:///Users/jcook/repo/readalong/app/routers/audio_router.py)
- Add endpoints for voice cloning and TTS generation requests.

### WEB / MOBILE
#### [NEW] [VoiceSelector.tsx](file:///Users/jcook/repo/readalong/web/components/VoiceSelector.tsx)
- UI component to list available cloned voices.

#### [MODIFY] [AudioStore.ts](file:///Users/jcook/repo/readalong/web/stores/AudioStore.ts)
- Integrate IndexedDB caching for generated audio files (adhering to ADR-007).
  
## Verification Plan

### Automated Tests
- **Unit Tests**:
  - `pytest tests/services/test_elevenlabs_service.py`: Verify API request formation and error handling (mocked).
  - `pytest tests/routers/test_audio_router.py`: Verify endpoint inputs/outputs.
- **Integration Tests**:
  - Mock ElevenLabs API in integration environment to verify full flow without incurring costs.

### Manual Verification
1.  **Voice Selection**: Go to settings -> Voice, ensure cloned voices are listed.
2.  **Generation**: Select a story, choose cloned voice, click "Generate Audio". Verify loading state.
3.  **Playback**: Verify audio plays correctly.
4.  **Offline**: Disconnect internet, reload story, verify audio plays from cache (IndexedDB).
