# US5-4 Runbook: Select Page HTML Element

Status: ACCEPTED

## Goal Description
Implement a feature allowing the user to select specific HTML elements on a page to be read, ignoring unwanted content. This addresses the problem where pages contain navigation, ads, or other content not relevant to the user's reading intent.

## Compliance Checklist
- [x] @Security approved? (No PII logged, input sanitization used)
- [x] @Architect approved? (Follows existing message passing and content extraction patterns)
- [x] @QA approved? (Unit tests and manual verification steps defined)
- [x] @Docs approved? (Self-documenting through code and runbook)
- [x] @Compliance approved? (No PII)
- [x] @Observability approved? (Tracing spans added for extraction process)

## Proposed Changes
### Content Script
#### [MODIFY] [index.ts](file:///Users/jcook/repo/readalong/web/extension/src/content/index.ts)
- Added `enableSelectionMode` function to handle mouse interactions:
    - Adds/removes highlight class on hover.
    - Captures click events to select element.
    - Mounts reading pane with content from selected element.
    - Handles 'Escape' key to exit mode.
- Added message listener for `ENTER_SELECTION_MODE`.

#### [MODIFY] [extractor.ts](file:///Users/jcook/repo/readalong/web/extension/src/content/extractor.ts)
- (Verified) `extractContentFromNode` and `flattenNode` functions are available to handle extraction from specific nodes, including Shadow DOM support.

### Popup
#### [MODIFY] [Popup.tsx](file:///Users/jcook/repo/readalong/web/extension/src/popup/Popup.tsx)
- Added 'Select Content' button.
- Implemented `handleSelectContent` to send `ENTER_SELECTION_MODE` message to active tab.

## Verification Plan
### Automated Tests
- Run unit tests for content extraction:
    ```bash
    npm test src/content/extractor.test.ts
    ```
- (Future) Add tests for `enableSelectionMode` logic in `index.ts` if refactored to be testable (currently in main file).

### Manual Verification
1.  **Load Extension**: Open a web page with various semantic elements (e.g., a news article).
2.  **Open Popup**: Click the ReadAlong extension icon.
3.  **Enter Selection Mode**: Click the "Select Content" button.
    -   *Expected Result*: Popup closes, and hovering over page elements highlights them with a green outline/background.
4.  **Navigation**: Move mouse around the page.
    -   *Expected Result*: Highlight follows the element under cursor.
5.  **Select Element**: Click on a specific paragraph or article section.
    -   *Expected Result*: Reading Pane opens, displaying only the text from the selected element.
6.  **Escape**: Enter Selection Mode again, then press 'Escape'.
    -   *Expected Result*: Selection mode exits, no highlighting occurs.
