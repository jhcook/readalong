# WEB-003: Add Voice Selection Menu to Settings (System & ElevenLabs)

## State
COMMITTED

## Problem Statement
The "Read Aloud" feature currently relies on an automatic selection of system Text-to-Speech (TTS) voices or hardcoded configurations. Users cannot explicitly choose their preferred system voice (e.g., specific "Google" voices provided by Chrome) or seamlessly switch between system voices and high-quality AI voices (ElevenLabs). This lack of choice limits user control and accessibility.

## User Story
As a Reader, I want to select my preferred voice from *all* available options (both Browser/System voices like "Google US English" and my personal ElevenLabs voices) directly in the settings menu, so that I can listen to content with the exact voice I find most comfortable.

## Acceptance Criteria
- [ ] **Voice Source Selection**:
  - The Settings menu must allow switching between "System Voices" and "ElevenLabs Voices" (if configured).

- [ ] **System Voice Selection**:
  - When "System Voices" is active, display a dropdown of all voices available via `window.speechSynthesis.getVoices()`.
  - Users can select any available voice (e.g., "Google US English", "Samantha", etc.).
  - The selection is persisted in `chrome.storage.local`.

- [ ] **ElevenLabs Configuration & Selection**:
  - Secure input field for ElevenLabs API Key.
  - When a valid key is present, allow selecting "ElevenLabs" as the source.
  - Display a dropdown of available ElevenLabs voices.
  - Persist API key and voice selection.

- [ ] **Playback**:
  - The "Read Aloud" function uses the explicitly selected voice.
  - If a System Voice is selected, use `SpeechSynthesisUtterance` with that voice object.
  - If an ElevenLabs voice is selected, use the API to generate audio.

- [ ] **Fallback Behavior**:
  - If the selected voice is unavailable (e.g., offline or API error), fallback to a default system voice gracefully.

## Non-Functional Requirements
- **Performance**: Voice list fetching (both system and API) should be efficient.
- **Security**: API Keys stored locally.
- **Usability**: Clear distinction between free (System) and paid/external (ElevenLabs) voices.

## Linked ADRs
- N/A

## Impact Analysis Summary
- **Components touched**:
  - `ReadingPane.tsx`: Settings UI expansion, logic to handle two types of voice sources.
  - `ElevenLabsClient.ts`: Existing functionality.
  - `background/index.ts`: Existing functionality.
- **Risks identified**:
  - Browser voice lists loads asynchronously (`onvoiceschanged`); UI must handle this.
  - Inconsistent system voice names across platforms.

## Test Strategy
- **Unit/Integration**:
  - specific tests for `window.speechSynthesis` mocking.
- **Manual Verification**:
  1. Open Settings.
  2. Verify "System Voices" list is populated (check for "Google" voices).
  3. Select a Google voice.
  4. Verify Read Aloud uses it.
  5. Enter ElevenLabs Key.
  6. Switch to ElevenLabs and select a voice.
  7. Verify Read Aloud uses it.
  8. Reload page/extension and verify selection persists.

## Rollback Plan
- Revert `ReadingPane.tsx` changes.
