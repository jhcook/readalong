import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });
import { JSDOM } from 'jsdom';
import { extractMainContent } from './extractor';

// Mock specific DOM APIs required for Shadow DOM
// Since JSDOM has limited Shadow DOM support, we simulate the flattened structure behavior
// or try to use JSDOM's shadow root if available.
// NOTE: JSDOM 16+ supports Shadow DOM.
describe('MSN Ordering Extraction', () => {
    it('preserves order of Shadow DOM mixed with Slotted Light DOM content', () => {
        // We construct a DOM that mimics the MSN structure
        // <cp-article>
        //   (Light) <img slot="image">
        //   (Shadow) <div class="article-body">
        //              <p>Paragraph 1</p>
        //              <slot name="image"></slot>
        //              <p>Paragraph 2</p>
        //            </div>
        // </cp-article>

        const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <cp-article>
            <div slot="image-slot" id="light-image">IMAGE CONTENT</div>
            <div slot="ad-slot" id="light-ad">AD CONTENT</div>
          </cp-article>
        </body>
      </html>
    `, {
            runScripts: "dangerously",
            resources: "usable"
        });

        const doc = dom.window.document;
        const article = doc.querySelector('cp-article')!;

        // Attach Shadow DOM
        const shadowRoot = article.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = `
      <div class="article-body">
        <p>Paragraph 1 Start</p>
        <slot name="image-slot"></slot>
        <p>Short paragraph here.</p>
        <p>He ordered lawyers for both sides.</p>
        <p>Paragraph 2 Middle</p>
        <slot name="ad-slot"></slot>
        <p>Paragraph 3 End</p>
      </div>
    `;

        // Verify JSDOM supports assignedNodes
        // Note: JSDOM might not fully update assignedNodes automatically without a bit of help 
        // or passing the right options, but standard usage should work in recent versions.

        // Run the extraction
        const result = extractMainContent(doc);

        // We expect the text to be in the order defined by the Shadow DOM
        expect(result).toContain('Paragraph 1 Start');
        expect(result).toContain('Paragraph 2 Middle');
        expect(result).toContain('Paragraph 3 End');

        // Check strict order by finding indices
        const idx1 = result.indexOf('Paragraph 1 Start');
        const idx2 = result.indexOf('Paragraph 2 Middle');
        const idx3 = result.indexOf('Paragraph 3 End');

        expect(idx1).toBeLessThan(idx2);
        expect(idx2).toBeLessThan(idx3);

        // Check if slotted content is included (unlikely to be text, but let's see if the placeholder is preserved)
        // Actually, 'IMAGE CONTENT' might be stripped if its a div? 
        // It depends on Readability. But 'Paragraph 2' should definitely be BETWEEN 1 and 3.
    });

    it('handles "Continue Reading" break slots without dropping processing', () => {
        // Structure with a break slot
        const dom = new JSDOM(`
      <!DOCTYPE html>
      <body>
        <cp-article>
           <div slot="cont-read-break">CONTINUE BUTTON</div>
        </cp-article>
      </body>
    `);
        const doc = dom.window.document;
        const article = doc.querySelector('cp-article')!;
        const shadowRoot = article.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = `
      <div class="article-body">
         <p>Before Break</p>
         <p class="continue-read-break"><slot name="cont-read-break"></slot></p>
         <p>After Break</p>
      </div>
    `;

        const result = extractMainContent(doc);
        expect(result).toContain('Before Break');
        expect(result).toContain('After Break');
    });
});
