# Privacy Policy for ReadAlong+

**Last Updated:** January 4, 2026

## 1. Introduction

ReadAlong+ ("we," "our," or "the Service") is a local-first, privacy-centric reading companion browser extension and application. This Privacy Policy describes our policies and procedures on the collection, use, and disclosure of your information when you use the Service and tells you about your privacy rights and how the law protects you.

We operate under a strict **"No Data Collection"** principle. The Service is architected to process data locally on your device. We do not collect, store, transmit, or distribute your personal data, reading content, or audio recordings to our servers.

## 2. Data Collection and Use

### Personal Data
We do not collect any Personally Identifiable Information (PII) such as your name, email address, phone number, or IP address.

### Usage Data
We do not collect usage data, analytics, or telemetry from the Service.

### User Content
-   **Text Content:** The text of the web pages you read using the Service is processed transiently within your browser's local memory. It is not sent to us or any third party (unless you explicitly invoke a third-party cloud voice service, see Section 3).
-   **Audio Recordings:** Voice recordings made for "Custom Voice" features are processed and stored strictly on your local device using local browser storage (IndexedDB) or local file systems. These recordings are never uploaded to our servers.

## 3. Third-Party Service Providers

The Service offers optional integrations with third-party providers for enhanced features. These features are **Opt-In** only. If you choose to use these features, data is transmitted directly from your device to the third-party provider, bypassing our infrastructure entirely.

### ElevenLabs (Text-to-Speech)
-   **Function:** Generates high-quality synthetic speech.
-   **Data Transmitted:** Text segments from the content you are reading.
-   **Privacy Policy:** Usage is governed by [ElevenLabs Privacy Policy](https://elevenlabs.io/privacy).
-   **Control:** You must provide your own API Key. No data is sent unless you configure this key and actively play audio using an ElevenLabs voice.

### Google Cloud (Text-to-Speech and Speech-to-Text)
-   **Function:** Generates speech (Cloud TTS) and provides high-accuracy word timestamps (Cloud STT).
-   **Data Transmitted:** Text segments and/or generated audio data for alignment.
-   **Privacy Policy:** Usage is governed by [Google Cloud Privacy Notice](https://cloud.google.com/terms/cloud-privacy-notice).
-   **Control:** You must provide your own Service Account credentials.

## 4. Local Processing and Security (SOC 2 Alignment)

In alignment with SOC 2 principles for Security and Processing Integrity:

-   **Local-First Architecture:** Core processing, including Speech-to-Text (via Whisper.cpp/Vosk) and Forced Alignment, occurs entirely on your device (Client-Side).
-   **Storage Security:** Any locally stored data (such as cached audio alignments) serves only to improve performance and offline capability. You retain full control over this storage and can clear it via browser settings.
-   **Encryption:** All communication with optional third-party APIs (ElevenLabs, Google Cloud) occurs over encrypted HTTPS/TLS channels. We do not store your external API keys; they are saved in your browser's local storage.

## 5. GDPR Compliance

Under the General Data Protection Regulation (GDPR), we act as the provider of software that enables you to process your own data.

-   **Lawful Basis:** The processing of any temporary data within the application is necessary for the **Performance of a Contract** (i.e., delivering the reading functionality you requested).
-   **Data Minimization:** We adhere to strict data minimization. We collect **zero** data.
-   **Right to Erasure:** Since we do not store your data, there is nothing for us to erase. You have full control to delete the extension and its local data from your device at any time.
-   **International Transfers:** We do not transfer your data internationally because we do not collect your data. Transfers to third-party providers (like ElevenLabs) are initiated by you.

## 6. Children's Privacy (COPPA)

Our Service is designed to be safe for children. We do not knowingly collect personally identifiable information from anyone, including children under the age of 13.
-   **No Analytics:** We do not employ third-party analytics or tracking cookies.
-   **Parental Control:** Integrations with third-party cloud services require API keys, ensuring that parents strictly control any potential external data data transmission.

## 7. Changes to this Privacy Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.

## 8. Contact Us

If you have any questions about this Privacy Policy, you can open an issue on our GitHub repository: [https://github.com/jhcook/readalong](https://github.com/jhcook/readalong).
