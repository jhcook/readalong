
import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import ReadingPane from './ReadingPane';
import { AlignmentMap } from './types';

// Mock dependencies
jest.mock('./audio/AudioRecorder', () => ({
    AudioRecorder: jest.fn().mockImplementation(() => ({
        prepare: jest.fn().mockResolvedValue({}),
        startRecording: jest.fn(),
        stop: jest.fn(),
        isRecording: jest.fn().mockReturnValue(false)
    }))
}));
jest.mock('./audio/SttEngine', () => ({
    SttEngine: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn()
    }))
}));
jest.mock('./alignment/Aligner', () => ({
    Aligner: jest.fn().mockImplementation(() => ({
        align: jest.fn(),
        reset: jest.fn()
    }))
}));

// Mock SpeechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
    value: {
        getVoices: jest.fn().mockReturnValue([]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        onvoiceschanged: null
    },
    writable: true
});
global.SpeechSynthesisUtterance = jest.fn() as any;


const mockAlignmentMap: AlignmentMap = {
    fullText: "Test.",
    sentences: [{ text: "Test.", index: 0, words: [{ text: "Test", index: 0 }] }]
};

describe('ReadingPane Settings & Fallback', () => {
    let mockGet: jest.Mock;
    let mockSet: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGet = jest.fn();
        mockSet = jest.fn();

        (window as any).chrome = {
            storage: {
                local: {
                    get: mockGet,
                    set: mockSet
                }
            },
            runtime: {
                sendMessage: jest.fn(),
                lastError: null
            }
        };
    });

    afterEach(() => {
        delete (window as any).chrome;
    });

    it('does NOT save settings (overwrite) on mount before loading completes', async () => {
        // Determine behavior of get. It takes a callback.
        mockGet.mockImplementation((keys, callback) => {
            // Simulate delay
            setTimeout(() => {
                callback({
                    isDyslexiaFont: true // Simulate existing setting
                });
            }, 50);
        });

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        // Initially, get is called
        expect(mockGet).toHaveBeenCalled();

        // immediate check: set should NOT be called yet
        expect(mockSet).not.toHaveBeenCalled();

        // Wait for get to complete
        await waitFor(() => expect(screen.queryByTitle('Read Aloud')).toBeInTheDocument()); // Wait for something to ensure render cycles

        // After delay, settings are loaded.
        // Verify state update (dyslexia font class is applied)
        // The component wrapper div has the class
        const wrapper = screen.getByText('ReadAlong').closest('.readalong-overlay');
        await waitFor(() => expect(wrapper).toHaveClass('dyslexia-font'));

        // Even now, set should NOT be called because settings didn't change from state init
        // (Wait, state init is false. Loaded is true. So state changed from false -> true).
        // Does that trigger saving effect?
        // Saving effect deps: [isDyslexiaFont, ...].
        // isDyslexiaFont changed.
        // So 'set' WILL be called but WITH THE LOADED VALUES.

        // The Bug was: set called with DEFAULTS before LOAD.
        // My fix: `if (settingsLoaded ...)`
        // When `setIsDyslexiaFont(true)` happens, `settingsLoaded` is set to true in the SAME callback.
        // React batches updates?
        // If setSettingsLoaded(true) and setIsDyslexiaFont(true) happen together.
        // Then effect runs. settingsLoaded is true. isDyslexiaFont is true.
        // So it saves `{ isDyslexiaFont: true }`. This is CORRECT (idempotent save).

        // What we verify is that it didn't save `{ isDyslexiaFont: false }` (or empty defaults) at the start.
        if (mockSet.mock.calls.length > 0) {
            expect(mockSet.mock.calls[0][0]).toMatchObject({ isDyslexiaFont: true });
        }
    });

    it('prevents saving defaults if get returns empty', async () => {
        // Simulate first run (empty storage)
        mockGet.mockImplementation((keys, callback) => {
            callback({});
        });

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        // Should save defaults eventually?
        // No, only if state changes. 
        // Defaults are false/empty. State is false/empty. No change.
        // So set should NEVER be called.
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('updates settings only after they are modified by user', async () => {
        mockGet.mockImplementation((keys, callback) => callback({}));

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        const settingsButton = screen.getByTitle('Settings');
        act(() => { settingsButton.click(); });

        const dyslexiaBtn = screen.getByText('Dyslexia Font');
        act(() => { dyslexiaBtn.click(); }); // Toggle to true

        await waitFor(() => {
            expect(mockSet).toHaveBeenCalled();
        });

        expect(mockSet.mock.calls[0][0]).toMatchObject({ isDyslexiaFont: true });
    });

    it('does NOT fallback to System TTS if ElevenLabs configured but missing keys', async () => {
        // Mock settings loading with ElevenLabs selected but NO key
        mockGet.mockImplementation((keys, callback) => {
            callback({
                voiceSource: 'elevenlabs',
                elevenLabsApiKey: '', // Missing
                selectedVoiceId: ''
            });
        });

        // Mock alert
        jest.spyOn(window, 'alert').mockImplementation(() => { });

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        // Wait for settings load
        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        // Click Read Aloud
        const ttsButton = screen.getByTitle('Read Aloud');
        expect(ttsButton).toBeInTheDocument();

        act(() => {
            ttsButton.click();
        });

        // Should Trigger Alert
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Please configure ElevenLabs'));

        // Should NOT trigger System TTS (speak)
        expect((window.speechSynthesis.speak as jest.Mock)).not.toHaveBeenCalled();
    });

    it('does NOT fallback to System TTS if Google Voices configured but missing keys', async () => {
        // Mock settings loading with Google selected but NO key
        mockGet.mockImplementation((keys, callback) => {
            callback({
                voiceSource: 'google',
                googleApiKey: '', // Missing
                selectedGoogleVoiceName: 'en-US-Neural2-A'
            });
        });

        // Mock alert
        jest.spyOn(window, 'alert').mockImplementation(() => { });

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        // Wait for settings load
        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        // Click Read Aloud
        const ttsButton = screen.getByTitle('Read Aloud');
        expect(ttsButton).toBeInTheDocument();

        act(() => {
            ttsButton.click();
        });

        // Should Trigger Alert
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Please configure Google Cloud authentication'));

        // Should NOT trigger System TTS (speak)
        expect((window.speechSynthesis.speak as jest.Mock)).not.toHaveBeenCalled();
    });

    it('STOPS playback if voice settings change while playing', async () => {
        // Mock initial settings
        mockGet.mockImplementation((keys, callback) => {
            callback({
                voiceSource: 'system',
                systemVoiceURI: 'Google US English'
            });
        });

        const { rerender } = render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);
        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        // Start Playback
        const ttsButton = screen.getByTitle('Read Aloud');
        act(() => { ttsButton.click(); });

        // Verify System TTS started
        expect(window.speechSynthesis.speak).toHaveBeenCalled();

        // Simulate changing settings (e.g., via the UI or external storage change reflected in internal state)
        // We will simulate clicking the settings UI to change voice source
        const settingsButton = screen.getByTitle('Settings');
        act(() => { settingsButton.click(); });

        const sourceSelect = screen.getByLabelText('Voice Source') as HTMLSelectElement;
        expect(sourceSelect).toBeInTheDocument();

        // Change to ElevenLabs
        act(() => {
            fireEvent.change(sourceSelect, { target: { value: 'elevenlabs' } });
        });

        // Current implementation: changing settings triggers useEffect which calls handleStop()
        // handleStop() -> readingProvider.current.stop() -> SystemProvider.stop() -> speechSynthesis.cancel()

        await waitFor(() => {
            expect(window.speechSynthesis.cancel).toHaveBeenCalled();
        });
    });

    it('loads theme from storage and applies correct class', async () => {
        mockGet.mockImplementation((keys, callback) => {
            callback({ theme: 'playful' });
        });

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        // Wait for settings load
        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        const wrapper = screen.getByText('ReadAlong').closest('.readalong-overlay');
        expect(wrapper).toHaveClass('theme-playful');
    });

    it('persists theme selection when changed', async () => {
        mockGet.mockImplementation((keys, callback) => callback({})); // Default 'professional'

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);
        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        // Open Settings
        const settingsButton = screen.getByTitle('Settings');
        act(() => { settingsButton.click(); });

        // Change Theme
        const themeSelect = screen.getByLabelText('Theme');
        fireEvent.change(themeSelect, { target: { value: 'academic' } });

        await waitFor(() => {
            expect(mockSet).toHaveBeenCalled();
        });

        expect(mockSet.mock.calls[0][0]).toMatchObject({ theme: 'academic' });
    });

    it('applies building-blocks theme correctly', async () => {
        mockGet.mockImplementation((keys, callback) => {
            callback({ theme: 'building-blocks' });
        });

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        // Wait for settings load
        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        const wrapper = screen.getByText('ReadAlong').closest('.readalong-overlay');
        expect(wrapper).toHaveClass('theme-building-blocks');
    });

    it('updates playbackRate when slider changes', async () => {
        mockGet.mockImplementation((keys, callback) => callback({})); // Default 1.0

        render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={jest.fn()} />);

        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        // Open Settings
        const settingsButton = screen.getByTitle('Settings');
        act(() => { settingsButton.click(); });

        // Change Speed
        const slider = screen.getByLabelText(/Speed:/); // Matches "Speed: 1.0x"
        fireEvent.change(slider, { target: { value: '1.5' } });

        await waitFor(() => {
            expect(mockSet).toHaveBeenCalled();
        });

        expect(mockSet.mock.calls[0][0]).toMatchObject({ playbackRate: 1.5 });
    });

});
