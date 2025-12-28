export interface Word {
  text: string;
  start?: number; // Timestamp in seconds
  end?: number;   // Timestamp in seconds
  confidence?: number;
  index: number;  // Order in the sentence
}

export interface Sentence {
  text: string;
  words: Word[];
  start?: number; // Timestamp in seconds
  end?: number;   // Timestamp in seconds
  index: number;  // Order in the document
}

export interface AlignmentMap {
  sentences: Sentence[];
  fullText: string;
}
