# US1-3: Highlight Words in Sync

Status: COMPLETED

## Goal Description
Implement word-level highlighting that syncs with audio playback. This involves creating a React component that accepts an `AlignmentMap` and the current playback time (or word index) to render the text with the active word highlighted.

## Panel Review Findings
- **@Architect**: Validated. The UI should be driven by state (current time/index). React's virtual DOM is fast enough for this if we optimize re-renders (e.g., only updating the class of the active word).
- **@QA**: Validated. Testing needs to cover play/pause transitions and ensure the highlight doesn't get "stuck". Accessibility (color contrast) is critical (AC3).
- **@Observability**: Validated. Trace the performance of the highlight update loop if possible, or at least log significant jank.

## Implementation Steps

### 1. Update Reading Pane
#### [MODIFY] [web/extension/src/content/ReadingPane.tsx](web/extension/src/content/ReadingPane.tsx)
- Accept `AlignmentMap` instead of raw text string (or in addition to).
- Manage playback state (playing/paused, current word index).
- Render `Sentence` and `Word` components.
- Highlight the word matching `currentWordIndex`.

### 2. Styling
#### [MODIFY] [web/extension/src/content/styles.css](web/extension/src/content/styles.css)
- Add `.readalong-word` class.
- Add `.readalong-word.active` class with a high-contrast background color (e.g., yellow `#FFFF00` or a theme-compliant color).

### 3. Simulation Logic (Mock Audio)
#### [MODIFY] [web/extension/src/content/index.ts](web/extension/src/content/index.ts)
- Since we don't have real audio/alignment yet (US1-4 is next), we'll simulate playback.
- Create a simple timer that increments the `currentWordIndex` every `N` ms to verify the UI update loop (AC1, AC2, AC4, AC5).

## Verification Plan
### Automated Tests
- [x] Unit tests for `ReadingPane` component:
    - Verify correct word is highlighted based on props.
    - Verify "active" class is applied only to one word.
- [x] Check accessibility contrast ratio for the highlight color.

### Manual Verification
- [x] Load page, click "Load Text".
- [x] Verify words highlight sequentially (simulated playback).
- [x] Verify pause/resume works (if UI controls added).
