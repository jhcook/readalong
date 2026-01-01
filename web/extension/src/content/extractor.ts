import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

/**
 * Extracts visible HTML from the document, attempting to identify the main content,
 * including content within open Shadow DOMs.
 */
// Elements to ignore
const ignoreSelectors = [
  'nav', 'header', 'footer', 'script', 'style', 'noscript', 'aside',
  '.ads', '.advertisement', '.social-share', '.comments', '#comments',
  '[role="navigation"]', '[role="contentinfo"]', '[role="banner"]',
  'figcaption', 'figure', '.caption', '.image-caption', '.credit',
  '.copyright', '.author-bio', '.related-stories', '.top-stories',
  '.app-download', '.promo-link', '.newsletter-signup',
  '.image-attribution', '.image-attribution-ux-impr', '.image-caption-container',
  '.continue-read-break',
  // Aggressive comment filtering
  '[id*="comment"]', '[class*="comment"]',
  '[id*="discussion"]', '[class*="discussion"]',
  '[data-test-id*="comment"]',
  'section[aria-label*="Comment"]'
];

/**
 * Recursively traverses and flattens the DOM, including Shadow Roots.
 * Returns a cloned element with Shadow DOM content expanded into children.
 */
function flattenNode(node: Node | null, depth: number = 0, maxDepth: number = 500): Node | null {
  if (!node) return null;
  if (depth > maxDepth) return null;

  // 1. Text Nodes: Keep as is
  if (node.nodeType === Node.TEXT_NODE) {
    return node.cloneNode(true);
  }

  // 2. Elements: Check for Shadow Root or normal children
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tagName = el.tagName.toLowerCase();

    // Special handling for <slot>: Unwrap it and return assigned nodes (projected content)
    if (tagName === 'slot') {
      const slot = el as HTMLSlotElement;
      // assignedNodes({flatten: true}) handles nested slots and returns the projected content
      const assigned = slot.assignedNodes ? slot.assignedNodes({ flatten: true }) : [];
      const nodesToProcess = assigned.length > 0 ? assigned : slot.childNodes;

      const frag = (node.ownerDocument || document).createDocumentFragment();
      Array.from(nodesToProcess).forEach(child => {
        const flatten = flattenNode(child, depth + 1, maxDepth);
        if (flatten) frag.appendChild(flatten);
      });
      return frag;
    }

    // Special handling for <text-inline-expander> (MSN)
    // Often contains the full text in the 'text' attribute.
    if (tagName === 'text-inline-expander') {
      const textAttr = el.getAttribute('text');
      if (textAttr) {
        return (node.ownerDocument || document).createTextNode(textAttr);
      }
    }

    // Skip ignored elements
    if (ignoreSelectors.some(sel => el.matches && el.matches(sel))) {
      return null;
    }

    const clone = el.cloneNode(false) as Element; // Shallow clone

    // Identify content source: Shadow Root or Child Nodes
    // If a Shadow Root exists, we must traverse IT (the render tree), but we rely on <slot>s inside it
    // to pull in the original light DOM children.
    let sourceNodes: NodeList | Node[] = el.childNodes;
    if (el.shadowRoot) {
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
    const rawHtml = (flattened as Element).innerHTML;
    // Apply the same intelligent cleaning logic
    return sanitizeContent(cleanExtractedHtml(rawHtml));
  } else if (flattened.nodeType === Node.TEXT_NODE) {
    return sanitizeContent(flattened.textContent || '');
  }
  return '';
}


export function extractMainContent(doc: Document): string {
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
    // Example: https://www.msn.com/.../vi-AA1T52jr
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
    // Readability expects a Document or Document-like object (or we can pass the node directly if we construct a clone)
    // But Readability often works best when given a whole document context or a standalone clone.
    // We can create a lightweight clone.
    const templateDoc = doc.implementation.createHTMLDocument(doc.title);

    // adoptNode might be safer/cleaner but clone is already detached.
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
      let finalHtml = cleanExtractedHtml(article.content);
      if (article.title) {
        finalHtml = `<h1>${article.title}</h1>\n${finalHtml}`;
      }
      return sanitizeContent(finalHtml);
    }
  } catch (error) {
    console.error('Readability extraction failed:', error);
  }

  return '';
}

/**
 * Cleans the extracted HTML string of common noise patterns that Readability might miss.
 * This acts as an "Intelligent Filter" for promotional content, captions, and copyright text.
 */
