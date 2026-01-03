---
id: WEB-011
title: Content Extractors Architecture
status: IMPLEMENTED
owner: User
description: Modular content extraction system supporting site-specific and heuristic extraction strategies.
---

# WEB-011: Content Extractors Architecture

## State
IMPLEMENTED

## Problem Statement
Different websites structure content in vastly different ways. A single extraction strategy fails on many sites. We need an extensible architecture supporting multiple extraction strategies with site-specific overrides.

## User Story
As a user, I want the extension to accurately extract readable content from any website so that I can use read-aloud functionality on diverse web pages.

## Acceptance Criteria
- [x] Abstract `BaseExtractor` class provides common interface
- [x] `ChainExtractor` tries multiple strategies in sequence
- [x] `ReadabilityExtractor` uses Mozilla Readability for generic extraction
- [x] `SelectorExtractor` enables CSS selector-based site-specific rules
- [x] `JsonLdExtractor` parses structured data when available
- [x] `ExtractorRegistry` matches URLs to appropriate extractors
- [x] G20 site configurations cover top international websites
- [x] Extraction removes ads, navigation, and irrelevant elements
- [x] Shadow DOM content is properly flattened

## Non-Functional Requirements
- Performance: Extraction completes within 500ms for typical pages
- Maintainability: New site support requires only configuration, not code

## Linked ADRs
- ADR-001: Hybrid Local + Cloud Architecture

## Impact Analysis Summary
Components touched:
- `extractors/BaseExtractor.ts` - Abstract base class
- `extractors/ChainExtractor.ts` - Strategy chaining
- `extractors/ReadabilityExtractor.ts` - Readability.js wrapper
- `extractors/SelectorExtractor.ts` - CSS selector extraction
- `extractors/JsonLdExtractor.ts` - Schema.org parsing
- `extractors/registry.ts` - URL-to-extractor matching
- `extractors/g20_sites.ts` - G20 country configurations
- `extractors/lists/*` - Domain lists by category
- `extractors/common.ts` - Shared utilities

## Test Strategy
- **Automated Tests**: `extractor.test.ts`, `extractor.*.repro.test.ts`
- **Manual Verification**: Test on BBC, MSN, Wikipedia, news sites

## Rollback Plan
- Revert extractors directory changes
