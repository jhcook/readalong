import { extractMainContent } from './extractor';

describe('extractMainContent - Stress Tests (MSN Repro)', () => {
    it('handles null body gracefully', () => {
        // obscure case where doc.body is missing (e.g. XML)
        const doc = document.implementation.createHTMLDocument('No Body');
        Object.defineProperty(doc, 'body', { value: null });
        const result = extractMainContent(doc);
        expect(result).toBe('');
    });

    it('handles deeply nested content without crashing', () => {
        let content = 'Start';
        for (let i = 0; i < 1000; i++) {
            content = `<div>${content}</div>`;
        }
        document.body.innerHTML = content;
        const result = extractMainContent(document);
        // Readability usually handles this, or falls back. Should not throw.
        expect(typeof result).toBe('string');
    });

    it('handles very large DOMs', () => {
        const p = '<p>Some text content here.</p>';
        document.body.innerHTML = p.repeat(5000);
        const result = extractMainContent(document);
        expect(typeof result).toBe('string');
    });

    it('handles malformed HTML or custom tags', () => {
        document.body.innerHTML = `
      <custom-tag>
        <nested-custom>Content</nested-custom>
      </custom-tag>
      <unclosed-tag>
    `;
        const result = extractMainContent(document);
        expect(typeof result).toBe('string');
    });

    it('correctly flattens Shadow DOM with slots (MSN structure)', () => {
        // Simulate <fluent-design-system-provider> with shadow root and slot
        const host = document.createElement('div');
        host.attachShadow({ mode: 'open' });

        // Shadow DOM has a slot
        const slot = document.createElement('slot');
        host.shadowRoot?.appendChild(slot);

        // Light DOM has the content
        const content = document.createElement('p');
        content.textContent = 'This is the main article content inside Light DOM.';
        host.appendChild(content);

        document.body.appendChild(host);

        const result = extractMainContent(document);
        expect(result).toContain('This is the main article content inside Light DOM.');
    });

    it('filters out MSN specific copyright ("© Nine") via intelligent filter', () => {
        document.body.innerHTML = `
            <cp-article>
            <div class="article-body">
                <h1>Article Title</h1>
                <p>Content</p>
                <div class="image-attribution">© Nine</div>
                <p>More Content</p>
                <p>Photos: Someone</p>
                <p>:Stay across all the latest in breaking news, sport, politics and the weather via our news app and get notifications sent straight to your smartphone.</p>
                <p>Available on the Apple App Store and Google Play.</p>
             </div>
            </cp-article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('Content');
        expect(result).not.toContain('© Nine');
        expect(result).not.toContain('Photos: Someone');
        expect(result).not.toContain('Stay across all the latest');
        expect(result).not.toContain('Available on the Apple App Store');
    });
});