export function cleanExtractedHtml(html: string): string {
  // Create a temporary DOM to manipulate
  // We use a safe container to parse the HTML string
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  // Patterns to remove
  const badTextPatterns = [
    /download the .* app/i,
    /copyright \d{4}/i,
    /all rights reserved/i,
    /follow us on/i,
    /click here to/i,
    /read more/i,
    /top stories/i,
    /©\s*nine/i, // Specific MSN pattern
    /stay across all the latest/i,
    /via our news app/i,
    /available on the apple app store/i,
    /notifications sent straight to your smartphone/i
  ];

  // Intelligent Caption/Credit Detection Heuristics
  const captionStarts = ['©', 'Photo:', 'Image:', 'Source:', 'Credit:'];

  // Iterate over all elements
  const all = body.querySelectorAll('*');
  all.forEach(el => {
    // Remove empty elements
    if (!el.textContent || el.textContent.trim().length === 0) {
      if (['IMG', 'BR', 'HR'].indexOf(el.tagName) === -1) {
        el.remove();
        return;
      }
    }

    // Remove based on text content (heuristics for short junk paragraphs)
    const text = el.textContent.trim();

    // 1. Check against known bad patterns (allow longer length for these specific noise sentences)
    if (text.length < 300) {
      if (badTextPatterns.some(pattern => pattern.test(text))) {
        el.remove();
        return;
      }
    }

    // 2. Check for Copyright/Credit indicators (keep strict length limit to avoid false positives)
    if (text.length < 150) {
      // Check for Copyright/Credit indicators at the start
      // This covers generic "© Name" or "Photo: Name" structure often found under images
      // Using regex for stricter start check and case variability
      if (/^([©]|Photos?:|Images?:|Source:|Credit:)/i.test(text)) {
        el.remove();
        return;
      }
    }
  });

  // 3. Merge broken paragraphs (e.g. quote + attribution split by newlines)
  // Heuristic: If a <p> starts with a lowercase letter, it likely belongs to the previous <p>.

  // 3. Merge broken paragraphs (e.g. quote + attribution split by newlines)
  // Heuristic: If a <p> starts with a lowercase letter, it likely belongs to the previous <p>.
  // DEBUGGING LIVE FAILURE
  // Filter out junk paragraphs (junk tags, hidden, short non-alpha) to prevent them breaking the chain
  let paragraphs = Array.from(body.querySelectorAll('p, blockquote, div')).filter(el => {
    const tagName = el.tagName.toUpperCase();
    const text = el.textContent || '';
    // Basic junk tags shouldn't likely yield p/div but good safety
    if (['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT'].includes(tagName)) return false;
    // Empty/Whitespace
    if (/^[\s\u200B\u00A0\uFEFF]*$/.test(text) && tagName !== 'IMG') return false;
    // Short Non-Alphanumeric (e.g. "***", "|")
    if (text.length < 10 && !/[a-zA-Z0-9]/.test(text)) return false;
    // Hidden
    try {
      if (el.isConnected) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
      }
    } catch (e) { }
    return true;
  });

  if (paragraphs.length > 0) {
    let prev = paragraphs[0];
    for (let i = 1; i < paragraphs.length; i++) {
      // Log vicinity of "insane" to see what's happening
      // Log vicinty to see what's happening
      const curr = paragraphs[i];
      // Find next contentful sibling
      let nextElement: Element | null = null;
      let sibling = prev.nextSibling;
      const skippedSiblings: Node[] = [];

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE) {
          const el = sibling as Element;
          const tagName = el.tagName.toUpperCase();
          const ignorableTags = ['BR', 'HR', 'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'SVG', 'PATH'];

          // Enhanced Junk Detection
          const text = el.textContent || '';
          let isHidden = false;
          try {
            if (el.isConnected) {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') isHidden = true;
            }
          } catch (e) { }

          if (ignorableTags.includes(tagName) ||
            (/^[\s\u200B\u00A0\uFEFF]*$/.test(text) && !['IMG'].includes(tagName)) ||
            (text.length < 10 && !/[a-zA-Z0-9]/.test(text)) ||
            isHidden
          ) {
            // Ignorable element
            skippedSiblings.push(sibling);
            sibling = sibling.nextSibling;
            continue;
          }
          // Found a contentful element
          nextElement = el;
          break;
        } else if (sibling.nodeType === Node.TEXT_NODE) {
          // Check if text is just whitespace
          // Regex for robust whitespace (standard, NBSP, Zero-width space, BOM)
          const isWhitespace = (text: string) => /^[\s\u200B\u00A0\uFEFF]*$/.test(text);
          const text = sibling.textContent || '';

          // If it's whitespace, ignore it.
          if (isWhitespace(text)) {
            // falls through to sibling update
          }
          // If it's SHORT and NON-ALPHANUMERIC (symbols, dots, etc), ignore it.
          else if (text.length < 10 && !/[a-zA-Z0-9]/.test(text)) {
            // Ignore symbol-only text nodes
          }
          else {
            // Found substance - likely meaningful content
            // So we can't merge across it unless we handle text nodes too. 
            // For now, break and treat as barrier.
            break;
          }
        }
        sibling = sibling.nextSibling;
      }

      // Check if found sibling matches curr (which it should if curr is the next p/div)
      // HOWEVER, 'curr' comes from our querySelectorAll list which skips some elements.
      // So if 'nextElement' IS 'curr', we are good.
      // If 'nextElement' is something else (e.g. a <span> with text that wasn't selected), we stop.

      if (nextElement === curr) {
        const currText = curr.textContent?.trim() || '';

        // Check for unbalanced quotes in PREVIOUS block
        // ... (rest of logic)
        const prevText = prev.textContent?.trim() || '';
        // Count double quotes (straight and smart)
        const quoteCount = (prevText.match(/["“”]/g) || []).length;
        const isUnbalanced = quoteCount % 2 !== 0;


        // Merge if continuation (lowercase) OR unbalanced open quote
        if (currText.length > 0 && ((/^["'“‘]*[a-z]/.test(currText)) || isUnbalanced)) {
          // Merge curr into prev
          // Use innerHTML to preserve formatting, but STRIP block tags to prevent invalid nesting
          // (e.g. merging a DIV or P into a P creates <p>...<p>...</p></p> which breaks visually)
          let contentToMerge = curr.innerHTML;

          // Regex to strip common block tags but preserve their inner content
          // Replaces opening/closing tags of p, div, blockquote, ul, ol, li with a space to ensure separation
          contentToMerge = contentToMerge.replace(/<\/?(p|div|blockquote|ul|ol|li|h[1-6])[^>]*>/gi, ' ');


          prev.innerHTML += ' ' + contentToMerge;
          curr.remove();

          // Clean up skipped barriers
          skippedSiblings.forEach(n => n.parentNode?.removeChild(n));

          // Clean up the skipped siblings (the br tags etc) to ensure clean DOM?
          // If we merge, the intervening elements are now between the old prev content and new prev content?
          // No, prev.innerHTML += ... appends to the END of prev.
          // The intervening elements (BRs) would be physically AFTER prev and BEFORE where curr WAS.
          // So they remain after the merged block. 
          // e.g. <p>A B</p> <br> (curr removed).
          // This is fine. The <br> is "floating" but harmless.

          // prev remains the same to accumulate potential next merges (chaining)
          continue;
        }
      }
      // If not merged, move prev pointer
      prev = curr;
    }
  }

  // Post-processing: Fix spacing regressions
  // Sometimes extra spaces are introduced after currency symbols or colons in ticker symbols
  // e.g. "NZ$ 778,175" -> "NZ$778,175"
  // e.g. "NZE: MPG" -> "NZE:MPG"
  let cleanedHtml = body.innerHTML;

  // 1. Fix currency spacing: Symbol + space + digit -> Symbol + digit
  // Matches $, £, €, etc followed by a space and a digit
  cleanedHtml = cleanedHtml.replace(/([$£€¥])\s+(\d)/g, '$1$2');

  // 2. Fix Ticker/Token spacing: Uppercase(3-4) + colon + space + Uppercase(3-4)
  // e.g. NZE: MPG -> NZE:MPG
  cleanedHtml = cleanedHtml.replace(/\b([A-Z]{3,4}):\s+([A-Z]{3,4})\b/g, '$1:$2');

  // 3. Fix S&P spacing: S& + space + P
  cleanedHtml = cleanedHtml.replace(/(S&)\s+(P)/g, '$1$2');

  // 4. Remove citation markers (e.g. [1], [10], [citation needed])
  // Common on Wikipedia and other reference sites
  cleanedHtml = cleanedHtml.replace(/\[\d+\]/g, '');
  cleanedHtml = cleanedHtml.replace(/\[citation needed\]/gi, '');

  return cleanedHtml;
}

/**
 * Sanitizes HTML content to ensure it is safe and contains only allowed tags.
 */
export function sanitizeContent(html: string): string {
  // We only allow basic formatting tags for a clean reading experience
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'h1', 'h2', 'h3', 'br', 'ul', 'ol', 'li', 'blockquote', 'div'],
    ALLOWED_ATTR: []
  });
}
