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
function flattenNode(node: Node, depth: number = 0, maxDepth: number = 500): Node | null {
  if (depth > maxDepth) return null;

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
      const flattenedChild = flattenNode(child, depth + 1, maxDepth);
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
 * Calculates a content quality score for an element.
 * Higher is better.
 */
function calculateScore(element: Element): number {
  let score = 0;

  // 1. Base Text Length Score (1 point per 100 chars)
  const text = element.textContent || '';
  if (text.length < 50) return 0; // Too short
  score += text.length / 100;

  // 2. Paragraph Density
  const paragraphs = element.querySelectorAll('p');
  let paragraphTextLength = 0;
  paragraphs.forEach(p => {
    const pText = p.textContent || '';
    if (pText.length > 50) {
      score += 5; // Bonus for substantial paragraphs
      paragraphTextLength += pText.length;
    }
  });

  // 3. Link Density Penalty
  const links = element.querySelectorAll('a');
  let linkTextLength = 0;
  links.forEach(a => {
    linkTextLength += (a.textContent || '').length;
  });

  const linkDensity = text.length > 0 ? linkTextLength / text.length : 1;
  if (linkDensity > 0.5) {
    score -= 50; // Heavy penalty for mostly links (navs, sidebars)
  } else if (linkDensity > 0.2) {
    score -= 10;
  }

  // 4. Header Bonus
  const headers = element.querySelectorAll('h1, h2, h3');
  score += headers.length * 3;

  // 5. List Penalty (if lists dominate)
  const listItems = element.querySelectorAll('li');
  // If we have many list items but few paragraphs, it's likely a menu or listicle
  if (listItems.length > 10 && paragraphs.length < 2) {
      score -= 20;
  }

  return score;
}

/**
 * Extracts visible HTML from the document, attempting to identify the main content,
 * including content within open Shadow DOMs.
 */
export function extractMainContent(doc: Document): string {
  // Optimization: Check for common top-level containers first to avoid flattening the entire body
  const commonSelectors = [
    'article', 'main', '[role="main"]', '.article-body', '.main-content', 
    '#main-content', '#content', '.story-body', '.post-content'
  ];
  
  const topLevelCandidates = Array.from(doc.querySelectorAll(commonSelectors.join(', ')));
  
  let bestCandidate: Element | null = null;
  let maxScore = 0;

  // Check top-level candidates
  for (const candidate of topLevelCandidates) {
    // Basic visibility check (skip hidden elements)
    if ((candidate as HTMLElement).offsetParent === null) continue;

    const flattened = flattenNode(candidate);
    if (flattened && flattened.nodeType === Node.ELEMENT_NODE) {
      const el = flattened as Element;
      const score = calculateScore(el);
      
      if (score > maxScore) {
        maxScore = score;
        bestCandidate = el;
      }
    }
  }

  // If we found a good candidate, return it
  // Threshold: e.g. 20 points (approx 2000 chars or 4 paragraphs)
  if (bestCandidate && maxScore > 20) {
    return sanitizeContent(bestCandidate.innerHTML);
  }

  // Fallback: Flatten the entire document body (expensive but comprehensive)
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
  maxScore = 0;

  for (const container of candidates) {
    const el = container as HTMLElement;
    const score = calculateScore(el);
    if (score > maxScore) {
      maxScore = score;
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
