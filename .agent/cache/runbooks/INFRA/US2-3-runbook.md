# US2-3: Offline Mode

Status: COMPLETED

## Goal Description
Ensure the application functions correctly without an internet connection. This requires handling network state changes, disabling cloud-dependent features, and ensuring local resources (like the STT model) are cached and available offline.

## Panel Review Findings
- **@Architect**: Validated. Use `navigator.onLine` and `window.addEventListener('online'/'offline')` for state. Use Cache API for the WASM model.
- **@QA**: Validated. Test by toggling network throttling to "Offline" in DevTools.
- **@Observability**: Validated. Log offline transitions.

## Implementation Steps

### 1. Network Status Hook
#### [NEW] [web/extension/src/content/hooks/useNetworkStatus.ts](web/extension/src/content/hooks/useNetworkStatus.ts)
- React hook to track `navigator.onLine`.

### 2. Model Caching Strategy
#### [MODIFY] [web/extension/src/content/audio/SttEngine.ts](web/extension/src/content/audio/SttEngine.ts)
- Update `initialize()` to check the Cache API for the model file.
- If not cached, fetch and cache it (install-time or first-run).
- Load model from Blob/ArrayBuffer if offline/cached.

### 3. UI Updates
#### [MODIFY] [web/extension/src/content/ReadingPane.tsx](web/extension/src/content/ReadingPane.tsx)
- Display "Offline Mode" indicator.
- Disable/Hide features that require cloud (add a dummy "Cloud TTS" button to demonstrate AC3).

## Verification Plan
### Automated Tests
- [x] Unit test for `useNetworkStatus`.
- [x] Unit test for `SttEngine` caching logic (mocking fetch/cache).

### Manual Verification
- [x] Load extension.
- [x] Go Offline (DevTools).
- [x] Verify "Offline Mode" badge appears.
- [x] Verify STT still works (if model was previously loaded/cached).
