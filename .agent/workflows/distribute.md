---
description: How to package the extension for official store distribution
---

# Extension Distribution Workflow

This workflow automates the packaging of the ReadAlong extension for release.

// turbo-all
1. Navigate to the extension directory:
   `cd web/extension`
2. Install dependencies:
   `npm install`
3. Run the automated packaging script:
   `npm run package`
4. Verify the packages exist in the `release` folder:
   `ls -l release/`

The generated files in `web/extension/release/` are ready for upload to their respective stores.
- `readalong-chrome.zip`: Chrome Web Store, Microsoft Edge Add-ons.
- `readalong-firefox.zip`: Firefox Add-ons (AMO).
- `readalong-safari.zip`: (Note: Safari may require further steps using Xcode for App Store submission).
