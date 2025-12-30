
import { extractMainContent } from './extractor';

describe('Extractor Performance/Robustness', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
        document.body.innerHTML = '';
    });

    test('Handles recursion within limit', () => {
        // Create a deep nested structure within limit
        let current = container;
        for (let i = 0; i < 400; i++) {
            const next = document.createElement('div');
            current.appendChild(next);
            current = next;
        }
        current.textContent = 'Deep content';

        const start = performance.now();
        const content = extractMainContent(document);
        const end = performance.now();

        expect(content).toContain('Deep content');
        console.log(`Deep extraction (400) took ${end - start}ms`);
    });

    test('Stops recursion gracefully when exceeding limit', () => {
        // Create a deep nested structure exceeding limit
        let current = container;
        for (let i = 0; i < 600; i++) {
            const next = document.createElement('div');
            current.appendChild(next);
            current = next;
        }
        current.textContent = 'Too deep content';

        const content = extractMainContent(document);
        // Should return empty or partial content, but definitely not crash
        expect(content).not.toContain('Too deep content');
    });

    test('Handles wide structure gracefully', () => {
        for (let i = 0; i < 5000; i++) {
            const p = document.createElement('p');
            p.textContent = `Paragraph ${i}`;
            container.appendChild(p);
        }

        const start = performance.now();
        const content = extractMainContent(document);
        const end = performance.now();

        expect(content).toBeTruthy();
        console.log(`Wide extraction took ${end - start}ms`);
    });
});
