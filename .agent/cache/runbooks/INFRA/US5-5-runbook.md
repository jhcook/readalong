---
storyId: US5-5
title: Abstract Extractor Architecture Runbook
---

# US5-5 Runbook: Abstract Extractor Architecture

## Overview
Verification steps for the abstract extractor architecture and G20 support.

> [!NOTE]
> See also: WEB-011 runbook for detailed extractor testing steps.

## Prerequisites
- Extension built and loaded in Chrome
- Access to G20 country websites

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

### Test Case 1: Abstract Architecture
1. Verify `BaseExtractor` provides common interface
2. Verify `ChainExtractor` chains strategies correctly
3. Verify `ExtractorRegistry` matches URLs appropriately

### Test Case 2: G20 Coverage
1. Test top sites from USA, UK, Germany, France, Japan
2. Verify clean extraction on each
3. Document any sites needing custom handlers

### Test Case 3: Split Quote Handling
1. Load article with quoted text split by ads
2. Verify: Quotes are merged correctly
3. Verify: No sentence breaks within quotes

## Expected Results
- Clean extraction across G20 sites
- No maintenance burden for adding new sites
- Proper quote and paragraph handling
