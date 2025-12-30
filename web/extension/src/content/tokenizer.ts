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
    
    let currentBuffer = '';
    let bufferHasWord = false;

    for (const wordSegment of wordSegments) {
      if (wordSegment.isWordLike) {
        if (bufferHasWord) {
          // Check for hyphenated word case (e.g. sub-agents)
          // If buffer ends in a hyphen (and not space), merge instead of flush
          if (currentBuffer.endsWith('-') && !/\s$/.test(currentBuffer)) {
             currentBuffer += wordSegment.segment;
             // Still has word, continue
          } else {
             // Standard flush
             words.push({
               text: currentBuffer,
               index: wordIndex++
             });
             currentBuffer = wordSegment.segment;
          }
        } else {
          // Buffer was empty or had leading punct, just append
          currentBuffer += wordSegment.segment;
          bufferHasWord = true;
        }
      } else {
        // Punctuation or whitespace
        // Check if we should flush BEFORE adding this punctuation
        // e.g. "of " + "“" -> Flush "of " first.
        if (bufferHasWord && /\s$/.test(currentBuffer)) {
             // Buffer has a word and ends in space. This punctuation likely starts a NEW word sequence.
             // OR it is a separate punctuation mark.
             // Flush "Word "
             words.push({
               text: currentBuffer,
               index: wordIndex++
             });
             currentBuffer = wordSegment.segment;
             bufferHasWord = false; 
        } else {
             // Append (e.g. "word" + "," -> "word," or "sub" + "-" -> "sub-")
             currentBuffer += wordSegment.segment;
        }
      }
    }

    // Flush remaining
    if (bufferHasWord) {
      words.push({
        text: currentBuffer,
        index: wordIndex++
      });
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
