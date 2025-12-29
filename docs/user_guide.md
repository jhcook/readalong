# ReadAlong User Guide

Welcome to the ReadAlong browser extension user guide. This document details how to use the features currently implemented in the extension.

## 1. Loading Text from a Webpage

The core feature of ReadAlong is extracting the main content from a webpage to provide a distraction-free reading experience.

**How to use:**
1. Navigate to any article or content-heavy webpage (e.g., a Wikipedia article or news story).
2. Click the **ReadAlong extension icon** in your browser toolbar.
3. Click the **"Load Text from Page"** button in the popup menu.
4. A clean overlay will appear, displaying the extracted text.

## 2. Reading and Playback Simulation

Once the text is loaded, you can simulate a "read along" experience where words are highlighted in sync with a simulated voice.

**How to use:**
1. Load text as described above.
2. In the reading pane header, click the **"Play Simulation"** button.
3. Observe as the words highlight sequentially in yellow.
4. Click **"Pause"** to stop the highlighting at the current word.
5. Click **"Play Simulation"** again to resume.

*Note: Currently, this is a simulation. Real audio playback will be implemented in future updates.*

## 3. Accessibility Modes

ReadAlong offers features to make reading more accessible for everyone.

### Dyslexia-Friendly Font
This mode changes the text font to one that is often easier for people with dyslexia to read (currently falling back to Comic Sans or similar installed fonts).

**How to use:**
1. In the reading pane header, click the **"Dyslexia Font"** button.
2. The text will immediately change to the dyslexia-friendly font.
3. Click **"Standard Font"** to revert to the default font.

### High-Contrast Mode
This mode changes the color scheme to a black background with white text, providing higher contrast for better visibility.

**How to use:**
1. In the reading pane header, click the **"High Contrast"** button.
2. The interface will switch to the high-contrast dark theme.
3. Click **"Normal Contrast"** to revert to the default light theme.

**Persistence:**
Your accessibility preferences are saved automatically. If you close the extension or reload the page, your last used font and contrast settings will be applied when you open ReadAlong again.

## 4. Voice Recording & Playback

Parents or users can record their own voice to be used for the read-along feature.

**How to use:**
1. In the reading pane header, click the **"Record Voice"** button.
2. If prompted, allow your browser to access the microphone.
3. The button will turn red and pulse to indicate recording is in progress.
4. Read the text aloud clearly.
5. Click **"Stop Recording"** when finished.
6. To listen to your recording:
    a. Click the **Settings** (gear) icon.
    b. In the "Voice Source" dropdown, select **"Record"**.
    c. Click **"Read Aloud"** (Play button) to hear your recording synchronized with the text.

*Note: Recordings are currently stored in your browser's memory for the current session.*
