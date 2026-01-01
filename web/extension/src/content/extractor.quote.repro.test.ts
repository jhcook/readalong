import { extractMainContent } from './extractor';

describe('Split Quote Issue Reproduction', () => {
    it('merges quotes split mid-sentence with uppercase continuation', () => {
        document.body.innerHTML = `
            <article>
                <p>"I was thinking, this is insane.</p>
                <p>I think we were some of the first 100 people in the line."</p>
            </article>
        `;

        const result = extractMainContent(document);
        // Expect single line
        expect(result).toContain('"I was thinking, this is insane. I think we were some of the first 100 people in the line."');
    });

    it('merges multi-paragraph split quotes', () => {
        // Assuming the user meant the quote started at the beginning of the block
        document.body.innerHTML = `
            <article>
                <p>"[It was] crazy.</p>
                <p>I live in Germany.</p>
                <p>I've never experienced anything like this before," she said.</p>
            </article>
        `;

        const result = extractMainContent(document);
        expect(result).toContain('"[It was] crazy. I live in Germany. I\'ve never experienced anything like this before," she said.');
    });

    it('does not merge balanced quotes followed by new paragraph', () => {
        document.body.innerHTML = `
            <article>
                <p>"This is a complete quote."</p>
                <p>This is a new thought.</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"This is a complete quote."');
        expect(result).toContain('<p>This is a new thought.</p>');
        // Should NOT be: "This is a complete quote." This is a new thought.
    });

    it('merges quotes separated by br tags (intervening elements)', () => {
        document.body.innerHTML = `
            <article>
                <p>"This is a split quote</p>
                <br>
                <p>with a br tag."</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"This is a split quote with a br tag."');
    });

    it('merges quotes separated by empty elements', () => {
        document.body.innerHTML = `
            <article>
                <p>"Split quote</p>
                <span></span>
                <p>with empty span."</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"Split quote with empty span."');
    });

    it('merges quotes separated by invisible zero-width space (robustness)', () => {
        // \u200B is zero width space. Standard trim() ignores it, but our robust regex matched it.
        document.body.innerHTML = `
            <article>
                <p>"Quote starts here.</p>
                ${'\u200B'}
                <p>Quote ends here."</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"Quote starts here. Quote ends here."');
    });

    it('flattens nested block tags when merging to prevent invalid HTML', () => {
        // If we merge a DIV containing a P into a P, we must strip the block tags
        // otherwise we get <p>...<div>...</div></p> or <p>...<p>...</p></p> which breaks visually.
        document.body.innerHTML = `
            <article>
                <p>"Quote starts.</p>
                <div><p>"Quote ends."</p></div>
            </article>
        `;
        const result = extractMainContent(document);
        // Should contain flattened text
        expect(result).toContain('"Quote starts. "Quote ends."');
        // Should NOT contain nested tags
        expect(result).not.toMatch(/<p>.*<p>/s);
        expect(result).not.toMatch(/<p>.*<div>/s);
    });

    it('ignores non-content tags (SVG, STYLE) between paragraphs', () => {
        document.body.innerHTML = `
            <article>
                <p>"Quote starts.</p>
                <svg>...</svg>
                <style>.junk { color: red; }</style>
                <p>Quote ends."</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"Quote starts. Quote ends."');
    });

    it('ignores elements with only symbols (***, ...) between paragraphs', () => {
        document.body.innerHTML = `
            <article>
                <p>"Quote starts.</p>
                <div class="separator">***</div>
                <p>Quote ends."</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"Quote starts. Quote ends."');
    });

    it('ignores hidden text elements between paragraphs', () => {
        document.body.innerHTML = `
            <article>
                <p>"Quote starts.</p>
                <div style="display: none;">This text is hidden but contentful.</div>
                <p>Quote ends."</p>
            </article>
        `;
        const result = extractMainContent(document);
        expect(result).toContain('"Quote starts. Quote ends."');
    });
});
