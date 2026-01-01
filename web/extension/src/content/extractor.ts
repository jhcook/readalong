import { ExtractorRegistry } from './extractors/registry';
import { sanitizeContent, cleanExtractedHtml, flattenNode } from './extractors/common';
import { registerG20Extractors } from './extractors/g20_sites';

// Initialize the registry with G20 site configurations
registerG20Extractors();

export { sanitizeContent, cleanExtractedHtml };

/**
 * Extracts visible HTML from the document, attempting to identify the main content,
 * including content within open Shadow DOMs.
 */
export function extractMainContent(doc: Document): string {
  const url = window.location.href;
  const extractor = ExtractorRegistry.getInstance().getExtractor(url);
  return extractor.extract(doc) || '';
}

/**
 * Extracts content from a specific DOM node, handling Shadow DOM flattening.
 * Returns sanitized HTML.
 */
export function extractContentFromNode(node: Node): string {
  const flattened = flattenNode(node);
  if (!flattened) return '';

  if (flattened.nodeType === Node.ELEMENT_NODE) {
    const rawHtml = (flattened as Element).innerHTML;
    // Apply the same intelligent cleaning logic
    return sanitizeContent(cleanExtractedHtml(rawHtml));
  } else if (flattened.nodeType === Node.TEXT_NODE) {
    return sanitizeContent(flattened.textContent || '');
  }
  return '';
}
