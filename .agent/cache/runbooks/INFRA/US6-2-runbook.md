---
storyId: US6-2
title: Inject Reading UI Runbook
---

# US6-2 Runbook: Inject Reading UI Into Webpage

## Overview
Verification steps for Shadow DOM-based UI injection.

## Prerequisites
- Extension built and loaded
- Access to various website types

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Manual Verification

### Test Case 1: Clean Overlay
1. Navigate to simple webpage (e.g., Wikipedia)
2. Click extension icon
3. Verify: Reading Pane appears overlaid
4. Verify: Host page remains functional

### Test Case 2: No Style Bleeding
1. Open Reading Pane on styled site (e.g., GitHub)
2. Verify: Extension styles don't affect host page
3. Verify: Host page styles don't affect extension
4. Inspect Shadow DOM encapsulation

### Test Case 3: Minimize/Close
1. Click minimize button
2. Verify: UI collapses to small indicator
3. Click indicator to restore
4. Click close button
5. Verify: UI is removed completely

### Test Case 4: Complex Sites
1. Test on NYTimes (paywall)
2. Test on YouTube (SPA)
3. Test on Twitter/X (dynamic content)
4. Verify: No layout conflicts

### Test Case 5: Z-index Handling
1. Navigate to site with modals/overlays
2. Open Reading Pane
3. Verify: Reading Pane maintains proper z-index

## Expected Results
- Complete Shadow DOM isolation
- No conflicts with host pages
- Minimize and close work reliably
