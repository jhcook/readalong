import { BaseExtractor } from './BaseExtractor';
import { flattenNode } from './common';

export class SelectorExtractor extends BaseExtractor {
    constructor(private selector: string) {
        super();
    }

    extract(doc: Document): string | null {
        const element = doc.querySelector(this.selector);
        if (!element) return null;

        const flattened = flattenNode(element);
        if (!flattened || flattened.nodeType !== Node.ELEMENT_NODE) return null;

        const rawHtml = (flattened as Element).innerHTML;
        // We clean and sanitize. 
        // Note: This bypasses Readability's intense parsing, which is good if we trust the container 
        // but might leave some inline junk if clean() doesn't catch it.
        return this.sanitize(this.clean(rawHtml));
    }
}
