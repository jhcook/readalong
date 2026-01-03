---
storyId: WEB-005
title: Auto-scroll Highlighted Text Runbook
---

# WEB-005 Runbook: Auto-scroll Highlighted Text

## Overview
This runbook covers verification of the auto-scroll feature that keeps highlighted text visible during read-aloud playback.

> [!NOTE]
> WEB-005 is currently in DRAFT state. This runbook documents planned verification steps.

## Prerequisites
- Extension built and loaded in Chrome
- Test page with multiple paragraphs of text

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="ReadingPane"
```

## Manual Verification

### Test Case 1: Basic Auto-scroll
1. Navigate to a page with long content (e.g., Wikipedia article)
2. Click "Load Text" to extract content
3. Start read-aloud playback
4. Observe: When highlighted word reaches bottom of pane, view should scroll

### Test Case 2: Scroll to Top Behavior
1. Continue playback until end of visible paragraph
2. Verify: Next line scrolls to top of viewport when last word is read

### Test Case 3: User Scroll Override
1. During playback, manually scroll the reading pane
2. Verify: Auto-scroll should pause during user interaction
3. Verify: Auto-scroll resumes after idle period

## Expected Results
- Smooth 60fps scrolling
- No jarring jumps
- User scroll temporarily disables auto-scroll
