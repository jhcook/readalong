
import { ReadingProvider } from './ReadingProvider';
import { AlignmentMap, Word } from '../types';
import { ChunkManager, AudioChunk } from '../audio/ChunkManager';
import { GoogleClient, GoogleVoice } from '../services/GoogleClient';

export class GoogleProvider implements ReadingProvider {
    private alignmentMap: AlignmentMap;
    private chunks: AudioChunk[] = [];
    private apiKey: string;
    private voiceId: string; // e.g. "en-US-Neural2-F"
    private languageCode: string; // e.g. "en-US"
    private ssmlGender: string;   // e.g. "FEMALE"

    // Remote State
    private currentChunkIndex: number = -1;
    private isPaused: boolean = false;
    private chunkGlobalWordOffsets: number[] = [];

    // Message Listener
    private messageListener: ((message: any, sender: any, sendResponse: any) => void) | null = null;

    // Callbacks
    onWordBoundary?: (globalWordIndex: number) => void;
    onSentenceBoundary?: (sentenceIndex: number) => void;
    onStateChange?: (isPlaying: boolean, isLoading: boolean) => void;
    onError?: (error: string) => void;

    constructor(alignmentMap: AlignmentMap, apiKey: string, voice: GoogleVoice) {
        this.alignmentMap = alignmentMap;
        this.apiKey = apiKey;
        this.voiceId = voice.name;
        this.languageCode = voice.languageCodes[0];
        this.ssmlGender = voice.ssmlGender;
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
        // chunk.alignment here refers to google timepoints: [{markName: "word_0", timeSeconds: 1.2}, ...]
        if (!chunk.alignment) return;

        const timepoints = chunk.alignment as { markName: string, timeSeconds: number }[];

        // Find the latest timepoint that is <= currentTime
        // We can optimize this if needed, but linear back-scan is fine for small chunks
        let activeMarkName: string | null = null;

        for (let i = timepoints.length - 1; i >= 0; i--) {
            if (timepoints[i].timeSeconds <= currentTime) {
                activeMarkName = timepoints[i].markName;
                break;
            }
        }

        if (activeMarkName && activeMarkName.startsWith('word_')) {
            const localWordIndex = parseInt(activeMarkName.split('_')[1], 10);
            if (!isNaN(localWordIndex)) {
                // Map to global
                const globalChunkOffset = this.chunkGlobalWordOffsets[this.currentChunkIndex];
                const globalIndex = globalChunkOffset + localWordIndex;
                if (this.onWordBoundary) {
                    this.onWordBoundary(globalIndex);
                }
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

        // Seeking to specific sentence not perfectly supported with SSML marks unless we find the mark for the first word of that sentence.
        // We can find the timepoint for that word.
        // First, finding which word active inside the chunk corresponds to sentence active.
        const chunk = this.chunks[targetChunkIndex];
        const localSentenceIdx = sentenceIndex - runningSentenceCount;

        // Find the first word index of this sentence relative to the chunk start
        let localWordStart = 0;
        for (let s = 0; s < localSentenceIdx; s++) {
            localWordStart += chunk.sentences[s].words.length;
        }

        await this.playChunk(targetChunkIndex, localWordStart);
    }

    // State
    private localAudio: HTMLAudioElement | null = null;
    private useFallback: boolean = false;

    private buildSSML(chunk: AudioChunk): string {
        // Construct SSML with marks
        // <speak>
        //   Sentence 1 word <mark name="word_0"/> word <mark name="word_1"/> ...
        // </speak>
        let ssml = '<speak>';
        let wordCounter = 0;

        chunk.sentences.forEach(sentence => {
            sentence.words.forEach(word => {
                // Escape special characters in text
                const escaped = word.text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');

                ssml += `${escaped} <mark name="word_${wordCounter}"/> `;
                wordCounter++;
            });
            // Add pause after sentence?
            ssml += '<break time="300ms"/> ';
        });

        ssml += '</speak>';
        return ssml;
    }

    private async playChunk(index: number, startWordIndex: number = 0) {
        if (index < 0 || index >= this.chunks.length) return;

        this.currentChunkIndex = index;
        const chunk = this.chunks[index];

        if (this.onStateChange) this.onStateChange(true, true); // Loading

        try {
            if (chunk.status !== 'ready' || (!chunk.audioId && !chunk.audioUrl)) {
                // Generate SSML
                const ssml = this.buildSSML(chunk);

                const { audioId, timepoints } = await GoogleClient.generateAudio(
                    this.apiKey,
                    ssml,
                    this.voiceId,
                    this.languageCode,
                    this.ssmlGender
                );

                chunk.audioId = audioId;
                chunk.alignment = timepoints; // Store timepoints as alignment
                chunk.status = 'ready';
            }

            if (this.onStateChange) this.onStateChange(true, false); // Playing

            // Calculate start time in seconds from startWordIndex if seeking
            let startTime = 0;
            if (startWordIndex > 0 && chunk.alignment) {
                const timepoints = chunk.alignment as { markName: string, timeSeconds: number }[];
                // Find mark active for "word_${startWordIndex}"
                // The mark is placed AFTER the word in my SSML loop above? 
                // Wait. `word <mark/>` means mark happens after word is spoken.
                // Usually we want highlighting to start when word starts.
                // So mark should be BEFORE the word: `<mark name="word_${i}"/> ${escaped}`
                // FIXING logic in buildSSML below...

                // If I fix buildSSML, then looking up word_${startWordIndex} gives start time.
                const targetMark = `word_${startWordIndex}`;
                const tp = timepoints.find(t => t.markName === targetMark);
                if (tp) {
                    startTime = tp.timeSeconds;
                }
            }

            // Play via Offscreen
            if (!this.useFallback) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            type: 'PLAY_AUDIO',
                            audioId: chunk.audioId,
                            startTime: startTime
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
            console.error("Google Playback Error", err);
            if (this.onError) this.onError(String(err));
            if (this.onStateChange) this.onStateChange(false, false);
        }
    }

    private buildSSMLCorrected(chunk: AudioChunk): string {
        // Correct SSML: mark BEFORE word
        let ssml = '<speak>';
        let wordCounter = 0;

        chunk.sentences.forEach(sentence => {
            sentence.words.forEach(word => {
                const escaped = word.text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');

                ssml += `<mark name="word_${wordCounter}"/>${escaped} `;
                wordCounter++;
            });
            ssml += '<break time="300ms"/> ';
        });

        ssml += '</speak>';
        return ssml;
    }

    // Overwrite buildSSML with corrected version
    buildSSML_Final(chunk: AudioChunk): string {
        return this.buildSSMLCorrected(chunk);
    }


    private async playLocalAudio(audioId: string, startTime: number) {
        // Reusing similar logic to ElevenLabsProvider
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
            // Fetch base64 data via FETCH_AUDIO (reused)
            // Note: Background FETCH_AUDIO handler expects audioId in cache. 
            // Google audio is in same cache.
            const response = await new Promise<any>((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'FETCH_AUDIO', audioId }, (res) => {
                    resolve(res);
                })
            });

            if (response && response.success) {
                this.localAudio.src = response.audioData;
                this.localAudio.currentTime = startTime;
                await this.localAudio.play();
            } else {
                throw new Error(response.error || "Failed to fetch local audio");
            }
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
            console.log(`Prefetching google chunk ${index}`);
            const ssml = this.buildSSML_Final(chunk);
            const { audioId, timepoints } = await GoogleClient.generateAudio(
                this.apiKey,
                ssml,
                this.voiceId,
                this.languageCode,
                this.ssmlGender
            );
            chunk.audioId = audioId;
            chunk.alignment = timepoints;
            chunk.status = 'ready';
        } catch (e) {
            chunk.status = 'pending';
            console.warn(`Prefetch failed for google chunk ${index}`, e);
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
            this.localAudio.removeAttribute('src');
            this.localAudio.load();
        }
        chrome.runtime.sendMessage({ type: 'STOP_AUDIO' });

        this.currentChunkIndex = -1;
        this.isPaused = false;

        if (this.messageListener) {
            chrome.runtime.onMessage.removeListener(this.messageListener);
            this.messageListener = null;
        }

        if (this.onStateChange) this.onStateChange(false, false);
    }

    setPlaybackRate(rate: number): void {
        if (this.localAudio) {
            this.localAudio.playbackRate = rate;
        }
        chrome.runtime.sendMessage({ type: 'SET_PLAYBACK_RATE', rate });
    }
}
