# ReadAlong Web Extension

This directory contains the source code for the ReadAlong Extension.

## Development

The extension is built using Webpack and TypeScript.

### Prerequisites

- Node.js and npm installed.

### Google Cloud Setup (Optional)

To use high-quality Google Cloud voices (WaveNet, Neural2, Chirp) and the ReadAlong STT Round-Trip feature, you must configure a Google Cloud Project:

1.  **Create a Project**: Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2.  **Enable APIs**:
    *   **Cloud Text-to-Speech API**: Required for generating audio.
    *   **Cloud Speech-to-Text API**: **CRITICAL** for "Chirp 3" (HD) voices to support word-level highlighting (Round-Trip).
3.  **Create Service Account**:
    *   Go to **IAM & Admin > Service Accounts**.
    *   Create a new service account.
    *   Grant the role **"Cloud Text-to-Speech API User"** AND **"Cloud Speech-to-Text API User"**.
    *   Create a JSON key for this account and download it.
4.  **Configure Extension**:
    *   Open the ReadAlong Extension Options page.
    *   Upload the downloaded JSON key file in the "Google Cloud" section.

### Setup

1.  Navigate to this directory:
    ```bash
    cd web/extension
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Build

**Important:** You must rebuild the extension whenever you make changes to the source code (`src/` or `public/`).

To build the extension for production (minified):

```bash
npm run build
```

### Package

To build and package the extension for all browsers (Chrome, Firefox, Safari) into zip files:

```bash
npm run package
```

The generated zip files will be located in the `release/` directory.

### Distribution

For detailed instructions on publishing to official browser stores (Chrome, Firefox, Edge, Safari), see the [Distribution Guide](../../docs/distribution.md).

### Loading the Extension

For detailed installation instructions for **Chrome**, **Firefox**, **Edge**, and **Safari**, please refer to the main [Installation Guide](../../INSTALL.md).

1.  **Build**: Run `npm run build`.
2.  **Chrome/Edge**: Load unpacked from `web/extension/dist`.
3.  **Firefox**: Load temporary add-on from `web/extension/dist` (or `web/extension/dist-firefox` if packaged).
4.  **Safari**: Requires converting the web extension (see [Distribution](../../docs/distribution.md)).

## Project Structure

-   `src/`: TypeScript source code.
    -   `content/`: Content scripts (injected into web pages).
    -   `popup/`: Extension popup UI.
-   `public/`: Static assets (manifest, images, etc.).
-   `dist/`: compiled output (gitignored).

## Troubleshooting

-   **Changes not showing up?** Make sure you ran `npm run build` and then clicked the "Reload" icon on the extension card in `chrome://extensions`. Refresh the target web page after reloading the extension.
