import { BaseExtractor } from './BaseExtractor';

export class JsonLdExtractor extends BaseExtractor {
    extract(doc: Document): string | null {
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        for (const script of Array.from(scripts)) {
            try {
                const json = JSON.parse(script.textContent || '{}');
                const items = Array.isArray(json) ? json : [json];

                // Look for Article, NewsArticle, BlogPosting
                const article = items.find(i =>
                    ['Article', 'NewsArticle', 'BlogPosting', 'Report'].includes(i['@type'])
                );

                if (article && article.articleBody) {
                    // articleBody is typically plain text. 
                    // We'll treat it as such and ensure line breaks are preserved.
                    // If it contains HTML entities, sanitize will handle them (if decoded first? No, sanitize expects HTML tags).
                    // Usually articleBody is text.
                    let content = article.articleBody;

                    // basic HTML check: if it has tags, treat as HTML.
                    if (/<[a-z][\s\S]*>/i.test(content)) {
                        return this.sanitize(content);
                    }

                    // Otherwise wrap in paragraphs/breaks
                    // Split by double newlines for paragraphs
                    const paragraphs = content.split(/\n\s*\n/).map((p: string) => `<p>${p}</p>`).join('\n');
                    return this.sanitize(paragraphs);
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
        return null;
    }
}
