
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const EXTENSION_PATH = path.resolve(__dirname, '../dist'); // Assuming 'dist' is the built extension
    const ASSETS_DIR = path.resolve(__dirname, '../assets');
    const FIXTURE_PATH = path.resolve(__dirname, '../src/tests/fixtures/audit/wikipedia.html');
    const FIXTURE_CONTENT = fs.readFileSync(FIXTURE_PATH, 'utf8');

    // Ensure assets directory exists
    if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false, // Debugging
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--allow-file-access-from-files'
        ],
        dumpio: true
    });

    try {
        // Wait for extension background to be ready
        let serviceWorkerTarget;
        console.log('Waiting for extension service worker...');

        // Poll for service worker
        for (let i = 0; i < 20; i++) {
            const targets = await browser.targets();
            serviceWorkerTarget = targets.find(t => t.type() === 'service_worker');
            if (serviceWorkerTarget) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!serviceWorkerTarget) {
            throw new Error('Could not find extension service worker destination');
        }

        const worker = await serviceWorkerTarget.worker();
        console.log('Extension service worker found.');
        worker.on('console', msg => console.log('WORKER LOG:', msg.text()));

        const page = await browser.newPage();

        page.on('dialog', async dialog => {
            console.log('DIALOG:', dialog.message());
            await dialog.dismiss();
        });

        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to a http URL to ensure extension activates (file:// often restricted)
        console.log('Navigating to http://example.com...');
        await page.goto('http://example.com', { waitUntil: 'networkidle0' });

        // Inject fixture content
        console.log('Injecting fixture content...');
        await page.setContent(FIXTURE_CONTENT);

        // Get current tab ID from the page context requires a bit of trickery or just relying on active tab query in background
        // But since we have the worker, we can just ask it to send to the active tab.

        console.log('Triggering ReadAlong via background script...');
        await worker.evaluate(() => {
            return new Promise((resolve, reject) => {
                console.log('Worker evaluate started');
                chrome.tabs.query({}, (tabs) => {
                    console.log('Tabs found:', tabs.length);
                    // Find our tab
                    const tab = tabs.find(t => t.url && (t.url.startsWith('http')));

                    if (tab) {
                        console.log('Sending LOAD_TEXT to tab:', tab.id, tab.url);
                        chrome.tabs.sendMessage(tab.id, { type: 'LOAD_TEXT' })
                            .then(() => {
                                console.log('Message sent successfully');
                                resolve();
                            })
                            .catch(err => {
                                console.error('Error sending message:', err);
                                resolve(); // Resolve anyway to not hang
                            });
                    } else {
                        console.error('No matching tab found. Open tabs:', tabs.map(t => t.url));
                        resolve();
                    }
                });
            });
        });

        // Wait for overlay
        console.log('Waiting for overlay...');
        const overlaySelector = '.readalong-overlay';
        try {
            await page.waitForSelector(overlaySelector, { timeout: 5000 });
        } catch (e) {
            console.error('Overlay did not appear. Dumping console logs:');
            page.on('console', msg => console.log('PAGE LOG:', msg.text()));
            throw e;
        }

        // --- Scenario 1: Default (Professional) ---
        console.log('Capturing: promo_professional.png');
        // Wait a bit for animations
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(ASSETS_DIR, 'promo_professional.png') });

        // --- Scenario 2: Kids (Playful) ---
        console.log('Switching to Playful theme...');
        // We need to click the settings button, then select theme.
        // Assuming there is a settings button. Let's inspect known classes from styles.css
        // .readalong-header contains buttons. 
        // We probably need to implement logic to switch themes via UI or direct injection.
        // Direct injection of class might be easier if we just want the look.

        await page.evaluate(() => {
            const overlay = document.querySelector('.readalong-overlay');
            if (overlay) {
                // Remove existing themes
                overlay.classList.remove('theme-academic', 'theme-minimal', 'theme-playful', 'theme-building-blocks');
                // Add playful
                overlay.classList.add('theme-playful');
            }
        });

        console.log('Capturing: promo_kids.png');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(ASSETS_DIR, 'promo_kids.png') });

        // --- Scenario 3: Accessibility ---
        console.log('Switching to High Contrast + Dyslexia...');
        await page.evaluate(() => {
            const overlay = document.querySelector('.readalong-overlay');
            if (overlay) {
                overlay.classList.remove('theme-playful');
                overlay.classList.add('high-contrast');
                overlay.classList.add('dyslexia-font');
            }
        });

        console.log('Capturing: promo_accessibility.png');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(ASSETS_DIR, 'promo_accessibility.png') });

        // Clean up
        console.log('Done.');

    } catch (e) {
        console.error('Error during screenshot generation:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
