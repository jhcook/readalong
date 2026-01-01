---
description: Implement Abstract Extractor Architecture and G20 Support
---

# Implement Abstract Extractor Architecture and G20 Support

## Status
Committed

## Context
To support a global user base, the extension needs robust text extraction for top websites across G20 nations. The previous ad-hoc extractor logic was becoming unmaintainable. We needed a scalable object-oriented approach. Additionally, UI inconsistencies and text cleaning bugs (e.g. split quotes) needed addressing to ensure a premium user experience.

## Objectives
1.  **Abstract Architecture**: Create a base `AbstractExtractor` class to standardize extraction logic.
2.  **G20 Coverage**: Implement specific extractors for high-traffic sites in G20 countries.
3.  **Robust Cleaning**: Improve `common.ts` to handle shadow DOM, complex nesting, and split quotes (merging paragraphs incorrectly split by ads/images).
4.  **UI Polish**: Ensure visual consistency and readability across themes.

## Implementation Details

### Core Extraction Logic
- **AbstractExtractor**: Created a base class defining the contract for all site-specific extractors.
- **common.ts**:
    - `flattenNode`: Enhanced validation for Shadow DOM and slot handling.
    - `cleanExtractedHtml`: Added logic to merge split citations and quotes using heuristic analysis (e.g., checking for unbalanced quotes or lowercase sentence continuations).
    - Added comprehensive regex patterns to filter out "noise" (ads, newsletters, prompts).

### Site Support
- Added support for top G8 components and expanded to G20.
- Registry pattern used to select the best extractor for a given URL.

### UI Improvements
- Standardized color tokens.
- Fixed contrast issues in dark mode.
- Ensured consistent spacing and typography in the Reading Pane.

## Verification
- **Unit Tests**: Added tests for `cleanExtractedHtml` covering edge cases like split quotes and punctuation.
- **Manual Audit**: Verified against top domains (BBC, MSN, etc.) to ensure clean text output.
