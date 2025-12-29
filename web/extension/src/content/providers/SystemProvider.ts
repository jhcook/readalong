
import { ReadingProvider } from './ReadingProvider';
import { AlignmentMap, Word } from '../types';
import { buildTextAndMap } from '../utils/textUtils';

export class SystemProvider implements ReadingProvider {
    private alignmentMap: AlignmentMap;
    private allWords: Word[];
    private utterances: SpeechSynthesisUtterance[] = [];
    private voice: SpeechSynthesisVoice | null = null;

    // Callback placeholders
    onWordBoundary?: (globalWordIndex: number) => void;
    onSentenceBoundary?: (sentenceIndex: number) => void;
    onStateChange?: (isPlaying: boolean, isLoading: boolean) => void;
    onError?: (error: string) => void;

    private isPaused = false;
    private rate: number = 1.0;
    private currentSentenceIndex: number = -1;

    constructor(alignmentMap: AlignmentMap) {
        this.alignmentMap = alignmentMap;
        this.allWords = alignmentMap.sentences.flatMap(s => s.words);
    }

    setVoice(voice: SpeechSynthesisVoice | null) {
        this.voice = voice;
    }

    async play(startSentenceIndex: number): Promise<void> {
        this.stop();
        this.isPaused = false;

        if (this.onStateChange) this.onStateChange(true, false);

        const sentences = this.alignmentMap.sentences;
        if (!sentences || sentences.length === 0) return;

        // Calculate global offsets up to startSentenceIndex
        let globalWordOffset = 0;
        for (let i = 0; i < startSentenceIndex; i++) {
            globalWordOffset += sentences[i].words.length;
        }

        const newUtterances: SpeechSynthesisUtterance[] = [];

        // We iterate starting from the exact sentence index requested
        for (let i = startSentenceIndex; i < sentences.length; i++) {
            const sentence = sentences[i];
            if (sentence.words.length === 0) continue;

            const { text, map } = buildTextAndMap(sentence.words);
            const utterance = new SpeechSynthesisUtterance(text);

            if (this.voice) {
                utterance.voice = this.voice;
            }
            utterance.rate = this.rate;

            // Capture current offset for closure
            const currentSentenceOffset = globalWordOffset;
            const currentSentenceIndex = i;

            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    const charIndex = event.charIndex;
                    const localWordIndex = map[charIndex];
                    if (localWordIndex !== undefined) {
                        const globalIndex = currentSentenceOffset + localWordIndex;
                        if (this.onWordBoundary) {
                            this.onWordBoundary(globalIndex);
                        }
                    }
                }
            };

            utterance.onstart = () => {
                this.currentSentenceIndex = currentSentenceIndex; // Track for restart
                // If it's the very first utterance we are playing (not necessarily the first in doc)
                // but effectively we might want to signal sentence boundary?
                if (this.onSentenceBoundary) {
                    this.onSentenceBoundary(currentSentenceIndex);
                }
                // Legacy behavior: Highlight first word immediately
                if (this.onWordBoundary) {
                    // Find global index of first word in this sentence
                    // We know currentSentenceOffset is global word offset
                    this.onWordBoundary(currentSentenceOffset);
                }
            };

            utterance.onend = () => {
                // Check if this was the last utterance
                if (i === sentences.length - 1) {
                    if (this.onStateChange) this.onStateChange(false, false);
                }
            }

            utterance.onerror = (e) => {
                if (e.error !== 'canceled' && e.error !== 'interrupted') {
                    console.error('SystemProvider TTS error', e);
                    if (this.onError) this.onError(e.error);
                }
            }

            newUtterances.push(utterance);
            globalWordOffset += sentence.words.length;
        }

        this.utterances = newUtterances;

        if (newUtterances.length > 0) {
            newUtterances.forEach(u => window.speechSynthesis.speak(u));
        } else {
            if (this.onStateChange) this.onStateChange(false, false);
        }
    }

    private isNetworkVoice(): boolean {
        if (!this.voice) return false;
        // Heuristic for network voices that don't resume correctly
        return this.voice.localService === false ||
            this.voice.name.includes('Google') ||
            this.voice.name.includes('Online');
    }

    pause(): void {
        const isSpeaking = window.speechSynthesis.speaking; // Speaking state
        // Note: speaking is true even if paused.

        if (isSpeaking && !window.speechSynthesis.paused) {
            if (this.isNetworkVoice()) {
                // Network voices often fail to resume. workaround: Stop and track state.
                window.speechSynthesis.cancel();
            } else {
                window.speechSynthesis.pause();
            }
            this.isPaused = true;
        }
    }

    resume(): void {
        if (this.isPaused) {
            if (this.isNetworkVoice()) {
                // Restart from current sentence
                // We need to ensure isPaused is cleared before play, 
                // but play() sets isPaused=false anyway.
                if (this.currentSentenceIndex !== -1) {
                    this.play(this.currentSentenceIndex);
                } else {
                    // Fallback if index lost
                    this.play(0);
                }
            } else {
                window.speechSynthesis.resume();
            }
            this.isPaused = false;
        }
    }

    stop(): void {
        window.speechSynthesis.cancel();
        this.utterances = [];
        this.isPaused = false;
        if (this.onStateChange) this.onStateChange(false, false);
    }

    setPlaybackRate(rate: number): void {
        this.rate = rate; // Store new rate

        // If currently speaking, we need to restart to apply the rate change?
        // SpeechSynthesisUtterance rate cannot be changed while speaking on most browsers.
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            // We need to know where we are to restart. 
            // We don't easily track the *current* sentence index inside the loop unless we track it.
            // But we do listen to 'onstart' which gives us the sort-of current index?
            // Actually, 'onstart' fires when an utterance starts. 
            // If we track the last started sentence index, we can restart from there.
            if (this.currentSentenceIndex !== -1) {
                this.play(this.currentSentenceIndex);
            }
        }
    }
}
