# US3-3 Runbook: Playback Recorded Voice

## Overview
This runbook documents the implementation and verification steps for the "Playback Recorded Voice" feature.

## Implementation Steps
1.  **Modify ReadingPane.tsx**:
    -   Add `recordedAudioUrl` state.
    -   Implement `toggleRecording` to handle `URL.createObjectURL` for the recorded blob.
    -   Add `<audio>` element for playback.
    -   Ensure `URL.revokeObjectURL` is called for cleanup.

2.  **Update Tests**:
    -   Modify `ReadingPane.test.tsx` to suggest playback functionality.
    -   Mock `AudioRecorder`, `SttEngine`, and `URL` APIs.

## Verification Steps
1.  **Automated Tests**:
    -   Run `npm test src/content/ReadingPane.test.tsx`.
    -   Verify all tests pass, including `handles recording start and stop, and shows audio playback`.

2.  **Manual Verification**:
    -   Load extension.
    -   Click "Record Voice".
    -   Speak -> "Stop Recording".
    -   Verify audio player appears.
    -   Click Play -> Verify sound.
    -   Click "Record Voice" again -> Verify previous player/recording is cleared.

## Rollback
-   Revert changes to `web/extension/src/content/ReadingPane.tsx`.
-   Revert changes to `web/extension/src/content/ReadingPane.test.tsx`.
