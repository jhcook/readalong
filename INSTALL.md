# Installing ReadAlong

ReadAlong is currently available for manual installation. Please follow the instructions for your specific browser.

## Chrome / Edge / Brave

1.  Download the `readalong-chrome.zip` file.
2.  Extract the zip file to a folder.
3.  Open your browser and navigate to the extensions page:
    *   **Chrome**: `chrome://extensions`
    *   **Edge**: `edge://extensions`
    *   **Brave**: `brave://extensions`
4.  Enable **Developer mode** (usually a toggle in the top right).
5.  Click **Load unpacked**.
6.  Select the folder where you extracted the extension.

## Firefox

1.  Download the `readalong-firefox.zip` file.
2.  Extract the zip file.
3.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
4.  Click **Load Temporary Add-on...**.
5.  Navigate to the extracted folder and select the `manifest.json` file.

*Note: Temporary add-ons are removed when you restart Firefox.*

## Safari

1.  Download the `readalong-safari.zip` file.
2.  Extract the zip file.
3.  Make sure you have enabled the **Develop** menu in Safari:
    *   Go to **Safari** > **Settings** > **Advanced**.
    *   Check **"Show Develop menu in menu bar"**.
4.  In the Develop menu, verify that **"Allow Unsigned Extensions"** is checked.
5.  Open Safari and go to **Safari** > **Settings** > **Extensions**.
6.  (Note: Safari typically requires extensions to be packaged as Apps. For development testing, you may need to use Xcode to build the extension container).
    *   *Alternative*: If you are a developer, you can convert the web extension using `xcrun safari-web-extension-converter path/to/extracted/folder` and run it via Xcode.

## Official Channels (Coming Soon)

We are working on making ReadAlong available on official browser stores.

- [**Chrome Web Store**](#)
- [**Firefox Add-ons**](#)
- [**Microsoft Edge Add-ons**](#)

---

> [!TIP]
> For maintainers looking to publish updates, please refer to the [Distribution Guide](docs/distribution.md).
