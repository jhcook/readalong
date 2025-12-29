import DOMPurify from 'dompurify';

/**
 * Extracts visible HTML from the document, attempting to identify the main content.
 */
export function extractMainContent(doc: Document): string {
  // Elements to ignore
  const ignoreSelectors = [
    'nav', 'header', 'footer', 'script', 'style', 'noscript', 'aside',
    '.ads', '.advertisement', '.social-share', '.comments', '#comments',
    '[role="navigation"]', '[role="contentinfo"]', '[role="banner"]'
  ];

  // Create a clone to avoid mutating the original document
  const clone = doc.cloneNode(true) as Document;

  // Remove ignored elements
  ignoreSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Simple heuristic: find the element with the most text
  let bestElement: HTMLElement | null = null;
  let maxTextLength = 0;

  // Look at common content containers
  let candidates = Array.from(clone.querySelectorAll('article, main, .content, .main, #content, #main'));

  // If no specific containers found, fallback to body
  if (candidates.length === 0) {
    candidates = [clone.body];
  }

  for (const container of candidates) {
    const el = container as HTMLElement;
    const text = (el.innerText || el.textContent || '').trim();
    if (text.length > maxTextLength) {
      maxTextLength = text.length;
      bestElement = el;
    }
  }

  if (!bestElement) {
    return '';
  }

  // Use DOMPurify to sanitize the HTML
  const content = (bestElement as HTMLElement).innerHTML;
  return sanitizeContent(content);
}

/**
 * Sanitizes HTML content to ensure it is safe and contains only allowed tags.
 */
export function sanitizeContent(html: string): string {
  // We only allow basic formatting tags for a clean reading experience
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'h1', 'h2', 'h3', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
}
