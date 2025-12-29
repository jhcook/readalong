import React from 'react';
import { createRoot } from 'react-dom/client';
import ReadingPane from './ReadingPane';
import { extractMainContent, sanitizeContent } from './extractor';
import { setupTracing } from './tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { tokenizeText } from './tokenizer';

const tracer = setupTracing();

import { AlignmentMap } from './types';

let rootElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

function mountReadingPane(text: string, alignmentMap?: AlignmentMap) {
  if (rootElement) return;

  rootElement = document.createElement('div');
  rootElement.id = 'readalong-root';
  // Use documentElement to avoid conflicts with body observers (e.g. Popup Maker)
  document.documentElement.appendChild(rootElement);

  shadowRoot = rootElement.attachShadow({ mode: 'open' });

  // Inject styles
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('styles.css');
  shadowRoot.appendChild(styleLink);

  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  const root = createRoot(container);

  const handleClose = () => {
    root.unmount();
    if (rootElement) {
      if (rootElement.parentNode) {
        rootElement.parentNode.removeChild(rootElement);
      }
      rootElement = null;
      shadowRoot = null;
    }
  };

  root.render(React.createElement(ReadingPane, {
    text,
    alignmentMap,
    onClose: handleClose,
  }));

}

function processAndMountContent(html: string) {
  const span = tracer.startSpan('process-selected-content');
  try {
    const text = sanitizeContent(html);
    if (text) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = text;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';

      // Store alignment map (AC4) - for now just in memory/processed
      const alignmentMap = tokenizeText(plainText);

      mountReadingPane(text, alignmentMap);
      span.setStatus({ code: SpanStatusCode.OK });
    } else {
      alert('Could not extract text from selected element.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: errorMessage
    });
    alert('An error occurred during text extraction.');
  } finally {
    span.end();
  }
}

function enableSelectionMode() {
  const styleId = 'readalong-selection-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .readalong-hover {
        outline: 2px solid #2ea44f !important;
        cursor: pointer !important;
        background-color: rgba(46, 164, 79, 0.1) !important;
      }
    `;
    document.head.appendChild(style);
  }

  let currentHighlight: HTMLElement | null = null;

  const onMouseOver = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (currentHighlight && currentHighlight !== target) {
      currentHighlight.classList.remove('readalong-hover');
    }
    target.classList.add('readalong-hover');
    currentHighlight = target;
  };

  const onMouseOut = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    target.classList.remove('readalong-hover');
    if (currentHighlight === target) {
      currentHighlight = null;
    }
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;

    // Cleanup
    cleanup();

    // Process selected element
    processAndMountContent(target.innerHTML);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  const cleanup = () => {
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('mouseout', onMouseOut);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown);
    if (currentHighlight) {
      currentHighlight.classList.remove('readalong-hover');
    }
    const style = document.getElementById(styleId);
    if (style) {
      style.remove();
    }
  };

  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
  document.addEventListener('click', onClick, true); // Capture phase to prevent link navigation
  document.addEventListener('keydown', onKeyDown);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOAD_TEXT') {
    const span = tracer.startSpan('extract-content');
    try {
      const text = extractMainContent(document);
      if (text) {
        // Tokenize the text. 
        // We strip HTML tags for tokenization to get the pure text content structure.
        // In a real scenario, we might map these tokens back to DOM nodes.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';

        // Store alignment map (AC4) - for now just in memory/processed
        const alignmentMap = tokenizeText(plainText);

        mountReadingPane(text, alignmentMap);
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        const errorMsg = 'Could not extract text from this page.';
        alert(errorMsg);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMsg
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage
      });
      alert('An error occurred during text extraction.');
    } finally {
      span.end();
    }
  } else if (message.type === 'ENTER_SELECTION_MODE') {
    enableSelectionMode();
  }
});
