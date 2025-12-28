import { tokenizeText } from './tokenizer';

describe('tokenizeText', () => {
  it('splits simple text into sentences and words', () => {
    const text = 'Hello world. This is a test.';
    const result = tokenizeText(text);

    expect(result.sentences).toHaveLength(2);
    expect(result.sentences[0].text).toBe('Hello world.');
    expect(result.sentences[0].words).toHaveLength(2);
    expect(result.sentences[0].words[0].text).toBe('Hello');
    expect(result.sentences[0].words[1].text).toBe('world');

    expect(result.sentences[1].text).toBe('This is a test.');
    expect(result.sentences[1].words).toHaveLength(4);
  });

  it('handles abbreviations without breaking sentences', () => {
    const text = 'Mr. Smith goes to Washington.';
    const result = tokenizeText(text);

    expect(result.sentences).toHaveLength(1);
    expect(result.sentences[0].text).toBe('Mr. Smith goes to Washington.');
    expect(result.sentences[0].words).toHaveLength(5);
  });

  it('ignores extra whitespace', () => {
    const text = '  Hello   world.  ';
    const result = tokenizeText(text);

    expect(result.sentences).toHaveLength(1);
    expect(result.sentences[0].text).toBe('Hello   world.');
    expect(result.sentences[0].words).toHaveLength(2);
  });
});
