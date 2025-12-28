import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import ReadingPane from './ReadingPane';
import { AlignmentMap } from './types';

// Mock timer functions
jest.useFakeTimers();

// Mock dependencies
jest.mock('./audio/AudioRecorder', () => {
  return {
    AudioRecorder: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue({}),
      stop: jest.fn().mockResolvedValue(new Blob(['audio data'], { type: 'audio/webm' })),
      isRecording: jest.fn().mockReturnValue(false)
    }))
  };
});

jest.mock('./audio/SttEngine', () => {
  return {
    SttEngine: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn()
    }))
  };
});

jest.mock('./alignment/Aligner', () => {
  return {
    Aligner: jest.fn().mockImplementation(() => ({
      align: jest.fn().mockReturnValue(-1),
      reset: jest.fn()
    }))
  };
});

// Mock CreateObjectURL and RevokeObjectURL
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock SpeechSynthesis
const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockResume = jest.fn();
const mockPause = jest.fn();
const mockGetVoices = jest.fn().mockReturnValue([{ name: 'Google US English', lang: 'en-US' }]);

Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: mockSpeak,
    cancel: mockCancel,
    resume: mockResume,
    pause: mockPause,
    getVoices: mockGetVoices,
    paused: false,
    speaking: false,
    pending: false
  },
  writable: true,
});

class MockSpeechSynthesisUtterance {
  text: string;
  voice: any;
  onboundary: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;

const mockAlignmentMap: AlignmentMap = {
  fullText: "Hello world",
  sentences: [
    {
      text: "Hello world",
      index: 0,
      words: [
        { text: "Hello", index: 0, start: 0, end: 1 },
        { text: "world", index: 1, start: 1, end: 2 }
      ]
    }
  ]
};

describe('ReadingPane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  it('renders text from alignment map', () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('toggles settings menu visibility', () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

    const settingsButton = screen.getByTitle('Settings');

    // Menu closed initially
    expect(screen.queryByText('Dyslexia Font')).not.toBeInTheDocument();

    // Open Settings
    act(() => {
      settingsButton.click();
    });
    expect(screen.getByText('Dyslexia Font')).toBeInTheDocument();
    expect(screen.getByText('High Contrast')).toBeInTheDocument();

    // Close Settings
    act(() => {
      settingsButton.click();
    });
    expect(screen.queryByText('Dyslexia Font')).not.toBeInTheDocument();
  });

  it('handles recording start and stop, and shows audio playback', async () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

    const recordButton = screen.getByText('Record');

    // Start Recording
    await act(async () => {
      recordButton.click();
    });

    expect(screen.getByText('Stop')).toBeInTheDocument();

    // Stop Recording
    await act(async () => {
      fireEvent.click(screen.getByText('Stop'));
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('triggers TTS when Read Aloud is clicked and shows Pause/Stop', () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

    const ttsButton = screen.getByTitle('Read Aloud');
    expect(ttsButton).toHaveTextContent('Read Aloud');

    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    expect(mockSpeak).toHaveBeenCalled();

    // Should now see Pause and Stop buttons
    expect(screen.getByTitle('Pause')).toBeInTheDocument();
    expect(screen.getByTitle('Stop')).toBeInTheDocument();
    expect(screen.queryByTitle('Read Aloud')).not.toBeInTheDocument();
  });

  it('pauses and resumes TTS', () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start
    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    const pauseButton = screen.getByTitle('Pause');

    // Pause
    act(() => {
      pauseButton.click();
    });
    expect(mockPause).toHaveBeenCalled();
    expect(screen.getByTitle('Resume')).toBeInTheDocument();
    expect(screen.queryByTitle('Pause')).not.toBeInTheDocument();

    // Resume
    const resumeButton = screen.getByTitle('Resume');
    act(() => {
      resumeButton.click();
    });
    expect(mockResume).toHaveBeenCalled();
    expect(screen.getByTitle('Pause')).toBeInTheDocument();
  });

  it('stops TTS when Stop is clicked', () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start
    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    const stopButton = screen.getByTitle('Stop');

    // Stop
    act(() => {
      stopButton.click();
    });
    expect(mockCancel).toHaveBeenCalled();
    expect(screen.getByTitle('Read Aloud')).toBeInTheDocument();
    expect(screen.queryByTitle('Stop')).not.toBeInTheDocument();
  });

  it('does not render Read Aloud button if no words to read', () => {
    // Render without alignmentMap (simulating no aligned content)
    render(<ReadingPane text="<p>Some fallback text</p>" onClose={jest.fn()} />);

    // Read Aloud button should not be present
    expect(screen.queryByTitle('Read Aloud')).not.toBeInTheDocument();
    expect(screen.queryByText('Read Aloud')).not.toBeInTheDocument();
  });

  it('queues multiple utterances for multiple sentences', () => {
    const multiSentenceMap: AlignmentMap = {
      fullText: "Hello world. How are you?",
      sentences: [
        {
          text: "Hello world.",
          index: 0,
          words: [{ text: "Hello", index: 0 }, { text: "world", index: 1 }]
        },
        {
          text: "How are you?",
          index: 1,
          words: [{ text: "How", index: 2 }, { text: "are", index: 3 }, { text: "you", index: 4 }]
        }
      ]
    };

    render(<ReadingPane alignmentMap={multiSentenceMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    expect(mockSpeak).toHaveBeenCalledTimes(2);
  });
});
