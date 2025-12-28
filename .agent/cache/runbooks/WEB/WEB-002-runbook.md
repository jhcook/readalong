# WEB-002: Simplify ReadingPane UI for Children

Status: ACCEPTED

## Goal Description
Simplify the ReadingPane user interface by moving secondary options to a settings menu, reducing cognitive load for child users.

## Compliance Checklist
- [x] @Security approved?
- [x] @Architect approved?
- [x] @QA approved?
- [x] @Docs approved?
- [x] @Compliance approved?
- [x] @Observability approved?

## Proposed Changes
### Web Extension
#### [MODIFY] [ReadingPane.tsx](file:///Users/jcook/repo/readalong/web/extension/src/content/ReadingPane.tsx)
- Created `isSettingsOpen` state.
- Moved Dyslexia Font and High Contrast toggles into a conditional rendering block triggered by `isSettingsOpen`.
- Added a "Settings" (cogwheel) button to toggle the menu.
- Ensured primary actions (Record, Read Aloud, Play/Pause) remain on the main toolbar.

## Verification Plan
### Automated Tests
- `npm run test` verifies the existence and visibility of buttons based on state.

### Manual Verification
- Verified main toolbar is clean.
- Verified settings menu opens/closes correctly.
- Verified look and feel is suitable for children (simple icons).
