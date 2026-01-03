# WEB-010: Dynamic Ignore During Playback

Status: ACCEPTED

## Goal Description
Enable users to ignore/unignore text while the voice is actively reading, with proper skipping, highlighting sync, and navigation support.

## Compliance Checklist
- [x] @Security approved? (No new data flows or storage)
- [x] @Architect approved? (Uses existing provider/callback pattern)
- [x] @QA approved? (Automated test added)
- [x] @Docs approved?
- [x] @Compliance approved?
- [x] @Observability approved?

## Proposed Changes

### [ReadingPane.tsx](file:///Users/jcook/repo/readalong/web/extension/src/content/ReadingPane.tsx)

| Change | Purpose |
|--------|---------|
| `prevIgnoredRef` | Track previous ignored set to detect changes |
| `prevSentenceIdxRef` | Detect sentence transitions during playback |
| `providerAlignmentMapRef` | Store provider's alignment map for direct play() calls |
| `providerFilteredToGlobalMapRef` | Store index mapping for correct word boundary conversion |
| Effect: Current sentence ignore | Skip to next when current sentence is ignored |
| Effect: Sentence transition skip | Skip when entering an ignored sentence |
| Unignore detection | Reinitialize provider when sentences are unignored |
| `onWordBoundary` fix | Use saved mapping refs for highlighting sync |
| `navigateSentence` fix | Use `handleReadAloud()` for proper index conversion |

### [ReadingPane.test.tsx](file:///Users/jcook/repo/readalong/web/extension/src/content/ReadingPane.test.tsx)
- Added: "skips to next sentence when current sentence is ignored during playback"

## Verification Plan

```bash
cd /Users/jcook/repo/readalong/web/extension && npm test -- --testPathPattern="ReadingPane"
```
**Result**: 37/37 tests passing

### Manual Test Cases
1. Ignore current sentence → Skips immediately ✓
2. Ignore future sentence → Current continues, skips on entry ✓
3. Unignore sentence → Can navigate back to it ✓
4. Cloud voices → Highlighting stays in sync ✓

## Key Design Decisions

**Provider Reuse**: Skip logic tries to reuse existing provider via `providerAlignmentMapRef` lookup before falling back to reinit.

**Highlighting Sync**: `providerFilteredToGlobalMapRef` stores the index mapping at provider init time, used in `onWordBoundary` to ensure word highlighting matches provider's internal state.

**Unignore Handling**: Requires provider reinit because the audio for that sentence wasn't generated.
