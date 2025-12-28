# Developer Manual: ReadAlong Extension

## 1. Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd readalong
    ```

2.  **Install dependencies:**
    ```bash
    cd web/extension
    npm install
    ```

3.  **Build the extension:**
    ```bash
    npm run build
    ```
    This creates a `dist` folder in `web/extension/`.

## 2. Loading into Chrome/Edge

1.  Open Chrome/Edge and navigate to `chrome://extensions`.
2.  Enable **Developer mode** (toggle in the top-right).
3.  Click **Load unpacked**.
4.  Select the `web/extension/dist` directory.

## 3. Manual Testing Guide

### A. Basic Text Loading
1.  Navigate to a content-heavy page (e.g., [Wikipedia](https://en.wikipedia.org/wiki/Main_Page)).
2.  Click the extension icon -> **"Load Text from Page"**.
3.  **Verify:** A clean overlay appears with the extracted text.

### B. Accessibility Features
1.  **Dyslexia Font:** Click **"Dyslexia Font"**. Verify the font changes to a Comic Sans-style font.
2.  **High Contrast:** Click **"High Contrast"**. Verify the background turns black and text turns white.
3.  **Persistence:** Close the overlay (click "X") or refresh the page. Re-open the extension. Verify your previous settings are preserved.

### C. Voice Recording & Real-Time STT
1.  Click **"Record Voice"**.
2.  Grant microphone permission if prompted.
3.  **Verify:** The button turns red and pulses (CSS animation).
4.  Speak into the microphone.
5.  **Verify STT:** Open the Chrome DevTools (**Right-click page > Inspect > Console**). You should see logs like:
    *   `SttEngine initialized`
    *   `STT Result: ...` (with your transcribed text)
6.  Click **"Stop Recording"**.
7.  **Verify:** Console logs "Recording stopped, blob size: ...".

### D. Playback Simulation (Debug Mode)
1.  Click **"Play Simulation"** (if available).
2.  **Verify:** Words highlight sequentially in yellow.
3.  Click **"Pause"**. Verify highlighting stops.

## 4. Running Automated Tests

Run unit and integration tests using Jest:

```bash
cd web/extension
npm test
```

This runs tests for:
*   Text Extraction (`extractor.test.ts`)
*   Tokenization (`tokenizer.test.ts`)
*   Audio Recorder Logic (`AudioRecorder.test.ts`)
*   UI Components (`ReadingPane.test.tsx`, `Popup.test.tsx`)
*   Accessibility Logic (`ReadingPane.accessibility.test.tsx`)

## 5. Troubleshooting

*   **Extension not updating?** Click the "Reload" (circular arrow) icon on the extension card in `chrome://extensions` and refresh the target webpage.
*   **No Audio/STT?** Ensure your site is served over HTTPS (or use `localhost`). Check console for "Microphone permission denied" errors.
*   **WASM Errors?** If `vosk-browser` fails to load, check the Network tab in DevTools to ensure the `.wasm` file or model is being fetched correctly (currently fetched from CDN).