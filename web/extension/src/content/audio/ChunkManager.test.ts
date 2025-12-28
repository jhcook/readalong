import { ChunkManager } from './ChunkManager';
import { AlignmentMap, Sentence, Word } from '../types';

describe('ChunkManager', () => {
    const createMockSentence = (text: string, index: number, wordStartIndex: number): Sentence => {
        const words: Word[] = text.split(' ').map((w, i) => ({
            text: w,
            index: wordStartIndex + i
        }));
        return {
            text,
            words,
            index
        };
    };

    it('splits text into chunks respecting maxChars', () => {
        // Create 3 sentences length ~10 chars each
        const s1 = createMockSentence('Hello world one', 0, 0); // ~15 chars
        const s2 = createMockSentence('Hello world two', 1, 3);
        const s3 = createMockSentence('Hello world three', 2, 6); // ~17 chars

        const map: AlignmentMap = {
            fullText: 'Hello world one. Hello world two. Hello world three.',
            sentences: [s1, s2, s3]
        };

        // Max chars 20. Should fit s1 (15), s2 (15) -> 30 > 20.
        // So Chunk 1: s1
        // Chunk 2: s2
        // Chunk 3: s3
        // Wait, logic: if (current + new > max) finalize.
        // s1: current=0 + 15 = 15. OK.
        // s2: current=15 + 15 = 30 > 20. Finalize s1. Start s2.
        // s3: current=15 + 17 = 32 > 20. Finalize s2. Start s3.

        const chunks = ChunkManager.createChunks(map, 20);

        expect(chunks.length).toBe(3);
        expect(chunks[0].sentences).toHaveLength(1);
        expect(chunks[0].text).toBe('Hello world one');

        expect(chunks[1].sentences).toHaveLength(1);
        expect(chunks[1].text).toBe('Hello world two');
    });

    it('groups multiple sentences if they fit', () => {
        const s1 = createMockSentence('Short', 0, 0); // 5 chars
        const s2 = createMockSentence('Brief', 1, 1); // 5 chars
        const s3 = createMockSentence('Tiny', 2, 2);  // 4 chars
        const s4 = createMockSentence('Longer sentence here breaks it', 3, 3); // ~30 chars

        const map: AlignmentMap = {
            fullText: '...',
            sentences: [s1, s2, s3, s4]
        };

        // Max 20.
        // s1 (5) + s2 (5) + s3 (4) = 14.
        // s4 adds 30 -> 44 > 20.
        // Chunk 1: s1, s2, s3.
        // Chunk 2: s4.

        const chunks = ChunkManager.createChunks(map, 20);

        expect(chunks.length).toBe(2);
        expect(chunks[0].sentences).toHaveLength(3);
        expect(chunks[0].text).toContain('Short');
        expect(chunks[0].text).toContain('Tiny');

        expect(chunks[1].sentences).toHaveLength(1);
        expect(chunks[1].text).toBe('Longer sentence here breaks it');
    });

    it('handles a single sentence exceeding limit by creating a standalone chunk', () => {
        const longText = 'A'.repeat(50);
        const s1 = createMockSentence(longText, 0, 0);

        const map: AlignmentMap = {
            fullText: longText,
            sentences: [s1]
        };

        // Max 10.
        const chunks = ChunkManager.createChunks(map, 10);

        expect(chunks.length).toBe(1);
        expect(chunks[0].text).toBe(longText);
    });
});
