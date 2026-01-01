
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

import { JSDOM } from 'jsdom';
import { extractMainContent, cleanExtractedHtml } from './extractor';

describe('Whitespace Extraction Regression', () => {
    it('repairs spacing regressions in cleanExtractedHtml', () => {
        // Input with BAD spacing (simulating the regression)
        const input = `<p>Metro Performance Glass (NZE: MPG, ASX: MPP) and NZ$ 778,175 value.</p>`;
        const output = cleanExtractedHtml(input);

        // Expect REPAIRED spacing
        expect(output).toContain('NZE:MPG');
        expect(output).toContain('NZ$778,175');

        expect(output).not.toContain('NZE: MPG');
        expect(output).not.toContain('NZ$ 778,175');
    });
});
