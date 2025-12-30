
import { Word } from '../types';

export const buildTextAndMap = (words: Word[]) => {
    let text = '';
    const map: number[] = [];

    words.forEach((word, index) => {
        // Current length is the start char index of this word
        const start = text.length;
        text += word.text;
        
        // Add space only if word doesn't end with whitespace
        if (!/\s$/.test(word.text)) {
            text += ' ';
        }

        // Map every character in this word (plus the trailing space if added) to this word index
        for (let i = start; i < text.length; i++) {
            map[i] = index;
        }
    });

    return { text: text.trim(), map };
};
