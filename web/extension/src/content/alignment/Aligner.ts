import { distance } from 'fastest-levenshtein';
import { Word } from '../types';

export interface RecognizedWord {
  word: string;
  start: number;
  end: number;
  conf: number;
}

export class Aligner {
  private cursor: number = 0;
  private readonly SEARCH_WINDOW = 10; // Look ahead 10 words
  private readonly MAX_DISTANCE = 2; // Max levenshtein distance to consider a match

  /**
   * Aligns a sequence of recognized words to the reference text starting from the current cursor.
   * Updates the reference words in-place with timing information.
   * returns the index of the last matched word in the reference text.
   */
  align(reference: Word[], recognizedSequence: RecognizedWord[]): number {
    let recIndex = 0;
    let lastMatchIndex = -1;

    while (recIndex < recognizedSequence.length && this.cursor < reference.length) {
      const recWord = recognizedSequence[recIndex];
      const cleanRecWord = this.cleanWord(recWord.word);

      // Search ahead in the reference text
      let bestMatchDist = this.MAX_DISTANCE + 1;
      let bestMatchRefIndex = -1;

      for (let i = 0; i < this.SEARCH_WINDOW; i++) {
        const refIndex = this.cursor + i;
        if (refIndex >= reference.length) break;

        const refWord = reference[refIndex];
        const cleanRefWord = this.cleanWord(refWord.text);

        const d = distance(cleanRecWord, cleanRefWord);

        if (d < bestMatchDist) {
          bestMatchDist = d;
          bestMatchRefIndex = refIndex;
        }
        
        // Exact match optimization
        if (d === 0) break; 
      }

      if (bestMatchRefIndex !== -1) {
        // Log skipped reference words
        if (bestMatchRefIndex > this.cursor) {
          const skippedCount = bestMatchRefIndex - this.cursor;
          console.debug(`Skipped ${skippedCount} reference words (paraphrasing/deletion).`);
        }

        // Match found!
        const refWord = reference[bestMatchRefIndex];
        refWord.start = recWord.start;
        refWord.end = recWord.end;
        refWord.confidence = recWord.conf;
        
        // Move cursor past this match
        this.cursor = bestMatchRefIndex + 1;
        lastMatchIndex = bestMatchRefIndex;
      } else {
        // No match found for this recognized word within window.
        console.debug(`Unmatched recognized word: "${recWord.word}" (insertion/filler).`);
        // It might be an extra word spoken by the user.
        // We just skip it and try the next recognized word against the current cursor.
      }
      
      recIndex++;
    }

    return lastMatchIndex;
  }

  reset() {
    this.cursor = 0;
  }

  private cleanWord(text: string): string {
    return text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
  }
}
