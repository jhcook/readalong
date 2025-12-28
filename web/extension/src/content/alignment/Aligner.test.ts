import { Aligner, RecognizedWord } from './Aligner';
import { Word } from '../types';

describe('Aligner', () => {
  let aligner: Aligner;

  beforeEach(() => {
    aligner = new Aligner();
  });

  const createRefWords = (texts: string[]): Word[] => {
    return texts.map((text, index) => ({ text, index }));
  };

  const createRecWords = (data: [string, number, number][]): RecognizedWord[] => {
    return data.map(([word, start, end]) => ({ word, start, end, conf: 1.0 }));
  };

  it('aligns perfect sequence', () => {
    const reference = createRefWords(['Hello', 'world', 'this', 'is', 'a', 'test']);
    const recognized = createRecWords([
      ['hello', 0, 0.5],
      ['world', 0.5, 1.0],
      ['this', 1.0, 1.5]
    ]);

    const lastIndex = aligner.align(reference, recognized);

    expect(lastIndex).toBe(2); // 'this' is at index 2
    expect(reference[0].start).toBe(0);
    expect(reference[1].start).toBe(0.5);
    expect(reference[2].start).toBe(1.0);
    expect(reference[3].start).toBeUndefined();
  });

  it('handles skipped words in reference (reader skipped a word)', () => {
    const reference = createRefWords(['The', 'quick', 'brown', 'fox']);
    // Reader matched 'The', skipped 'quick', read 'brown'
    const recognized = createRecWords([
      ['the', 0, 0.5],
      ['brown', 1.0, 1.5]
    ]);

    const lastIndex = aligner.align(reference, recognized);

    expect(lastIndex).toBe(2); // 'brown' is at index 2
    expect(reference[0].start).toBe(0);
    expect(reference[1].start).toBeUndefined(); // 'quick' skipped
    expect(reference[2].start).toBe(1.0);
  });

  it('handles extra words in recognition (reader stuttered)', () => {
    const reference = createRefWords(['The', 'fox']);
    // Reader said 'The' 'um' 'fox'
    const recognized = createRecWords([
      ['the', 0, 0.5],
      ['um', 0.5, 0.8],
      ['fox', 1.0, 1.5]
    ]);

    const lastIndex = aligner.align(reference, recognized);

    expect(lastIndex).toBe(1);
    expect(reference[0].start).toBe(0);
    expect(reference[1].start).toBe(1.0);
  });

  it('handles fuzzy matching (typos/misrecognition)', () => {
    const reference = createRefWords(['The', 'quick', 'fox']);
    // 'quick' misrecognized as 'quack'
    const recognized = createRecWords([
      ['the', 0, 0.5],
      ['quack', 0.5, 1.0], 
      ['fox', 1.0, 1.5]
    ]);

    const lastIndex = aligner.align(reference, recognized);

    expect(lastIndex).toBe(2);
    expect(reference[1].start).toBe(0.5); // Should match 'quick' with 'quack'
  });

  it('handles word substitution (paraphrasing)', () => {
    const reference = createRefWords(['The', 'quick', 'brown', 'fox']);
    // 'quick' substituted with 'fast'
    const recognized = createRecWords([
      ['the', 0, 0.5],
      ['fast', 0.5, 1.0], 
      ['brown', 1.0, 1.5],
      ['fox', 1.5, 2.0]
    ]);

    const lastIndex = aligner.align(reference, recognized);

    // 'fast' shouldn't match 'quick' with standard dist=2, so it should be skipped
    // But 'brown' should match 'brown'.
    expect(lastIndex).toBe(3); // 'fox' is at index 3
    expect(reference[0].start).toBe(0);
    expect(reference[1].start).toBeUndefined(); // 'quick' skipped (no match)
    expect(reference[2].start).toBe(1.0); // 'brown' matched
    expect(reference[3].start).toBe(1.5); // 'fox' matched
  });

  it('handles inserted filler words', () => {
    const reference = createRefWords(['The', 'fox']);
    // 'very' and 'fast' inserted
    const recognized = createRecWords([
      ['the', 0, 0.5],
      ['very', 0.5, 0.8],
      ['fast', 0.8, 1.2],
      ['fox', 1.2, 1.5]
    ]);

    const lastIndex = aligner.align(reference, recognized);

    expect(lastIndex).toBe(1);
    expect(reference[0].start).toBe(0);
    expect(reference[1].start).toBe(1.2);
  });
});
