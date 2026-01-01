import { tokenizeText } from './tokenizer';

describe('Tokenizer Regression Tests', () => {
  it('handles months as abbreviations (Jan. 19 case)', () => {
    // User reported: "He ordered lawyers ... on the issue by Jan. 19."
    // Current behavior (suspected): ["He ordered lawyers... by Jan.", " 19."]
    const text = "He ordered lawyers for both sides to file additional legal briefs on the issue by Jan. 19.";
    const result = tokenizeText(text);
    
    // We expect 1 sentence
    expect(result.sentences.length).toBe(1);
    expect(result.sentences[0].text).toBe(text);
  });

  it('handles quotes with abbreviations correctly', () => {
    // "especially quotes" mentioned by user
    const text = 'He said "meet me on Jan. 19" and left.';
    const result = tokenizeText(text);
    
    expect(result.sentences.length).toBe(1);
    expect(result.sentences[0].text).toBe(text);
  });

  it('handles multiple sentences correctly despite abbreviations', () => {
    const text = "It is Jan. 19. The event is over.";
    const result = tokenizeText(text);
    
    expect(result.sentences.length).toBe(2);
    expect(result.sentences[0].text).toBe("It is Jan. 19.");
    expect(result.sentences[1].text).toBe("The event is over.");
  });

  it('handles common months', () => {
      const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
      months.forEach(month => {
          const text = `See you on ${month} 15th.`;
          const result = tokenizeText(text);
          expect(result.sentences.length).toBe(1);
          expect(result.sentences[0].text).toBe(text);
      });
  });
});
