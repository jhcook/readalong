
import { tokenizeText } from './tokenizer';
import { buildTextAndMap } from './utils/textUtils';

describe('Tokenizer Reproduction', () => {
    it('handles leading quotes with space correctly', () => {
        // Case 1: "idea of “vibecoding”" -> "idea of “ vibecoding”"
        // User report: “ vibecoding,” 
        // Likely source: ... of “vibecoding
        const text = 'idea of “vibecoding,”';
        const result = tokenizeText(text);
        
        const { text: reconstructed } = buildTextAndMap(result.sentences[0].words);
        
        // We expect NO space between “ and vibecoding if source didn't have one.
        // Current bug suspicion: "of “ vibecoding"
        console.log('Quote output:', reconstructed);
        expect(reconstructed).toBe('idea of “vibecoding,”');
    });

    it('handles hyphenated words without adding space', () => {
        // Case 2: "sub-agents" -> "sub- agents"
        const text = 'sub-agents';
        const result = tokenizeText(text);
        
        const { text: reconstructed } = buildTextAndMap(result.sentences[0].words);
        
        console.log('Hyphen output:', reconstructed);
        expect(reconstructed).toBe('sub-agents');
    });
});
