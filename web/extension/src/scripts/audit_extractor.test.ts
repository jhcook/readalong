
import * as fs from 'fs';
import * as path from 'path';
import { extractMainContent } from '../content/extractor';

const FIXTURES_DIR = path.join(__dirname, '../tests/fixtures/audit');

describe('Domain Audit', () => {
    it('generates audit report', () => {
        if (!fs.existsSync(FIXTURES_DIR)) {
            console.warn(`Fixtures directory not found: ${FIXTURES_DIR} `);
            return;
        }

        const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.html'));

        console.log(`\nAuditing ${files.length} files...`);
        console.log('| Domain | Status | Title Detected? | Word Count | Sample Text |');
        console.log('|---|---|---|---|---|');

        for (const file of files) {
            const filePath = path.join(FIXTURES_DIR, file);
            const html = fs.readFileSync(filePath, 'utf-8');

            // Use existing Jest environment DOM
            const doc = document.implementation.createHTMLDocument('Audit Doc');
            doc.documentElement.innerHTML = html;

            const extractedHtml = extractMainContent(doc);

            // Metrics using DOMParser
            const parser = new DOMParser();
            const tempDoc = parser.parseFromString(extractedHtml, 'text/html');
            const textContent = tempDoc.body.textContent || '';
            const wordCount = textContent.split(/\s+/).length;
            const hasTitle = extractedHtml.includes('<h1>') || extractedHtml.includes('<h2>');
            const sample = textContent.slice(0, 100).replace(/\n/g, ' ').trim() + '...';

            const status = wordCount > 50 ? '✅ Pass' : '❌ Fail (Low Content)';

            console.log(`| ${file} | ${status} | ${hasTitle ? 'Yes' : 'No'} | ${wordCount} | ${sample} | `);
        }
    });
});
