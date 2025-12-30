import { tokenizeText } from './tokenizer';

describe('tokenizeText', () => {
  it('splits simple text into sentences and words', () => {
    const text = 'Hello world. This is a test.';
    const result = tokenizeText(text);

    expect(result.sentences).toHaveLength(2);
    expect(result.sentences[0].text).toBe('Hello world.');
    expect(result.sentences[0].words).toHaveLength(2);
    expect(result.sentences[0].words[0].text).toBe('Hello ');
    // Sentence segmentation includes the trailing space "Hello world. "
    expect(result.sentences[0].words[1].text).toBe('world. ');

    expect(result.sentences[1].text).toBe('This is a test.');
    expect(result.sentences[1].words).toHaveLength(4);
  });

  it('handles abbreviations without breaking sentences', () => {
    const text = 'Mr. Smith goes to Washington.';
    const result = tokenizeText(text);

    expect(result.sentences).toHaveLength(1);
    expect(result.sentences[0].text).toBe('Mr. Smith goes to Washington.');
    expect(result.sentences[0].words).toHaveLength(5);
    // "Mr. " is handled by sentence merging logic, but word tokenizer sees "Mr" "." " " "Smith"
    // "Mr" is word like? Yes.
    // "Mr" + "." + " " -> "Mr. "
    // "Smith" + " " -> "Smith "
    // ...
    // "Washington" + "." -> "Washington."
    expect(result.sentences[0].words[0].text).toBe('Mr. ');
  });

  it('ignores extra whitespace', () => {
    const text = '  Hello   world.  ';
    const result = tokenizeText(text);

    expect(result.sentences).toHaveLength(1);
    expect(result.sentences[0].text).toBe('Hello   world.');
    // Note: The tokenizer attached leading spaces to the first word
    expect(result.sentences[0].words).toHaveLength(2);
    expect(result.sentences[0].words[0].text).toBe('  Hello   ');
    expect(result.sentences[0].words[1].text).toBe('world.  ');
  });

  it('attaches punctuation to words', () => {
    const text = 'Hello, world!';
    const result = tokenizeText(text);
    
    expect(result.sentences).toHaveLength(1);
    const words = result.sentences[0].words;
    
    // Expectation: "Hello," and "world!" (including spacing if strategy preserves it)
    // If we attach trailing: 
    // "Hello, " (space included?) 
    // "world!"
    expect(words.length).toBe(2);
    expect(words[0].text).toMatch(/^Hello,\s*$/); 
    expect(words[1].text).toBe('world!');
  });
});
