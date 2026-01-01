---
description: How to verify the latest extractor architecture and UI changes
---

# Verify ReadAlong Extractors and UI

This runbook describes the process to verify the integrity of the new Abstract Extractor architecture and the UI improvements.

## Prerequisites
- Node.js installed
- Access to the `web/extension` directory

## Steps

### 1. Build Verification
Ensure the extension builds without errors, confirming type safety and asset generation.

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

### 2. Automated Testing
Run the test suite to verify the extraction logic, especially the new cleaning and merging rules.

```bash
npm test
```
*Expect: All tests passed, specifically looking for `cleanExtractedHtml` test cases.*

### 3. Manual Extraction Audit
Test the extension against key heavy-content pages to ensure the new `AbstractExtractor` logic works in the wild.

**Targets:**
- **BBC News** (Standard article): Check for main content detection vs. footer links.
- **MSN**: Check that "read more" buttons and infinite scroll noise are removed.
- **A representative G20 site** (e.g., Le Monde, Der Spiegel): Check for non-English character handling.

**Procedure:**
1.  Load the extension in Chrome (`Load Unpacked` -> `dist/`).
2.  Navigate to a target URL.
3.  Open the ReadAlong sidebar.
4.  **Verify**:
    - The text starts at the actual article title/body (not menu text).
    - Quotes are not split across two speech bubbles/paragraphs.
    - No "Subscribe" or "Download App" text is read aloud.

### 4. UI Consistency Check
1.  Open the Extension Settings.
2.  Toggle between **Light Mode** and **Dark Mode**.
3.  **Verify**:
    - Text remains proper contrast (no dark grey on black).
    - Buttons have distinct hover states.
    - The slider for Speed Control (if present) functions visually.

## Troubleshooting
- **Split Quotes**: If you see a sentence cut off mid-quote, capture the HTML structure and add a test case to `common.test.ts`.
- **Missing Content**: Update the specific site extractor or `ignoreSelectors` in `common.ts` if a legitimate paragraph is being filtered.
