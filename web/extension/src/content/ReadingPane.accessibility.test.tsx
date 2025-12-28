import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { chrome } from 'jest-chrome';
import ReadingPane from './ReadingPane';

// Ensure chrome is global
(global as any).chrome = chrome;

describe('ReadingPane Accessibility', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation for storage.local.get
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
  });

  it('loads accessibility settings on mount', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ isDyslexiaFont: true, isHighContrast: true });
    });

    render(<ReadingPane onClose={mockOnClose} />);

    await waitFor(() => {
      const overlay = document.querySelector('.readalong-overlay');
      expect(overlay).toHaveClass('dyslexia-font');
      expect(overlay).toHaveClass('high-contrast');
    });
  });

  it('toggles dyslexia font and saves to storage', async () => {
    render(<ReadingPane onClose={mockOnClose} />);

    const button = screen.getByText('Dyslexia Font');
    fireEvent.click(button);

    const overlay = document.querySelector('.readalong-overlay');
    expect(overlay).toHaveClass('dyslexia-font');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({ isDyslexiaFont: true }));

    fireEvent.click(screen.getByText('Standard Font'));
    expect(overlay).not.toHaveClass('dyslexia-font');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({ isDyslexiaFont: false }));
  });

  it('toggles high contrast and saves to storage', async () => {
    render(<ReadingPane onClose={mockOnClose} />);

    const button = screen.getByText('High Contrast');
    fireEvent.click(button);

    const overlay = document.querySelector('.readalong-overlay');
    expect(overlay).toHaveClass('high-contrast');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({ isHighContrast: true }));

    fireEvent.click(screen.getByText('Normal Contrast'));
    expect(overlay).not.toHaveClass('high-contrast');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({ isHighContrast: false }));
  });
});
