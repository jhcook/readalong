const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.resolve(__dirname, '../dist');
const RELEASE_DIR = path.resolve(__dirname, '../release');
const DIST_FIREFOX_DIR = path.resolve(__dirname, '../dist-firefox');
const DIST_SAFARI_DIR = path.resolve(__dirname, '../dist-safari');

// Ensure clean state
if (fs.existsSync(RELEASE_DIR)) fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
if (fs.existsSync(DIST_FIREFOX_DIR)) fs.rmSync(DIST_FIREFOX_DIR, { recursive: true, force: true });
if (fs.existsSync(DIST_SAFARI_DIR)) fs.rmSync(DIST_SAFARI_DIR, { recursive: true, force: true });

fs.mkdirSync(RELEASE_DIR);

console.log('Packaging for Chrome/Edge...');
try {
    // Check if zip command exists
    execSync('zip -v', { stdio: 'ignore' });
} catch (e) {
    console.error('Error: "zip" command not found. Please install zip.');
    process.exit(1);
}

// Chrome/Edge (Standard dist)
execSync(`zip -r ${path.join(RELEASE_DIR, 'readalong-chrome.zip')} . -x "*.DS_Store" -x "__MACOSX/*" -x "icon-original.png"`, { cwd: DIST_DIR });
console.log('Chrome package created: readalong-chrome.zip');

// Firefox
console.log('Packaging for Firefox...');
fs.cpSync(DIST_DIR, DIST_FIREFOX_DIR, { recursive: true });
const manifestPath = path.join(DIST_FIREFOX_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.browser_specific_settings = {
    gecko: {
        id: "readalong@ccoreilly.github.io",
        strict_min_version: "142.0",
        data_collection_permissions: {
            required: ["none"]
        }
    },
    gecko_android: {}
};

// Remove offscreen permission (not supported in Firefox)
if (manifest.permissions) {
    manifest.permissions = manifest.permissions.filter(p => p !== 'offscreen');
}

// Remove sandbox (vosk-browser is 5.5MB, exceeds Firefox's 5MB file limit)
if (manifest.sandbox) {
    delete manifest.sandbox;
}
// Also remove from web_accessible_resources
if (manifest.web_accessible_resources) {
    manifest.web_accessible_resources = manifest.web_accessible_resources.map(war => ({
        ...war,
        resources: war.resources.filter(r => r !== 'sandbox.html')
    }));
}

// Firefox MV3 uses background.scripts, not service_worker (though it supports SW, scripts is preferred for compatibility/linting)
if (manifest.background && manifest.background.service_worker) {
    manifest.background.scripts = [manifest.background.service_worker];
    delete manifest.background.service_worker;
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Delete sandbox files from Firefox dist (exceed 5MB limit)
const sandboxJsPath = path.join(DIST_FIREFOX_DIR, 'sandbox.js');
const sandboxHtmlPath = path.join(DIST_FIREFOX_DIR, 'sandbox.html');
if (fs.existsSync(sandboxJsPath)) fs.unlinkSync(sandboxJsPath);
if (fs.existsSync(sandboxHtmlPath)) fs.unlinkSync(sandboxHtmlPath);

execSync(`zip -r ${path.join(RELEASE_DIR, 'readalong-firefox.zip')} . -x "*.DS_Store" -x "__MACOSX/*" -x "icon-original.png"`, { cwd: DIST_FIREFOX_DIR });
console.log('Firefox package created: readalong-firefox.zip');

// Safari
console.log('Packaging for Safari...');
fs.cpSync(DIST_DIR, DIST_SAFARI_DIR, { recursive: true });
// Safari usually just needs the folder or the xcode project, providing the zip for distribution
execSync(`zip -r ${path.join(RELEASE_DIR, 'readalong-safari.zip')} . -x "*.DS_Store" -x "__MACOSX/*" -x "icon-original.png"`, { cwd: DIST_SAFARI_DIR });
console.log('Safari package created: readalong-safari.zip');

console.log('Cleaning up temporary directories...');
fs.rmSync(DIST_FIREFOX_DIR, { recursive: true, force: true });
fs.rmSync(DIST_SAFARI_DIR, { recursive: true, force: true });

console.log('Done! Packages are in "release" folder.');
