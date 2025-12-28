import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import { chrome } from 'jest-chrome'; // We will use a manual mock to ensure full control
import ReadingPane from './ReadingPane';

// Manual mock for chrome to avoid jest-chrome issues with React state updates or timing
const mockGet = jest.fn();
const mockSet = jest.fn();

const mockChrome = {
  storage: {
    local: {
      get: mockGet,
      set: mockSet
    }
  },
  runtime: {
    getURL: (path: string) => path
  }
};

(global as any).chrome = mockChrome;
(window as any).chrome = mockChrome;

// Mock SpeechSynthesis
const mockGetVoices = jest.fn().mockReturnValue([]);
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    getVoices: mockGetVoices,
    onvoiceschanged: null,
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  },
  writable: true,
});

describe('ReadingPane Accessibility', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return empty object
    mockGet.mockImplementation((keys, callback) => {
      callback({});
    });
  });

  it('loads accessibility settings on mount', async () => {
    mockGet.mockImplementation((keys, callback) => {
      callback({ isDyslexiaFont: true, isHighContrast: true });
    });

    render(<ReadingPane onClose={mockOnClose} />);

    // Wait for the state to update and class to appear
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
      const overlay = document.querySelector('.readalong-overlay');
      expect(overlay).toHaveClass('dyslexia-font');
      expect(overlay).toHaveClass('high-contrast');
    });
  });

  it('toggles dyslexia font and saves to storage', async () => {
    render(<ReadingPane onClose={mockOnClose} />);

    // Open Settings
    const settingsButton = screen.getByTitle('Settings');
    fireEvent.click(settingsButton);

    const button = screen.getByText('Dyslexia Font');
    fireEvent.click(button);

    await waitFor(() => {
      const overlay = document.querySelector('.readalong-overlay');
      expect(overlay).toHaveClass('dyslexia-font');
    });

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isDyslexiaFont: true }));

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isDyslexiaFont: true }));

    fireEvent.click(screen.getByText('✓ Dyslexia Font'));

    await waitFor(() => {
      const overlay = document.querySelector('.readalong-overlay');
      expect(overlay).not.toHaveClass('dyslexia-font');
    });

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isDyslexiaFont: false }));
  });

  it('toggles high contrast and saves to storage', async () => {
    render(<ReadingPane onClose={mockOnClose} />);

    // Open Settings
    const settingsButton = screen.getByTitle('Settings');
    fireEvent.click(settingsButton);

    const button = screen.getByText('High Contrast');
    fireEvent.click(button);

    await waitFor(() => {
      const overlay = document.querySelector('.readalong-overlay');
      expect(overlay).toHaveClass('high-contrast');
    });

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isHighContrast: true }));

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isHighContrast: true }));

    fireEvent.click(screen.getByText('✓ High Contrast'));

    await waitFor(() => {
      const overlay = document.querySelector('.readalong-overlay');
      expect(overlay).not.toHaveClass('high-contrast');
    });

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isHighContrast: false }));
  });
});
