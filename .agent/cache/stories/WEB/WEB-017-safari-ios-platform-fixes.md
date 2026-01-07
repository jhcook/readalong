---
id: WEB-017
title: Safari & iOS Platform Integration
status: PROPOSED
owner: User
description: macOS & iOS platform integration for Siri Voices & Personal Voices subgrouped in System Voices on Apple platforms. 
---

## 1. Goal (What We Want)
To enable **full native TTS support** in the ReadAlong Safari Extension on both macOS and iOS.
This specifically includes:
- **System Voices** (Standard AVSpeechSynthesisVoice)
- **Siri Voices** (Premium/Neural voices)
- **Personal Voices** (User-created voices)

This requires:
1.  **Native Messaging**: The extension must confirm it can "talk" to the native App Shell (`SafariWebExtensionHandler`).
2.  **Audio Permissions**: The OS must grant access to the Microphone and Speech Recognition APIs.
3.  **Local Network (iOS Only)**: The OS must allow connections to local TTS servers.
4.  **Production Integrity**: The build process must NOT strip the native connection code.
5.  **Keychain Sharing**: Authentication tokens must be shared across devices via iCloud Keychain.
6.  **User Documentation**: Clear guides/FAQs must be provided to explain why these permissions are needed and how to troubleshoot "Missing Voice" issues.
7. **Entitlements**: The OS must grant access to the Microphone and Speech Recognition APIs.
8. **Outgoing Network**: The OS must allow connections to the TTS servers.

## 2. Changes Required

### A. Extension Plumbing (The "Bridge")
- **`manifest.json`**: Added `nativeMessaging` permission.
- **`NativeAppleProvider.ts`**: Updated connection ID to `com.secnix.readalong.extension`.
- **`ReadingPane.tsx`**: Added `(window as any).NativeAppleProvider = NativeAppleProvider` to defeat Webpack tree-shaking (Critical Fix).

### B. macOS Configuration
- **`macOS (App)/Info.plist`**:
`NSMicrophoneUsageDescription` & `NSSpeechRecognitionUsageDescription`.
- **`macOS (App)/ReadAlongApp.entitlements`**:
    - Add `com.apple.security.device.audio-input` (REQUIRED for Microphone).
    - Add `com.apple.security.application-groups` (Recommended for data sharing).
- **`macOS (Extension)/ReadAlongExtension.entitlements`**:
    - Add `com.apple.security.device.audio-input`.
    - Add `com.apple.security.application-groups`.
    - **Verify/Add**: `keychain-access-groups` (Required for iCloud Keychain sharing).

### C. iOS Configuration
- **`iOS (App)/Info.plist`**: Add Usage Descriptions for `Microphone`, `SpeechRecognition`, and `LocalNetwork`.
- **`iOS (Extension)/Info.plist`**: Add Usage Descriptions for `Microphone`, `SpeechRecognition`, and `LocalNetwork`.
- **Entitlements**: No changes (iOS does not use `audio-input` entitlement).

## 4. Runbook Plan
*To be executed in the next phase.*

1.  **Verify Webpack**: Confirm `dist/content.js` still contains `NativeAppleProvider` strings.
2.  **Reset Signing (Crucial)**:
    - Open Xcode.
    - Toggle "Automatically Manage Signing" OFF and ON for **ReadAlong** (App) target.
    - Toggle "Automatically Manage Signing" OFF and ON for **ReadAlong Extension** target.
    - **Keychain Sharing**: Ensure "Keychain Sharing" capability is added to both targets.
    - *Goal*: Force Xcode to generate NEW Provisioning Profiles that include the `audio-input` entitlement we added to the file.
3.  **Clean & Build**:
    - `Product -> Clean Build Folder`.
    - Run on macOS.
4.  **Verification**:
    - Filter Console.app for `com.readalong`.
    - **Pass**: Seeing `beginRequest called` and `Found X voices`.
    - **Fail**: Seeing `XPC_ERROR_CONNECTION_INVALID` (Signing still broken).
