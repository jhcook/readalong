
import { buildTextAndMap } from './textUtils';
import { Word } from '../types';

describe('buildTextAndMap', () => {
    it('constructs text and map from words', () => {
        const words: Word[] = [
            { text: 'Hello', index: 0 },
            { text: 'world', index: 1 }
        ];

        const { text, map } = buildTextAndMap(words);
        
        // Current behavior adds space: "Hello world"
        expect(text).toBe('Hello world');
        
        // Map: "Hello " -> 0. "world " -> 1.
        expect(map[0]).toBe(0); // H
        expect(map[5]).toBe(0); // space
        expect(map[6]).toBe(1); // w
    });

    it('handles words that already have spaces', () => {
        const words: Word[] = [
            { text: 'Hello ', index: 0 },
            { text: 'world. ', index: 1 }
        ];

        const { text, map } = buildTextAndMap(words);
        
        // Should now be single spaced (trimmed)
        expect(text).toBe('Hello world.');
    });
});
