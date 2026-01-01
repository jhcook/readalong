import { BaseExtractor, Extractor } from './BaseExtractor';

export class ChainExtractor extends BaseExtractor {
    constructor(private extractors: Extractor[]) {
        super();
    }

    extract(doc: Document): string | null {
        for (const ex of this.extractors) {
            const result = ex.extract(doc);
            // Heuristic: If result is too short, it might be a failure (e.g. empty JSON-LD)
            if (result && result.trim().length > 100) {
                return result;
            }
        }
        return null;
    }
}
