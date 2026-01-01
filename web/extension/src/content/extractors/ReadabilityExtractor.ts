import { Readability } from '@mozilla/readability';
import { BaseExtractor } from './BaseExtractor';
import { flattenNode } from './common';

export class ReadabilityExtractor extends BaseExtractor {
    extract(doc: Document): string | null {
        try {
            // 0. Safety check
            if (!doc.body) return '';

            // 1. Target specific content containers first to avoid "Next Story" or infinite scroll content.
            // Yahoo uses .caas-body, MSN uses cp-article
            const candidateSelectors = [
                'article',
                'cp-article',
                '.caas-body',
                '[role="main"]',
                '.story-body',
                '.article-body',
                'main'
            ];

            let sourceNode: Node = doc.body;

            // 1a. Attempt URL-based ID matching (Specific for MSN Watch/Video pages)
            // URL pattern: .../vi-<ID> or just <ID>
            let targetId: string | null = null;
            if (window.location && window.location.href) {
                const match = window.location.href.match(/vi-([A-Za-z0-9]+)/);
                if (match && match[1]) {
                    targetId = match[1];
                }
            }

            if (targetId) {
                const specificElement = doc.getElementById(targetId);
                if (specificElement) {
                    sourceNode = specificElement;
                }
            } else {
                // Fallback to generic selectors
                for (const selector of candidateSelectors) {
                    const candidate = doc.querySelector(selector);
                    // Only use if it looks substantial (e.g. has paragraphs)
                    if (candidate && candidate.querySelectorAll('p').length > 2) {
                        sourceNode = candidate;
                        break;
                    }
                }
            }

            // 2. Flatten the chosen source node
            const flattenedBody = flattenNode(sourceNode);

            if (!flattenedBody || flattenedBody.nodeType !== Node.ELEMENT_NODE) {
                return '';
            }

            // 2. Create a virtual document for Readability
            const templateDoc = doc.implementation.createHTMLDocument(doc.title);

            // We need to import the flattened body into this new document.
            const importedBody = templateDoc.importNode(flattenedBody, true);
            templateDoc.body.innerHTML = '';
            templateDoc.body.appendChild(importedBody);

            // 3. Run Readability
            const reader = new Readability(templateDoc, {
                // Higher threshold to avoid picking up small sidebars
                charThreshold: 100,
            });

            const article = reader.parse();

            if (article && article.content) {
                let finalHtml = this.clean(article.content);
                if (article.title) {
                    finalHtml = `<h1>${article.title}</h1>\n${finalHtml}`;
                }
                return this.sanitize(finalHtml);
            }
        } catch (error) {
            console.error('Readability extraction failed:', error);
        }

        return null;
    }
}
