# ReadAlong Chrome Extension

This directory contains the source code for the ReadAlong Chrome Extension.

## Development

The extension is built using Webpack and TypeScript.

### Prerequisites

- Node.js and npm installed.

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

To watch for changes and rebuild automatically during development:

```bash
npm run watch
```

### Loading into Chrome

1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable "Developer mode" in the top right corner.
3.  Click "Load unpacked".
4.  Select the `dist` directory inside `web/extension` (Note: Webpack output is configured to `dist`, but manifest might be copied there. Ensure you pick the folder containing `manifest.json`. If `dist` is the output, point to it. Based on `webpack.config.js`, `copy-webpack-plugin` usually copies static assets like `manifest.json` to `dist`).

## Project Structure

-   `src/`: TypeScript source code.
    -   `content/`: Content scripts (injected into web pages).
    -   `popup/`: Extension popup UI.
-   `public/`: Static assets (manifest, images, etc.).
-   `dist/`: compiled output (gitignored).

## Troubleshooting

-   **Changes not showing up?** Make sure you ran `npm run build` and then clicked the "Reload" icon on the extension card in `chrome://extensions`. Refresh the target web page after reloading the extension.
