import { cleanExtractedHtml, sanitizeContent } from './common';

export interface Extractor {
    extract(doc: Document): string | null;
}

export abstract class BaseExtractor implements Extractor {
    abstract extract(doc: Document): string | null;

    protected clean(html: string): string {
        return cleanExtractedHtml(html);
    }

    protected sanitize(html: string): string {
        return sanitizeContent(html);
    }
}
