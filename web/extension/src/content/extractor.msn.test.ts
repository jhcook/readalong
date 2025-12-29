
import { extractMainContent, extractContentFromNode } from './extractor';

describe('MSN Content Extraction (Shadow DOM)', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    test('Extracts content from Shadow DOM', () => {
        // Simulate MSN structure: A host element with a Shadow Root
        const host = document.createElement('div');
        host.id = 'msn-article-host';
        container.appendChild(host);

        const shadowRoot = host.attachShadow({ mode: 'open' });

        // Create content inside Shadow DOM
        const articleContainer = document.createElement('div');
        articleContainer.className = 'article-body';

        const p1 = document.createElement('p');
        p1.textContent = 'This is the main article content hidden in Shadow DOM.';
        articleContainer.appendChild(p1);

        const p2 = document.createElement('p');
        p2.textContent = 'It should be extractable by the updated extractor.';
        articleContainer.appendChild(p2);

        shadowRoot.appendChild(articleContainer);

        // Current behavior (using cloneNode) likely returns empty or host content only
        // Expected behavior: Concatenated text of paragraphs
        const content = extractMainContent(document);

        expect(content).toContain('This is the main article content hidden in Shadow DOM.');
        expect(content).toContain('It should be extractable by the updated extractor.');
    });

    test('extractContentFromNode handles Shadow DOM on specific element', () => {
        // HOST with Shadow DOM
        const host = document.createElement('div');
        container.appendChild(host);
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const p = document.createElement('p');
        p.textContent = 'Shadow Content Selected';
        shadowRoot.appendChild(p);

        const extracted = extractContentFromNode(host);
        expect(extracted).toContain('Shadow Content Selected');
    });
});
