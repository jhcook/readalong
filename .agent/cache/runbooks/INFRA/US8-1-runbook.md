---
storyId: US8-1
title: Save Alignment Maps Runbook
---

# US8-1 Runbook: Save Alignment Maps Locally

## Overview
Verification steps for local storage of alignment data in IndexedDB.

## Prerequisites
- Extension built and loaded
- Chrome DevTools accessible

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Manual Verification

### Test Case 1: Initial Storage
1. Load and tokenize text from a page
2. Open DevTools > Application > IndexedDB
3. Verify: Alignment map is stored

### Test Case 2: Retrieval on Reload
1. Close and reopen the extension
2. Navigate to same page
3. Verify: Previously tokenized text loads faster
4. Verify: Stored alignment map is reused

### Test Case 3: Storage Versioning
1. Check storage schema version
2. Upgrade extension with schema change
3. Verify: Migration handles old data gracefully

### Test Case 4: Clear Storage
1. Use settings to clear cached data
2. Verify: Alignment maps are removed
3. Verify: Extension continues working normally

## Expected Results
- Data persists in IndexedDB
- Fast retrieval on repeat visits
- Schema migrations work correctly
