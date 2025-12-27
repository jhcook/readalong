import React from 'react';
import { createRoot } from 'react-dom/client';
import ReadingPane from './ReadingPane';
import { extractMainContent } from './extractor';
import { setupTracing } from './tracing';
import { SpanStatusCode } from '@opentelemetry/api';

const tracer = setupTracing();

let rootElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

function mountReadingPane(text: string) {
  if (rootElement) return;

  rootElement = document.createElement('div');
  rootElement.id = 'readalong-root';
  document.body.appendChild(rootElement);

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
      document.body.removeChild(rootElement);
      rootElement = null;
      shadowRoot = null;
    }
  };

  root.render(React.createElement(ReadingPane, { text, onClose: handleClose }));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOAD_TEXT') {
    const span = tracer.startSpan('extract-content');
    try {
      const text = extractMainContent(document);
      if (text) {
        mountReadingPane(text);
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
  }
});
