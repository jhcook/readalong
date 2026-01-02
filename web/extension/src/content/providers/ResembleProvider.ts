
import { ReadingProvider } from './ReadingProvider';
import { AlignmentMap } from '../types';
import { ChunkManager, AudioChunk } from '../audio/ChunkManager';
import { ResembleClient } from '../services/ResembleClient';

export class ResembleProvider implements ReadingProvider {
    private alignmentMap: AlignmentMap;
    private chunks: AudioChunk[] = [];
    private apiKey: string;
    private voiceUuid: string;
    private projectUuid: string;

    // Remote State
    private currentChunkIndex: number = -1;
    private isPaused: boolean = false;
    private playbackRate: number = 1.0;
    private chunkGlobalWordOffsets: number[] = [];

    // Message Listener
    private messageListener: ((message: any, sender: any, sendResponse: any) => void) | null = null;

    // Callbacks
    onWordBoundary?: (globalWordIndex: number) => void;
    onSentenceBoundary?: (sentenceIndex: number) => void;
    onStateChange?: (isPlaying: boolean, isLoading: boolean) => void;
    onError?: (error: string) => void;

    constructor(alignmentMap: AlignmentMap, apiKey: string, voiceUuid: string, projectUuid: string) {
        this.alignmentMap = alignmentMap;
        this.apiKey = apiKey;
        this.voiceUuid = voiceUuid;
        this.projectUuid = projectUuid;
        this.chunks = ChunkManager.createChunks(alignmentMap);

        // Calculate global word offsets for chunks
        let globalWordCount = 0;
        this.chunks.forEach(chunk => {
            this.chunkGlobalWordOffsets.push(globalWordCount);
            // Count words in this chunk
            let chunkWordCount = 0;
            chunk.sentences.forEach(s => chunkWordCount += s.words.length);
            globalWordCount += chunkWordCount;
        });

        this.setupAudioListeners();
    }

    private setupAudioListeners() {
        this.messageListener = (message: any) => {
            if (message.type === 'AUDIO_TIMEUPDATE') {
                this.handleTimeUpdate(message.currentTime);
            } else if (message.type === 'AUDIO_ENDED') {
                this.handleChunkEnded();
            } else if (message.type === 'AUDIO_ERROR') {
                console.error("Audio playback error from offscreen", message.error);
                if (this.onError) this.onError(message.error || "Playback error");
                if (this.onStateChange) this.onStateChange(false, false);
            }
        };
        chrome.runtime.onMessage.addListener(this.messageListener);
    }

    private handleTimeUpdate(currentTime: number) {
        if (this.currentChunkIndex === -1) return;
        const chunk = this.chunks[this.currentChunkIndex];
        if (!chunk.alignment) return;

        // Resemble alignment keys
        // graph_times: [[start, end], ...]
        // graph_chars: ["c", ...]
        const graphTimes = chunk.alignment.graph_times;
        const graphChars = chunk.alignment.graph_chars;

        if (!graphTimes) return;

        // Find char index
        let charIdx = -1;
        for (let i = 0; i < graphTimes.length; i++) {
            const [start, end] = graphTimes[i];
            // If current time is within this char's window or close to it
            // Simple approach: if start <= currentTime
            if (start <= currentTime) {
                charIdx = i;
            } else {
                break;
            }
        }

        if (charIdx !== -1) {
            // Map to global word index
            const globalChunkOffset = this.chunkGlobalWordOffsets[this.currentChunkIndex];

            // This mapping logic assumes the text in chunks matches exactly the chars in alignment.
            // Resemble (like all TTS) might normalize text.
            // We need to robustly map char index in generated audio to word index in our text.

            // Standard approach: iterate words and count chars.

            let currentCharCount = 0;
            let chunkWordIndex = 0;
            let foundGlobalIndex = -1;

            for (const sentence of chunk.sentences) {
                for (const word of sentence.words) {
                    const wordLen = word.text.length;

                    // Simple check: does charIdx fall within this word?
                    // Note: This is fragile if TTS normalized text (e.g. "1" -> "one").
                    // But we'll use the same logic as ElevenLabsProvider for now.
                    if (charIdx >= currentCharCount && charIdx < currentCharCount + wordLen) {
                        foundGlobalIndex = globalChunkOffset + chunkWordIndex;
                        break;
                    }

                    // Advance counters
                    currentCharCount += wordLen; // Resemble timestamps typically exclude spaces/gaps in counting
                    chunkWordIndex++;
                }
                if (foundGlobalIndex !== -1) break;
            }

            if (foundGlobalIndex !== -1 && this.onWordBoundary) {
                this.onWordBoundary(foundGlobalIndex);
            }
        }
    }

    private async handleChunkEnded() {
        if (this.currentChunkIndex < this.chunks.length - 1) {
            // Play next
            this.playChunk(this.currentChunkIndex + 1);
        } else {
            // Done
            if (this.onStateChange) this.onStateChange(false, false);
        }
    }

    async play(sentenceIndex: number): Promise<void> {
        // Find chunk containing sentenceIndex
        let targetChunkIndex = -1;
        let runningSentenceCount = 0;

        for (let i = 0; i < this.chunks.length; i++) {
            const chunk = this.chunks[i];
            const count = chunk.sentences.length;
            if (sentenceIndex >= runningSentenceCount && sentenceIndex < runningSentenceCount + count) {
                targetChunkIndex = i;
                break;
            }
            runningSentenceCount += count;
        }

        if (targetChunkIndex === -1) {
            console.warn("Could not find chunk for sentence " + sentenceIndex);
            return;
        }

        // We need startCharOffset for seeking
        const chunk = this.chunks[targetChunkIndex];
        const localSentenceIdx = sentenceIndex - runningSentenceCount;
        let charOffset = 0;
        for (let s = 0; s < localSentenceIdx; s++) {
            const sent = chunk.sentences[s];
            charOffset += sent.text.length + 1;
        }

        await this.playChunk(targetChunkIndex, charOffset);
    }

