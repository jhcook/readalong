
import { ReadingProvider } from './ReadingProvider';
import { AlignmentMap, Word } from '../types';

export class RecordedProvider implements ReadingProvider {
    private audio: HTMLAudioElement;
    private alignmentMap: AlignmentMap;
    private allWords: Word[];

    // Callbacks
    onWordBoundary?: (globalWordIndex: number) => void;
    onSentenceBoundary?: (sentenceIndex: number) => void;
    onStateChange?: (isPlaying: boolean, isLoading: boolean) => void;
    onError?: (error: string) => void;

    constructor(audioUrl: string, alignmentMap: AlignmentMap) {
        this.audio = new Audio(audioUrl);
        this.alignmentMap = alignmentMap;
        this.allWords = alignmentMap.sentences.flatMap(s => s.words);
        this.setupListeners();
    }

    private setupListeners() {
        this.audio.addEventListener('timeupdate', () => {
            const currentTime = this.audio.currentTime;
            const index = this.allWords.findIndex(w =>
                w.start !== undefined &&
                w.end !== undefined &&
                currentTime >= w.start &&
                currentTime <= w.end
            );

            if (index !== -1 && this.onWordBoundary) {
                this.onWordBoundary(index);
            }
        });

        this.audio.addEventListener('ended', () => {
            if (this.onStateChange) this.onStateChange(false, false);
        });

        this.audio.addEventListener('error', (e) => {
            if (this.onError) this.onError(this.audio.error?.message || "Playback error");
            if (this.onStateChange) this.onStateChange(false, false);
        });

        this.audio.addEventListener('play', () => {
            if (this.onStateChange) this.onStateChange(true, false);
        });
        /*
        this.audio.addEventListener('pause', () => {
             // Keep UI active
        });
        */
    }

    async play(sentenceIndex: number): Promise<void> {
        if (sentenceIndex < 0 || sentenceIndex >= this.alignmentMap.sentences.length) return;

        const sentence = this.alignmentMap.sentences[sentenceIndex];
        if (sentence.words.length > 0) {
            const firstWord = sentence.words[0];
            if (firstWord.start !== undefined) {
                this.audio.currentTime = firstWord.start;
                try {
                    await this.audio.play();
                } catch (e) {
                    console.error("Recorded Playback failed", e);
                    if (this.onError) this.onError(String(e));
                }
            }
        }
    }

    pause(): void {
        this.audio.pause();
    }

    resume(): void {
        this.audio.play();
    }

    stop(): void {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    setPlaybackRate(rate: number): void {
        this.audio.playbackRate = rate;
    }
}
