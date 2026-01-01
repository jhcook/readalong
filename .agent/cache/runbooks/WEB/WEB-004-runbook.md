# WEB-004: Search, Ignore Content, and Playback Start

## Goal Description
Implement features to enhance user control over the reading experience: search, ignore content, and start playback from a specific point.

## Compliance Checklist
- [x] @Security approved? (No new permissions or external data handling changes)
- [x] @Architect approved? (Consistent with UI/Logic separation)
- [x] @QA approved? (Verified via manual testing and reproduction scripts)
- [ ] @Docs approved? (User guide needs update)
- [x] @Compliance approved? (No PII involved)
- [ ] @Observability approved? (Logging user actions)

## Implemented Changes

### Web Extension (UI & Content Script)

#### [MODIFY] [ReadingPane.tsx](file:///Users/jcook/repo/readalong/web/extension/src/content/ReadingPane.tsx)
-   **Search**:
    -   Added `searchQuery` state and UI.
    -   Implemented finding matches in `alignmentMap.sentences` and highlighting them in orange (`#ffe0b2`).
    -   Added `matchRefs` and navigation logic to scroll matches into view.
-   **Ignore Content (Refined)**:
    -   Added `ignoredSentenceIndices` state (Set<number>).
    -   Implemented **Selection-Based Ignore**:
        -   Users highlight text (spanning multiple paragraphs).
        -   Clicking "Ignore" (🚫) on any paragraph detects the selection.
        -   **Technical Detail**: Implemented Shadow DOM-aware selection logic (`root.getSelection()`) to bypass encapsulation boundaries.
        -   Uses `data-sentence-index` attributes for mapping DOM nodes to data.
        -   Uses `preventDefault` on button events to preserve selection focus.
    -   Implemented **Shift-Click** fallback for range selection.
    -   **Audio Generation**: `activeAlignmentResult` memo filters out ignored sentences before passing data to the `ReadingProvider`, ensuring they are skipped during TTS.
-   **Start Point (Refined)**:
    -   **Click Behavior**:
        -   **Paused**: Clicking a sentence simply *selects* (highlights) it as the new start point.
        -   **Playing**: Clicking a sentence immediately *jumps* playback to that point.
    -   **Indexing Fix**:
        -   Introduced `wordToGlobalIndex` map (Memoized) to correctly translate local word indices to the global document index. This resolved critical issues with highlighting synchronization ("four rows off") and start point accuracy.

#### [MODIFY] [styles.css](file:///Users/jcook/repo/readalong/web/extension/src/content/styles.css)
-   Added classes for:
    -   `.search-match`, `.search-match.active`: Search highlighting.
    -   `.ignored-block`: Visual style (strikethrough, opacity) for ignored text.
    -   `.ignore-btn`: Styles for the contextual ignore button.

#### [MODIFY] [types.ts](file:///Users/jcook/repo/readalong/web/extension/src/content/types.ts)
-   No changes to core types; ignored state is transient component state.

## Verification Plan

### Automated Tests
-   **Unit Tests**: Not yet implemented for new UI interactions. Reliance on manual verification for this UI-heavy feature set.

### Manual Verification
1.  **Search**:
    -   Type query -> Verify Orange Highlights.
    -   Nav Next/Prev -> Verify Scroll and Dark Orange active highlight.
2.  **Ignore (Selection)**:
    -   Highlight Paragraphs 1-3.
    -   Click "Ignore" button on Paragraph 2.
    -   **Verify**: Paragraphs 1-3 are crossed out.
    -   **Verify**: Selection is cleared.
    -   **Verify**: Playback skips these paragraphs.
3.  **Start Point**:
    -   **Paused**: Click sentence -> Highlights only. Click "Play" -> Starts from there.
    -   **Playing**: Click sentence -> Jumps audio immediately.
    -   **Sync**: Verify yellow word highlight tracks voice perfectly (validated via `wordToGlobalIndex` fix).
