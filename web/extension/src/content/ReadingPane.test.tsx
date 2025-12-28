import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ReadingPane from './ReadingPane';
import { AlignmentMap } from './types';

// Mock timer functions
jest.useFakeTimers();

const mockAlignmentMap: AlignmentMap = {
  fullText: "Hello world",
  sentences: [
    {
      text: "Hello world",
      index: 0,
      words: [
        { text: "Hello", index: 0 },
        { text: "world", index: 1 }
      ]
    }
  ]
};

describe('ReadingPane', () => {
  it('renders text from alignment map', () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('highlights words sequentially during simulation', () => {
    render(
      <ReadingPane 
        alignmentMap={mockAlignmentMap} 
        onClose={jest.fn()} 
        isSimulating={true} 
      />
    );

    // Initially no words should be active
    const helloWord = screen.getByText('Hello');
    expect(helloWord).not.toHaveClass('active');

    // Start playback
    const playButton = screen.getByText('Play Simulation');
    act(() => {
      playButton.click();
    });

    // Advance timer to highlight first word (300ms)
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(helloWord).toHaveClass('active');
    expect(screen.getByText('world')).not.toHaveClass('active');

    // Advance to next word
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(helloWord).not.toHaveClass('active');
    expect(screen.getByText('world')).toHaveClass('active');
  });

  it('pauses highlighting when paused', () => {
    render(
      <ReadingPane 
        alignmentMap={mockAlignmentMap} 
        onClose={jest.fn()} 
        isSimulating={true} 
      />
    );

    const playButton = screen.getByText('Play Simulation');
    act(() => {
      playButton.click(); // Play
    });

    act(() => {
      jest.advanceTimersByTime(300); // Highlight "Hello"
    });
    expect(screen.getByText('Hello')).toHaveClass('active');

    const pauseButton = screen.getByText('Pause');
    act(() => {
      pauseButton.click(); // Pause
    });

    // Advance time, should stay on "Hello" and not move to "world"
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByText('Hello')).toHaveClass('active');
    expect(screen.getByText('world')).not.toHaveClass('active');
  });
});
