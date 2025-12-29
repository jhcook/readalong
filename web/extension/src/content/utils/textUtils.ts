
import { Word } from '../types';

export const buildTextAndMap = (words: Word[]) => {
    let text = '';
    const map: number[] = [];

    words.forEach((word, index) => {
        // Current length is the start char index of this word
        const start = text.length;
        text += word.text + ' ';
        // Map every character in this word (plus the trailing space) to this word index
        for (let i = start; i < text.length; i++) {
            map[i] = index;
        }
    });

    return { text: text.trim(), map };
};
