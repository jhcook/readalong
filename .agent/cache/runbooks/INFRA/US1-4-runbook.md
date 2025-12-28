# US1-4: Accessibility Modes

Status: COMPLETED

## Goal Description
Implement accessibility features: Dyslexia-friendly font and High-Contrast mode. Ensure settings are persisted locally using browser storage so they are maintained across sessions.

## Panel Review Findings
- **@Architect**: Validated. Use `chrome.storage.local` for simple settings persistence in the extension. The UI should react to these changes instantly.
- **@Security**: Validated. Only UI preferences are stored. No sensitive data or PII.
- **@QA**: Validated. Verify font change visually. Use Lighthouse/axe to confirm high-contrast mode meets WCAG AA standards.
- **@Docs**: Validated. Update README or user guide to mention accessibility options.

## Implementation Steps

### 1. Update Styles
#### [MODIFY] [web/extension/src/content/styles.css](web/extension/src/content/styles.css)
- Add `@font-face` for a dyslexia-friendly font (or use a system alternative like Comic Sans if license is an issue, but preferably a web font like OpenDyslexic).
- Define `.dyslexia-font` class.
- Define `.high-contrast` class with black background and yellow/white text.

### 2. Update Reading Pane UI
#### [MODIFY] [web/extension/src/content/ReadingPane.tsx](web/extension/src/content/ReadingPane.tsx)
- Add toggles for Dyslexia Font and High Contrast.
- Apply classes to the container based on state.
- Load and save settings using `chrome.storage.local`.

### 3. Verification
#### [NEW] [web/extension/src/content/ReadingPane.accessibility.test.tsx](web/extension/src/content/ReadingPane.accessibility.test.tsx)
- Test state transitions for toggles.
- Verify settings are loaded from storage on mount.

## Verification Plan
### Automated Tests
- [x] Unit tests for settings loading/saving.
- [x] Verify classes are applied to the DOM.

### Manual Verification
- [x] Toggle Dyslexia Font: verify font style change.
- [x] Toggle High Contrast: verify colors change to high-contrast scheme.
- [x] Refresh page: verify settings are remembered.
