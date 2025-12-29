
import { SystemProvider } from './SystemProvider';
import { AlignmentMap } from '../types';

describe('SystemProvider', () => {
    let mockSpeechSynthesis: any;
    let mockUtterance: any;
    let provider: SystemProvider;

    const mockAlignmentMap: AlignmentMap = {
        fullText: "Hello world. This is a test.",
        sentences: [
            { text: "Hello world.", index: 0, words: [{ text: "Hello", index: 0 }, { text: "world.", index: 1 }] },
            { text: "This is a test.", index: 1, words: [{ text: "This", index: 2 }, { text: "is", index: 3 }, { text: "a", index: 4 }, { text: "test.", index: 5 }] }
        ]
    };

    beforeEach(() => {
        mockSpeechSynthesis = {
            speak: jest.fn(),
            cancel: jest.fn(),
            pause: jest.fn(),
            resume: jest.fn(),
            getVoices: jest.fn().mockReturnValue([]),
            speaking: false,
            paused: false,
        };
        Object.defineProperty(window, 'speechSynthesis', {
            value: mockSpeechSynthesis,
            writable: true
        });

        // Mock Utterance
        mockUtterance = jest.fn();
        global.SpeechSynthesisUtterance = mockUtterance;

        provider = new SystemProvider(mockAlignmentMap);
    });

    it('plays sentences correctly', () => {
        provider.play(0);
        expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2); // 2 sentences
    });

    it('uses native pause/resume for local voices', () => {
        // Setup local voice
        const localVoice = { name: 'Samantha', localService: true, lang: 'en-US' } as SpeechSynthesisVoice;
        provider.setVoice(localVoice);

        // Play and Simulate Speaking
        provider.play(0);
        mockSpeechSynthesis.speaking = true;

        // Clear mocks from setup (play calls stop -> cancel)
        mockSpeechSynthesis.cancel.mockClear();
        mockSpeechSynthesis.pause.mockClear();

        // Pause
        provider.pause();
        expect(mockSpeechSynthesis.pause).toHaveBeenCalled();
        expect(mockSpeechSynthesis.cancel).not.toHaveBeenCalled();

        // Simulate Paused State
        mockSpeechSynthesis.paused = true;

        // Resume
        provider.resume();
        expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
        // Should NOT restart (speak)
        expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2); // Only initial play
    });

    it('uses Stop/Restart strategy for Google Network voices', () => {
        // Setup network voice
        const networkVoice = { name: 'Google US English', localService: false, lang: 'en-US' } as SpeechSynthesisVoice;
        provider.setVoice(networkVoice);

        // Play
        provider.play(0);
        expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
        mockSpeechSynthesis.speaking = true;

        // Clear previous speak calls to verify restart behavior explicitly
        mockSpeechSynthesis.speak.mockClear();

        // Pause -> Should CALL CANCEL (Stop)
        provider.pause();
        expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
        expect(mockSpeechSynthesis.pause).not.toHaveBeenCalled();

        // Resume -> Should CALL SPEAK (Restart)
        provider.resume();
        expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
        expect(mockSpeechSynthesis.resume).not.toHaveBeenCalled();
    });

    it('uses Stop/Restart strategy for Unknown Network voices (localService=false)', () => {
        // Setup generic network voice
        const networkVoice = { name: 'Microsoft Natasha Online', localService: false, lang: 'en-US' } as SpeechSynthesisVoice;
        provider.setVoice(networkVoice);

        // Play
        provider.play(0);
        mockSpeechSynthesis.speaking = true;
        mockSpeechSynthesis.speak.mockClear();

        // Pause -> Should CALL CANCEL
        provider.pause();
        expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();

        // Resume -> Should CALL SPEAK
        provider.resume();
        expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });
});
