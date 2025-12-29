import DOMPurify from 'dompurify';

/**
 * Extracts visible HTML from the document, attempting to identify the main content.
 */
/**
 * Extracts visible HTML from the document, attempting to identify the main content,
 * including content within open Shadow DOMs.
 */
// Elements to ignore
const ignoreSelectors = [
  'nav', 'header', 'footer', 'script', 'style', 'noscript', 'aside',
  '.ads', '.advertisement', '.social-share', '.comments', '#comments',
  '[role="navigation"]', '[role="contentinfo"]', '[role="banner"]'
];

/**
 * Recursively traverses and flattens the DOM, including Shadow Roots.
 * Returns a cloned element with Shadow DOM content expanded into children.
 */
function flattenNode(node: Node): Node | null {
  // 1. Text Nodes: Keep as is
  if (node.nodeType === Node.TEXT_NODE) {
    return node.cloneNode(true);
  }

  // 2. Elements: Check for Shadow Root or normal children
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;

    // Skip ignored elements
    if (ignoreSelectors.some(sel => el.matches && el.matches(sel))) {
      return null;
    }

    const clone = el.cloneNode(false) as Element; // Shallow clone

    // Identify content source: Shadow Root or Child Nodes
    let sourceNodes: NodeList | Node[] = el.childNodes;
    if (el.shadowRoot) {
      // If it has a Shadow Root, prioritize that content
      // NOTE: We can only access 'open' shadow roots.
      sourceNodes = el.shadowRoot.childNodes;
    }

    // Recursively flatten children
    Array.from(sourceNodes).forEach(child => {
      const flattenedChild = flattenNode(child);
      if (flattenedChild) {
        clone.appendChild(flattenedChild);
      }
    });

    return clone;
  }

  // 3. Other node types: ignore or shallow clone?
  return null;
}

/**
 * Extracts content from a specific DOM node, handling Shadow DOM flattening.
 * Returns sanitized HTML.
 */
export function extractContentFromNode(node: Node): string {
  const flattened = flattenNode(node);
  if (!flattened) return '';

  if (flattened.nodeType === Node.ELEMENT_NODE) {
    return sanitizeContent((flattened as Element).innerHTML);
  } else if (flattened.nodeType === Node.TEXT_NODE) {
    return sanitizeContent(flattened.textContent || '');
  }
  return '';
}

/**
 * Extracts visible HTML from the document, attempting to identify the main content,
 * including content within open Shadow DOMs.
 */
export function extractMainContent(doc: Document): string {
  // 4. Flatten the entire document body
  const flattenedBody = flattenNode(doc.body) as HTMLElement;

  if (!flattenedBody) return '';

  // 5. Run the existing scoring heuristic on the FLATTENED tree

  // Look at common content containers in the flattened tree
  let candidates = Array.from(flattenedBody.querySelectorAll('article, main, .content, .main, #content, #main'));

  // If no specific containers found, fallback to body
  if (candidates.length === 0) {
    candidates = [flattenedBody];
  }

  let bestElement: HTMLElement | null = null;
  let maxTextLength = 0;

  for (const container of candidates) {
    const el = container as HTMLElement;
    // .innerText might not work well on detached/cloned nodes in all envs, use textContent
    const text = (el.textContent || '').trim();
    if (text.length > maxTextLength) {
      maxTextLength = text.length;
      bestElement = el;
    }
  }

  if (!bestElement) {
    return '';
  }

  const content = bestElement.innerHTML;
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