    // State
    private localAudio: HTMLAudioElement | null = null;
    private useFallback: boolean = false;

    private async playChunk(index: number, startCharOffset: number = 0) {
        if (index < 0 || index >= this.chunks.length) return;

        this.currentChunkIndex = index;
        const chunk = this.chunks[index];

        if (this.onStateChange) this.onStateChange(true, true); // Loading

        try {
            if (chunk.status !== 'ready' || (!chunk.audioId && !chunk.audioUrl)) {
                // Generate
                const { audioId, alignment } = await ResembleClient.generateAudio(this.apiKey, this.voiceUuid, this.projectUuid, chunk.text);
                chunk.audioId = audioId;
                chunk.alignment = alignment;
                chunk.status = 'ready';
            }

            if (this.onStateChange) this.onStateChange(true, false); // Playing

            // Calculate start time in seconds from startCharOffset
            let startTime = 0;
            if (startCharOffset > 0 && chunk.alignment && chunk.alignment.graph_times) {
                const times = chunk.alignment.graph_times; // [[start, end], ...]
                if (startCharOffset < times.length) {
                    startTime = times[startCharOffset][0];
                }
            }

            // Try Offscreen Playback first if not already in fallback mode
            if (!this.useFallback) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            type: 'PLAY_AUDIO',
                            audioId: chunk.audioId,
                            startTime: startTime,
                            rate: this.playbackRate
                        }, (response) => {
                            if (chrome.runtime.lastError || (response && !response.success)) {
                                reject(new Error(chrome.runtime.lastError?.message || response?.error || "Playback failed"));
                            } else {
                                resolve();
                            }
                        });
                    });
                } catch (err) {
                    console.warn("Offscreen playback failed, switching to fallback", err);
                    this.useFallback = true;
                    await this.playLocalAudio(chunk.audioId!, startTime);
                }
            } else {
                await this.playLocalAudio(chunk.audioId!, startTime);
            }

            // Prefetch next
            if (index + 1 < this.chunks.length) {
                this.prefetchChunk(index + 1);
            }

        } catch (err) {
            console.error("Resemble Playback Error", err);
            if (this.onError) this.onError(String(err));
            if (this.onStateChange) this.onStateChange(false, false);
        }
    }

    private async playLocalAudio(audioId: string, startTime: number) {
        if (!this.localAudio) {
            this.localAudio = new Audio();
            this.localAudio.addEventListener('timeupdate', () => {
                if (this.localAudio) this.handleTimeUpdate(this.localAudio.currentTime);
            });
            this.localAudio.addEventListener('ended', () => {
                this.handleChunkEnded();
            });
            this.localAudio.addEventListener('error', (e) => {
                console.error("Local audio error", e);
                if (this.onError) this.onError("Local audio playback error");
                if (this.onStateChange) this.onStateChange(false, false);
            });
        }

        try {
            // Fetch base64 data
            const base64 = await ResembleClient.fetchAudio(audioId);
            this.localAudio.src = base64;
            this.localAudio.currentTime = startTime;
            this.localAudio.playbackRate = this.playbackRate;
            await this.localAudio.play();
        } catch (e) {
            throw e;
        }
    }

    private async prefetchChunk(index: number) {
        if (index >= this.chunks.length) return;
        const chunk = this.chunks[index];
        if (chunk.status === 'ready' || chunk.status === 'loading') return;

        try {
            chunk.status = 'loading'; // speculative
            console.log(`Prefetching chunk ${index}`);
            const { audioId, alignment } = await ResembleClient.generateAudio(this.apiKey, this.voiceUuid, this.projectUuid, chunk.text);
            chunk.audioId = audioId;
            chunk.alignment = alignment;
            chunk.status = 'ready';
        } catch (e) {
            chunk.status = 'pending';
            console.warn(`Prefetch failed for chunk ${index}`, e);
        }
    }

    pause(): void {
        if (this.localAudio && !this.localAudio.paused) {
            this.localAudio.pause();
        } else {
            chrome.runtime.sendMessage({ type: 'PAUSE_AUDIO' });
        }
        this.isPaused = true;
    }

    resume(): void {
        if (this.isPaused) {
            if (this.localAudio) {
                this.localAudio.play().catch(e => console.error("Resume failed", e));
            } else {
                chrome.runtime.sendMessage({ type: 'RESUME_AUDIO' });
            }
            this.isPaused = false;
        }
    }

    stop(): void {
        if (this.localAudio) {
            this.localAudio.pause();
            this.localAudio.currentTime = 0;
            // Unload source to free memory
            this.localAudio.removeAttribute('src');
            this.localAudio.load();
        }
        chrome.runtime.sendMessage({ type: 'STOP_AUDIO' });

        this.currentChunkIndex = -1;
        this.isPaused = false;

        // Remove listener to prevent leaks if this instance is discarded
        if (this.messageListener) {
            chrome.runtime.onMessage.removeListener(this.messageListener);
            this.messageListener = null;
        }

        if (this.onStateChange) this.onStateChange(false, false);
    }

    setPlaybackRate(rate: number): void {
        this.playbackRate = rate;
        if (this.localAudio) {
            this.localAudio.playbackRate = rate;
        }
        chrome.runtime.sendMessage({ type: 'SET_PLAYBACK_RATE', rate });
    }
}
