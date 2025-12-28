import { AlignmentMap, Sentence, Word } from './types';

const ABBREVIATIONS = new Set([
  'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'St.', 'Capt.', 'Col.', 'Gen.', 'Lt.', 'Sen.', 'Rep.'
]);

export function tokenizeText(text: string): AlignmentMap {
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  const sentenceSegments = segmenter.segment(text);
  
  let rawSentences: string[] = [];
  for (const seg of sentenceSegments) {
    if (seg.segment.trim()) {
      rawSentences.push(seg.segment);
    }
  }

  // Post-process to merge abbreviations
  const mergedSentences: string[] = [];
  if (rawSentences.length > 0) {
    let currentSentence = rawSentences[0];
    for (let i = 1; i < rawSentences.length; i++) {
      const lastWord = currentSentence.trim().split(/\s+/).pop();
      if (lastWord && ABBREVIATIONS.has(lastWord)) {
        currentSentence += rawSentences[i]; // Merge directly, preserving original spacing
      } else {
        mergedSentences.push(currentSentence);
        currentSentence = rawSentences[i];
      }
    }
    mergedSentences.push(currentSentence);
  }

  const sentences: Sentence[] = [];
  let sentenceIndex = 0;

  for (const sentenceText of mergedSentences) {
    // Skip empty or whitespace-only sentences (again, just in case)
    if (!sentenceText.trim()) continue;

    const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const wordSegments = wordSegmenter.segment(sentenceText);
    const words: Word[] = [];
    let wordIndex = 0;

    for (const wordSegment of wordSegments) {
      if (wordSegment.isWordLike) {
        words.push({
          text: wordSegment.segment,
          index: wordIndex++
        });
      }
    }

    if (words.length > 0) {
      sentences.push({
        text: sentenceText.trim(),
        words,
        index: sentenceIndex++
      });
    }
  }

  return {
    sentences,
    fullText: text
  };
}
