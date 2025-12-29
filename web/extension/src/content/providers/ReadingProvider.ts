
export interface ReadingProvider {
    play(sentenceIndex: number): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
    setPlaybackRate(rate: number): void;

    // Callbacks
    onWordBoundary?: (globalWordIndex: number) => void;
    onSentenceBoundary?: (sentenceIndex: number) => void;
    onStateChange?: (isPlaying: boolean, isLoading: boolean) => void;
    onError?: (error: string) => void;
}
