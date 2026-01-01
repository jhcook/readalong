# STORY-001: Search, Ignore Content, and Playback Start

## State
DRAFT

## Problem Statement
Users currently have limited control over the playback experience. They cannot easily find specific content to read, exclude non-relevant text (like sidebars or ads that weren't automatically filtered), or jump to a specific starting point without listening from the beginning or skipping manually.

## User Story
As a user, I want to be able to search the content, mark content to be ignored by the speaker, and select a point to start speaking from, so that I can control exactly what is read aloud and where it begins.

## Acceptance Criteria
- [ ] **Search Functionality**: 
    - User can type a query to highlight matching text within the readable content.
    - Navigation between matches (next/previous).
- [ ] **Ignore Content**: 
    - User can select text or blocks and mark them as "ignored".
    - Ignored content is visually distinct (e.g., grayed out or strikethrough).
    - The speaker skips over ignored content during playback.
- [ ] **Start from Point**: 
    - User can click on a specific paragraph or sentence to immediately set the playback position to that point.
    - If playing, playback jumps to the new point.
- [ ] **Negative Test**: 
    - Search returns no results gracefully.
    - Clicking to start on ignored content does nothing or provides feedback.

## Observability Requirements
- [ ] **Logging**: Log usage of search, ignore, and jump-to-start features to understand user behavior.

## Non-Functional Requirements
- **Performance**: Search should be responsive even on large pages.
- **Usability**: The UI for searching and ignoring should be intuitive and not clutter the reading view.

## Linked ADRs
- N/A

## Impact Analysis Summary
Components touched:
- Content script (text extraction and rendering)
- UI (Search bar, context menu/buttons for ignore)
- Audio playback engine (handling skips and arbitrary start points)

Workflows affected:
- Standard playback flow.

Risks identified:
- Complexity in maintaining text mapping when content is ignored.
- Potential conflicts with existing text selection for copy/paste.

## Test Strategy
- **Manual Verification**: Test search with various terms, ignore different block types, and click to start on various elements.
- **Automated Tests**: Unit tests for the search logic and "skip ignored" logic in the playback engine.

## Rollback Plan
- Revert the feature flags or code changes if significant bugs are found in playback stability.
