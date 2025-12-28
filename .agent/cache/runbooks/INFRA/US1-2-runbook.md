# US1-2: Tokenize Text Into Sentences and Words

Status: COMPLETED

## Goal Description
Implement a robust tokenizer that splits raw text into sentences and words. This is a foundational component for the alignment engine (US1-3). The output must strictly adhere to the schema defined in ADR-009.

## Panel Review Findings
- **@Architect**: Validated. The tokenizer should be a pure function, stateless, and easily testable. It should run in the browser (extension) and potentially on mobile (React Native) via a shared logic layer.
- **@QA**: Validated. Test cases must cover common English abbreviations (e.g., "Mr.", "Dr.", "etc.") to ensure they don't incorrectly trigger sentence breaks.
- **@Observability**: Validated. Trace the duration of the tokenization process.

## Implementation Steps

### 1. Define Data Structures
#### [NEW] [web/extension/src/content/types.ts](web/extension/src/content/types.ts)
- Define `Word`, `Sentence`, and `AlignmentMap` interfaces based on ADR-009.

### 2. Implement Tokenizer
#### [NEW] [web/extension/src/content/tokenizer.ts](web/extension/src/content/tokenizer.ts)
- Implement `tokenizeText(text: string): AlignmentMap`.
- Use `Intl.Segmenter` (if available) or a robust regex fallback for sentence splitting.
- Use `Intl.Segmenter` for word splitting.
- Ensure "Mr.", "Mrs.", etc., do not break sentences.

### 3. Integrate with Extractor
#### [MODIFY] [web/extension/src/content/index.ts](web/extension/src/content/index.ts)
- Call `tokenizeText` after extraction (temporarily log the output or store it in memory/local storage to verify AC4).

## Verification Plan
### Automated Tests
- [x] Unit tests in `tokenizer.test.ts`.
- [x] Verify splitting of "Hello world. This is a test." -> 2 sentences.
- [x] Verify splitting of "Mr. Smith is here." -> 1 sentence.
- [x] Verify word counts and character offsets.

### Manual Verification
- [x] Load a page with the extension.
- [x] Check console/traces to see the generated `AlignmentMap`.
