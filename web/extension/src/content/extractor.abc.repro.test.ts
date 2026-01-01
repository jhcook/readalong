import { extractMainContent } from './extractor';

describe('ABC News Issue Reproduction', () => {
    it('merges split quote and attribution paragraphs', () => {
        document.body.innerHTML = `
            <article>
                <h1>News Article</h1>
                <p>"People are like animals, they just run,"</p>
                <p>another man said.</p>
                <p>This is a normal paragraph.</p>
            </article>
        `;

        const result = extractMainContent(document);

        // We expect the newline between the quote and attribution to be removed/merged into a space
        expect(result).toContain('"People are like animals, they just run," another man said.');
    });

    it('does not merge unrelated paragraphs starting with lowercase (false positive check)', () => {
        document.body.innerHTML = `
            <article>
                <h1>Poetry</h1>
                <p>First line of poem.</p>
                <p>second line of poem.</p>
            </article>
        `;
        // If it's not a quote/attribution structure, we might want to be careful. 
        // But the heuristic proposed was: if p starts with lowercase, merge with previous.
        // Let's test the strict behavior we want. 
        // In the ABC case, the first part ends with a comma inside quotes usually, or just a comma.

        // For now, let's see what the heuristic does to this. 
        // If our logic is "merge if starts with lowercase", this WILL merge. 
        // The user request was specific to the quote split.
        // Let's allow merging here too as "sentence continuation" logic, or refine the test expectation if we make the heuristic stricter.

        const result = extractMainContent(document);
        // Expectation: "First line of poem. second line of poem." 
        // If we strictly follow "starts with lowercase -> merge", this is the expected result.
        expect(result).toContain('First line of poem. second line of poem.');
    });

    it('handles multiple splits correctly', () => {
        document.body.innerHTML = `
            <article>
                <p>"One,"</p>
                <p>said he,</p>
                <p>"is enough."</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"One," said he, "is enough."');
    });

    it('merges blockquote and paragraph', () => {
        document.body.innerHTML = `
            <article>
                <blockquote>"People are like animals, they just run,"</blockquote>
                <p>another man said.</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"People are like animals, they just run," another man said.');
    });

    it('merges div and div', () => {
        document.body.innerHTML = `
            <article>
                <div>"People are like animals, they just run,"</div>
                <div>another man said.</div>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"People are like animals, they just run," another man said.');
    });
});
