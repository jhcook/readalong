import { Extractor } from './BaseExtractor';
import { ReadabilityExtractor } from './ReadabilityExtractor';

export class ExtractorRegistry {
    private static instance: ExtractorRegistry;
    private extractors: Map<RegExp, Extractor> = new Map();
    private defaultExtractor: Extractor = new ReadabilityExtractor();

    private constructor() { }

    static getInstance(): ExtractorRegistry {
        if (!this.instance) {
            this.instance = new ExtractorRegistry();
        }
        return this.instance;
    }

    register(pattern: RegExp, extractor: Extractor) {
        this.extractors.set(pattern, extractor);
    }

    getExtractor(url: string): Extractor {
        for (const [pattern, extractor] of this.extractors) {
            if (pattern.test(url)) {
                return extractor;
            }
        }
        return this.defaultExtractor;
    }
}
