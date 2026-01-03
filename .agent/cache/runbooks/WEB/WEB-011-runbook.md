---
storyId: WEB-011
title: Content Extractors Runbook
---

# WEB-011 Runbook: Content Extractors Architecture

## Overview
This runbook covers verification of the modular content extraction system.

## Prerequisites
- Extension built and loaded in Chrome
- Access to various website types (news, e-commerce, blogs)

## Build Verification

```bash
cd /Users/jcook/repo/readalong/web/extension
npm run build
```

## Automated Tests

```bash
npm test -- --testPathPattern="extractor"
```

## Manual Verification

### Test Case 1: News Site Extraction (BBC)
1. Navigate to https://www.bbc.com/news (any article)
2. Click "Load Text"
3. Verify: Article headline and body are extracted
4. Verify: Navigation, ads, and sidebars are excluded

### Test Case 2: MSN Article Extraction
1. Navigate to https://www.msn.com (any article)
2. Click "Load Text"
3. Verify: Main article content is extracted cleanly
4. Verify: Related articles and ads are excluded

### Test Case 3: Wikipedia Extraction
1. Navigate to any Wikipedia article
2. Click "Load Text"
3. Verify: Article content including headers is extracted
4. Verify: Infoboxes and references are handled appropriately

### Test Case 4: Generic Site Fallback
1. Navigate to a site not in G20 registry
2. Click "Load Text"
3. Verify: Readability.js fallback extracts meaningful content

### Test Case 5: Shadow DOM Content
1. Navigate to a site using Shadow DOM (e.g., YouTube comments)
2. Click "Load Text"
3. Verify: Content within open Shadow DOMs is extracted

## Expected Results
- Clean text extraction within 500ms
- No duplicate content
- Proper paragraph separation
