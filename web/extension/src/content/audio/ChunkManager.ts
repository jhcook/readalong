import { AlignmentMap, Sentence } from '../types';

export interface AudioChunk {
    id: number;
    text: string;
    sentences: Sentence[];
    startWordIndex: number;
    endWordIndex: number;
    audioUrl?: string; // Blob URL
    alignment?: any;   // ElevenLabs alignment
    status: 'pending' | 'loading' | 'ready' | 'error';
    error?: string;
}

export class ChunkManager {
    static createChunks(alignmentMap: AlignmentMap, maxChars: number = 2500): AudioChunk[] {
        const chunks: AudioChunk[] = [];
        let currentChunkSentences: Sentence[] = [];
        let currentChunkTextLength = 0;
        let chunkId = 0;

        const finalizeChunk = () => {
            if (currentChunkSentences.length === 0) return;

            const firstSentence = currentChunkSentences[0];
            const lastSentence = currentChunkSentences[currentChunkSentences.length - 1];

            // Determine word indices
            const startWordIndex = firstSentence.words.length > 0 ? firstSentence.words[0].index : -1;
            const lastWord = lastSentence.words[lastSentence.words.length - 1];
            const endWordIndex = lastWord ? lastWord.index : -1;

            // Reconstruct text for this chunk
            // We rely on sentence text. If sentence text structure is just 'text', we join them.
            // Assuming sentence.text contains original spacing/punctuation if possible, or we join with space.
            // Looking at types, sentence has .text.
            const text = currentChunkSentences.map(s => s.text).join(' ');

            chunks.push({
                id: chunkId++,
                text: text,
                sentences: [...currentChunkSentences],
                startWordIndex,
                endWordIndex,
                status: 'pending'
            });

            currentChunkSentences = [];
            currentChunkTextLength = 0;
        };

        alignmentMap.sentences.forEach((sentence) => {
            // If adding this sentence exceeds maxChars AND we have at least one sentence already,
            // finalize the current chunk.
            // (If a single sentence is huge > maxChars, we still put it in its own chunk so we don't split mid-sentence).
            if (currentChunkTextLength + sentence.text.length > maxChars && currentChunkSentences.length > 0) {
                finalizeChunk();
            }

            currentChunkSentences.push(sentence);
            currentChunkTextLength += sentence.text.length;
        });

        // Finalize any remaining sentences
        finalizeChunk();

        return chunks;
    }
}
