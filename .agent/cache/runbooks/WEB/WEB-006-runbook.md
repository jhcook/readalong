---
storyId: WEB-006
title: Accessibility Modes Runbook
---

# WEB-006 Runbook: Accessibility Modes

## Overview
This runbook covers verification of high-contrast mode and dyslexia-friendly font options.

## Prerequisites
- Extension built and loaded in Chrome
- Test page with readable content

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="accessibility"
```

## Manual Verification

### Test Case 1: High Contrast Mode
1. Open extension on any webpage
2. Click settings icon
3. Toggle "High Contrast" option
4. Verify: Background becomes dark, text becomes light
5. Verify: Contrast ratio meets WCAG 2.1 AA (4.5:1 for normal text)

### Test Case 2: Dyslexia Font
1. Toggle "Dyslexia Font" option in settings
2. Verify: Font changes to OpenDyslexic
3. Verify: Text remains readable and properly spaced

### Test Case 3: Settings Persistence
1. Enable both high contrast and dyslexia font
2. Close and reopen the extension
3. Verify: Both settings are still enabled
4. Reload the page
5. Verify: Settings persist after page reload

### Test Case 4: Combined Modes
1. Enable both modes simultaneously
2. Verify: Both effects apply correctly together
3. Start read-aloud playback
4. Verify: Highlighting is visible in high-contrast mode

## Expected Results
- Immediate visual feedback on toggle
- Settings persist in localStorage
- All controls remain keyboard accessible
