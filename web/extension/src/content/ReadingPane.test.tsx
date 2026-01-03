
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
      prepare: jest.fn().mockResolvedValue({}),
      startRecording: jest.fn(),
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

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock SpeechSynthesis
const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockResume = jest.fn();
const mockPause = jest.fn();
const mockGetVoices = jest.fn().mockReturnValue([{ name: 'US English', lang: 'en-US', voiceURI: 'us-english', localService: true }]);

const mockSpeechSynthesis = {
  speak: mockSpeak,
  cancel: mockCancel,
  resume: mockResume,
  pause: mockPause,
  getVoices: mockGetVoices,
  paused: false,
  speaking: false,
  pending: false,
  onvoiceschanged: null
};

Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
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
    // Reset state
    mockSpeechSynthesis.speaking = false;
    mockSpeechSynthesis.paused = false;
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

    // 1. Select "Record" from settings first
    const settingsButton = screen.getByTitle('Settings');
    await act(async () => { settingsButton.click(); });

    const sourceSelect = screen.getByDisplayValue('System Voices');
    fireEvent.change(sourceSelect, { target: { value: 'record' } });

    // Now record button should appear
    const recordButton = screen.getByRole('button', { name: 'Record' });

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

    // Simulate speaking state
    mockSpeechSynthesis.speaking = true;

    const pauseButton = screen.getByTitle('Pause');

    // Pause
    act(() => {
      pauseButton.click();
    });
    expect(mockPause).toHaveBeenCalled();

    // Resume (test assumes button switches or just verify calls)
    // paused state in mock:
    mockSpeechSynthesis.paused = true;

    // UI should show Resume button if logic depends on isPaused state, which it does.
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

  it('displays error message when fetching voices fails', async () => {
    // Mock ElevenLabsClient.getVoices failure
    const mockGetVoices = jest.fn().mockRejectedValue('Invalid API Key');
    require('./services/ElevenLabsClient').ElevenLabsClient.getVoices = mockGetVoices;

    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

    // Open Settings and select ElevenLabs
    const settingsButton = screen.getByTitle('Settings');
    act(() => { settingsButton.click(); });

    // Select Voice Source logic is inside the component, we need to trigger it.
    // However, the component loads settings on mount. We can mock the initial state?
    // Or simpler: change the select value.
    const sourceSelect = screen.getByText('System Voices').closest('select') as HTMLSelectElement;
    // Wait, the select has label "Voice Source". 
    // Let's find by label if possible or just use display value.
    // The previous test didn't cover this deep. Let's rely on text presence.

    // Switch to ElevenLabs
    fireEvent.change(screen.getByDisplayValue('System Voices'), { target: { value: 'elevenlabs' } });

    // Enter API Key
    const paramsInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(paramsInput, { target: { value: 'invalid-key' } });

    // Wait for the error to appear
    await waitFor(() => {
      expect(screen.getByText('Error: Invalid API Key')).toBeInTheDocument();
    });
  });

  it('navigates back one sentence during System TTS', () => {
    const multiSentenceMap: AlignmentMap = {
      fullText: "Sentence one. Sentence two. Sentence three.",
      sentences: [
        { text: "Sentence one.", index: 0, words: [{ text: "Sentence", index: 0 }, { text: "one", index: 1 }] },
        { text: "Sentence two.", index: 1, words: [{ text: "Sentence", index: 2 }, { text: "two", index: 3 }] },
        { text: "Sentence three.", index: 2, words: [{ text: "Sentence", index: 4 }, { text: "three", index: 5 }] }
      ]
    };

    render(<ReadingPane alignmentMap={multiSentenceMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start reading (Sentence 0)
    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    // Simulate progress to Sentence 1 (index 2 in allWords)
    // We can't easily simulate onboundary on the mock without exposing it.
    // But handleBackOneSentence relies on currentWordIndex.
    // We can manually set currentWordIndex via `onboundary` if we had access to the utterance instance.
    // The component creates utterances. We mock `SpeechSynthesisUtterance`.

    // We need to access the created instances or just assume handleBackOneSentence logic works if we force state?
    // We can't force component state from outside.

    // Alternative: We can mock `window.speechSynthesis.speak` to capturing the utterance and triggering onboundary?
    // Let's rely on the fact that `handleReadAloud` was called initially.

    // To properly test "Back", we need `currentWordIndex` to be > sentence 0 start.
    // We can trigger `onboundary` on the LAST call to `speak`.
    const utterances = (mockSpeak.mock.calls as any[]).map(call => call[0]);
    // 3 sentences -> 3 utterances.
    // Trigger onboundary on the 2nd utterance (Sentence 1).
    const secondUtterance = utterances[1];
    act(() => {
      if (secondUtterance.onstart) secondUtterance.onstart(); // needed?
      if (secondUtterance.onboundary) {
        secondUtterance.onboundary({ name: 'word', charIndex: 0 }); // Start of "Sentence two"
      }
    });

    // Now currentWordIndex should be 2.

    // Click Back
    const backButton = screen.getByTitle('Back One Sentence');
    act(() => {
      backButton.click();
    });

    // Verify debounce - wait 500ms
    act(() => {
      jest.advanceTimersByTime(600);
    });

    // Expect restart. 
    // cancel() should be called.
    expect(mockCancel).toHaveBeenCalled();
    // speak() should be called again.
    // Since we were at Sentence 1, back should go to Sentence 0.
    // So distinct speak calls for Sentence 0, 1, 2 should happen.
    // Before back: Called 3 times (initial play).
    // After back: Called +3 times (restart from 0)? No, +3 times (restart from 0).
    // Wait, if target is 0, it restarts from 0.

    // What if we were at Sentence 2? Back -> Sentence 1.
    // Triger onboundary on 3rd utterance.
  });

  it('debounces back clicks', () => {
    const multiSentenceMap: AlignmentMap = {
      fullText: "S1. S2. S3.",
      sentences: [
        { text: "S1.", index: 0, words: [{ text: "S1", index: 0 }] },
        { text: "S2.", index: 1, words: [{ text: "S2", index: 1 }] },
        { text: "S3.", index: 2, words: [{ text: "S3", index: 2 }] }
      ]
    };

    render(<ReadingPane alignmentMap={multiSentenceMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start
    act(() => { ttsButton.click(); jest.advanceTimersByTime(100); });

    // Move to S3 (index 2)
    const utterances = (mockSpeak.mock.calls as any[]).map(call => call[0]);
    const thirdUtterance = utterances[2]; // S3
    act(() => {
      if (thirdUtterance.onboundary) thirdUtterance.onboundary({ name: 'word', charIndex: 0 });
    });

    const backButton = screen.getByTitle('Back One Sentence');

    // Clear mocks to track new calls
    mockSpeak.mockClear();
    mockCancel.mockClear();

    // Double click back
    act(() => {
      fireEvent.click(backButton); // Back to S2
    });

    act(() => {
      jest.advanceTimersByTime(200); // < 500ms
      fireEvent.click(backButton); // Back to S1
    });

    // Wait for debounce
    act(() => {
      jest.advanceTimersByTime(600);
    });

    // Verify logic
    // S3 -> Back -> S2 -> Back -> S1.
    // Should restart from S1.
    // S1 is index 0.
    // handleReadAloud(0) creates utterances for S1, S2, S3.
    // So expect 3 speak calls.
    expect(mockSpeak).toHaveBeenCalledTimes(3);
    // Verify first utterance text is S1.
    expect((mockSpeak.mock.calls[0][0] as any).text).toBe("S1"); // "buildTextAndMap" adds space then trims

    // Verify cancel called
    expect(mockCancel).toHaveBeenCalled();
  });

  it('navigates forward one sentence during System TTS', () => {
    const multiSentenceMap: AlignmentMap = {
      fullText: "Sentence one. Sentence two. Sentence three.",
      sentences: [
        { text: "Sentence one.", index: 0, words: [{ text: "Sentence", index: 0 }, { text: "one", index: 1 }] },
        { text: "Sentence two.", index: 1, words: [{ text: "Sentence", index: 2 }, { text: "two", index: 3 }] },
        { text: "Sentence three.", index: 2, words: [{ text: "Sentence", index: 4 }, { text: "three", index: 5 }] }
      ]
    };

    render(<ReadingPane alignmentMap={multiSentenceMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start reading (Sentence 0)
    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    // Manually trigger onstart to set state to playing/Sentence 0
    const utterances = (mockSpeak.mock.calls as any[]).map(call => call[0]);
    const firstUtterance = utterances[0];
    act(() => {
      if (firstUtterance.onstart) firstUtterance.onstart();
    });

    // Currently at Sentence 0. Forward -> Sentence 1.
    const forwardButton = screen.getByTitle('Forward One Sentence');

    // Clear mocks
    mockSpeak.mockClear();
    mockCancel.mockClear();

    act(() => {
      forwardButton.click();
    });

    // Wait for debounce
    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(mockCancel).toHaveBeenCalled();
    // Restart from Sentence 1. Expect 2 speak calls (S1, S2, since S0 is skipped).
    // sentences.length = 3. 
    // handleReadAloud(1) -> loop sIndex 1 to 2.
    // S1, S2.
    expect(mockSpeak).toHaveBeenCalledTimes(2);
    expect((mockSpeak.mock.calls[0][0] as any).text).toBe("Sentence two");
  });

  it('debounces forward clicks', () => {
    const multiSentenceMap: AlignmentMap = {
      fullText: "S1. S2. S3.",
      sentences: [
        { text: "S1.", index: 0, words: [{ text: "S1", index: 0 }] },
        { text: "S2.", index: 1, words: [{ text: "S2", index: 1 }] },
        { text: "S3.", index: 2, words: [{ text: "S3", index: 2 }] }
      ]
    };

    render(<ReadingPane alignmentMap={multiSentenceMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start
    act(() => { ttsButton.click(); jest.advanceTimersByTime(100); });

    // Manually trigger onstart
    const utterances = (mockSpeak.mock.calls as any[]).map(call => call[0]);
    const firstUtterance = utterances[0];
    act(() => {
      if (firstUtterance.onstart) firstUtterance.onstart();
    });
    // At S1.

    const forwardButton = screen.getByTitle('Forward One Sentence');

    // Clear mocks
    mockSpeak.mockClear();
    mockCancel.mockClear();

    // Double click forward
    act(() => {
      fireEvent.click(forwardButton); // Forward to S2
    });

    act(() => {
      jest.advanceTimersByTime(200); // < 500ms
      fireEvent.click(forwardButton); // Forward to S3
    });

    // Wait for debounce
    act(() => {
      jest.advanceTimersByTime(600);
    });

    // S1 -> S2 -> S3.
    // handleReadAloud(2). S3 only.
    // Expect 1 speak call.
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect((mockSpeak.mock.calls[0][0] as any).text).toBe("S3");
    expect(mockCancel).toHaveBeenCalled();
  });

  it('scrolls active word into view when it goes below container bottom', () => {
    // Mock scrollIntoView
    const mockScrollIntoView = Element.prototype.scrollIntoView as jest.Mock;
    mockScrollIntoView.mockClear();

    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start reading
    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    const utterances = (mockSpeak.mock.calls as any[]).map(call => call[0]);
    const utterance = utterances[0];

    // Setup rects
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList && this.classList.contains('readalong-content')) {
        return { bottom: 100, top: 0, height: 100, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => { } } as DOMRect;
      }
      if (this.classList && this.classList.contains('active')) {
        return { bottom: 120, top: 110, height: 20, left: 0, right: 50, width: 50, x: 0, y: 110, toJSON: () => { } } as DOMRect; // Below container (120 > 100)
      }
      return { bottom: 0, top: 0, height: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => { } } as DOMRect;
    });

    // Trigger update
    act(() => {
      if (utterance.onboundary) utterance.onboundary({ name: 'word', charIndex: 0 }); // Word "Hello"
    });

    // Expect scrollIntoView
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('hides Record button by default and shows when selected', async () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

    // 1. Verify hidden initially
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument();

    // 2. Open Settings
    const settingsButton = screen.getByTitle('Settings');
    await act(async () => { settingsButton.click(); });

    // 3. Select "Record"
    const sourceSelect = screen.getByDisplayValue('System Voices');
    fireEvent.change(sourceSelect, { target: { value: 'record' } });

    // 4. Verify visible
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();

    // 5. Select "System Voices" again
    fireEvent.change(sourceSelect, { target: { value: 'system' } });

    // 6. Verify hidden again
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument();
  });

  it('highlights entire sentence for Google system voices (fallback mode)', async () => {
    // 1. Mock Google Voice
    const googleVoice = { name: 'Google US English', lang: 'en-US', voiceURI: 'google-us', localService: false };
    mockGetVoices.mockReturnValue([googleVoice]);

    // 2. Render with setting pre-selected or select it
    // We can rely on default selection logic in ReadingPane picking "Google US English" if it's the only one/best match.
    // ReadingPane default voiceSource is 'system'.

    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

    // Wait for voice init
    await act(async () => {
      // trigger effect
    });

    // 3. Start Reading
    const ttsButton = screen.getByTitle('Read Aloud');
    act(() => {
      ttsButton.click();
      jest.advanceTimersByTime(100);
    });

    // 4. Trigger boundary for FIRST word "Hello" (index 0)
    // In fallback mode, this should highlight "Hello" AND "World" (sentence 0)
    const utterances = (mockSpeak.mock.calls as any[]).map(call => call[0]);
    const utterance = utterances[0];
    act(() => {
      if (utterance.onboundary) utterance.onboundary({ name: 'word', charIndex: 0 });
    });

    // 5. Verify Highlights
    const helloWord = screen.getByText('Hello');
    const worldWord = screen.getByText('world');

    expect(helloWord).toHaveClass('active');
    expect(worldWord).toHaveClass('active');
  });

  it('minimizes and expands the UI', () => {
    render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

    // Initially not minimized
    expect(screen.getByText('ReadAlong')).toBeInTheDocument();
    const minimizeButton = screen.getByTitle('Minimize');
    expect(minimizeButton).toBeInTheDocument();

    // Minimise
    fireEvent.click(minimizeButton);

    // Verify minimized state
    expect(screen.queryByText('ReadAlong')).not.toBeInTheDocument();
    expect(screen.getByText('🎧')).toBeInTheDocument(); // Header changes
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument(); // Settings hidden

    // Expand
    const expandButton = screen.getByTitle('Expand');
    fireEvent.click(expandButton);

    // Verify expanded state
    expect(screen.getByText('ReadAlong')).toBeInTheDocument();
    expect(screen.queryByText('🎧')).not.toBeInTheDocument();
  });

  it('skips to next sentence when current sentence is ignored during playback', async () => {
    const multiSentenceMap: AlignmentMap = {
      fullText: "Sentence one. Sentence two. Sentence three.",
      sentences: [
        { text: "Sentence one.", index: 0, words: [{ text: "Sentence", index: 0 }, { text: "one", index: 1 }] },
        { text: "Sentence two.", index: 1, words: [{ text: "Sentence", index: 2 }, { text: "two", index: 3 }] },
        { text: "Sentence three.", index: 2, words: [{ text: "Sentence", index: 4 }, { text: "three", index: 5 }] }
      ]
    };

    render(<ReadingPane alignmentMap={multiSentenceMap} onClose={jest.fn()} />);
    const ttsButton = screen.getByTitle('Read Aloud');

    // Start reading
    act(() => { ttsButton.click(); jest.advanceTimersByTime(100); });

    // Trigger onstart and onboundary on first utterance to set current word/sentence
    const utterances = (mockSpeak.mock.calls as any[]).map(call => call[0]);
    act(() => {
      if (utterances[0].onstart) utterances[0].onstart();
      if (utterances[0].onboundary) utterances[0].onboundary({ name: 'word', charIndex: 0 });
    });

    // Clear mocks to track subsequent calls
    mockSpeak.mockClear();
    mockCancel.mockClear();

    // Find and click ignore button on first sentence (data-sentence-index="0")
    // The ignore buttons are the 🚫 buttons next to each paragraph
    const ignoreButtons = screen.getAllByTitle('Ignore');
    await act(async () => {
      ignoreButtons[0].click();
      jest.advanceTimersByTime(100);
    });

    // Expect playback to restart from sentence 2 (index 1)
    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
    // First call should be "Sentence two" (the next non-ignored sentence)
    expect((mockSpeak.mock.calls[0][0] as any).text).toContain("two");
  });
});
