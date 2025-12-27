# US1-1: Ingest Text From Webpage

Status: COMPLETED

## Goal Description
Implement the core functionality to extract visible text from a webpage using a browser extension and display it in a clean reading pane. This involves DOM traversal, content cleaning (removing ads/nav), and UI injection using Shadow DOM for isolation.

## Panel Review Findings
- **@Architect**: Validated. Using WebExtensions Manifest V3. Injection via Shadow DOM ensures zero CSS bleeding.
- **@Security**: Validated. Extraction is purely local. Must use a robust sanitizer for any HTML re-rendered in the reading pane to prevent XSS.
- **@QA**: Validated. Test strategy includes unit tests for the extraction regex/logic and E2E tests for various site structures.
- **@Docs**: Validated. Developer documentation for the extraction engine and user-facing installation guide updates required.
- **@Compliance**: Validated. No PII is sent to cloud. Local processing aligns with COPPA/GDPR by design.
- **@Observability**: Validated. Adding OpenTelemetry spans for extraction duration and success/failure rates.

## Implementation Steps

### 1. Project Scaffolding (Web Extension)
#### [NEW] [web/extension/manifest.json](web/extension/manifest.json)
- Create Manifest V3 configuration.
- Add `activeTab` and `scripting` permissions.

### 2. Extraction Logic
#### [NEW] [web/extension/src/content/extractor.ts](web/extension/src/content/extractor.ts)
- Implement `extractMainContent(document: Document): string`.
- Logic: Identify the largest text block, filter out `<nav>`, `<script>`, `<style>`, `<aside>`, and elements with common ad-related class names.
- Use `innerText` or a sanitized `innerHTML` conversion.

### 3. UI Components (React)
#### [NEW] [web/extension/src/popup/Popup.tsx](web/extension/src/popup/Popup.tsx)
- Add "Load Text from Page" button.
- Trigger content script extraction via `chrome.tabs.sendMessage`.

#### [NEW] [web/extension/src/content/ReadingPane.tsx](web/extension/src/content/ReadingPane.tsx)
- React component to display the cleaned text.
- Styled with a minimalist, high-readability layout.

#### [NEW] [web/extension/src/content/index.ts](web/extension/src/content/index.ts)
- Entry point for content script.
- Set up message listener to trigger extraction and mount the `ReadingPane` in a Shadow DOM container.

### 4. Styling
#### [NEW] [web/extension/src/content/styles.css](web/extension/src/content/styles.css)
- Minimalist styles for the reading pane, ensuring compatibility with ADR-010 (Child-Safe/Friendly UI).

## Verification Plan
### Automated Tests
- [x] Unit tests for `extractor.ts` using JSDOM and sample HTML snippets.
- [x] Integration test for message passing between popup and content script.

### Manual Verification
- [x] Install extension in Chrome/Edge.
- [x] Navigate to Wikipedia (clean test) and a news site (noisy test).
- [x] Click "Load Text" and verify the reading pane appears with correct content and no ads.
- [x] Verify "Close" button removes the UI.
