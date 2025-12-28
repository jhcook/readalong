import React, { useState, useEffect, useRef } from 'react';
import { AlignmentMap, Sentence, Word } from './types';
import { AudioRecorder } from './audio/AudioRecorder';
import { SttEngine } from './audio/SttEngine';
import { Aligner, RecognizedWord } from './alignment/Aligner';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { ElevenLabsClient, Voice } from './services/ElevenLabsClient';
import { ChunkManager, AudioChunk } from './audio/ChunkManager';
import { trace, SpanStatusCode } from '@opentelemetry/api';

interface ReadingPaneProps {
  alignmentMap?: AlignmentMap;
  text?: string; // Fallback for backward compatibility or error states
  onClose: () => void;
}

// Helper to reconstruct text and map character offsets to word indices
const buildTextAndMap = (words: Word[]) => {
  let text = '';
  const map: number[] = [];

  words.forEach((word, index) => {
    // Current length is the start char index of this word
    const start = text.length;
    text += word.text + ' ';
    // Map every character in this word (plus the trailing space) to this word index
    for (let i = start; i < text.length; i++) {
      map[i] = index;
    }
  });

  return { text: text.trim(), map };
};

const ReadingPane: React.FC<ReadingPaneProps> = ({ alignmentMap, text, onClose }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const isOnline = useNetworkStatus();

  // TTS State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice Preferences
  const [voiceSource, setVoiceSource] = useState<'system' | 'elevenlabs'>('system');
  const [systemVoiceURI, setSystemVoiceURI] = useState<string>('');

  // ElevenLabs State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);
  const [voiceFetchError, setVoiceFetchError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Chunked Playback State
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(-1);
  const audioChunksRef = useRef<AudioChunk[]>([]); // Ref to access latest chunks in callbacks/effects without stale closures

  // Keep ref synced
  useEffect(() => {
    audioChunksRef.current = audioChunks;
  }, [audioChunks]);

  // Predictive Highlighting Ref - REMOVED

  // Load voices
  useEffect(() => {
    const updateVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null); // Unified playback URL
  const [currentAlignment, setCurrentAlignment] = useState<any>(null); // Store ElevenLabs alignment data

  const audioRecorder = useRef<AudioRecorder>(new AudioRecorder());
  const sttEngine = useRef<SttEngine>(new SttEngine());
  const aligner = useRef<Aligner>(new Aligner());

  // Accessibility states
  const [isDyslexiaFont, setIsDyslexiaFont] = useState<boolean>(false);
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);

  // Helper to safely access chrome API
  const getChrome = () => {
    if (typeof chrome !== 'undefined') return chrome;
    if (typeof window !== 'undefined' && (window as any).chrome) return (window as any).chrome;
    return null;
  };

  // Load settings on mount
  useEffect(() => {
    const chromeApi = getChrome();
    if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
      chromeApi.storage.local.get(['isDyslexiaFont', 'isHighContrast', 'elevenLabsApiKey', 'selectedVoiceId', 'voiceSource', 'systemVoiceURI'], (result: any) => {
        if (result.isDyslexiaFont !== undefined) setIsDyslexiaFont(result.isDyslexiaFont);
        if (result.isHighContrast !== undefined) setIsHighContrast(result.isHighContrast);
        if (result.elevenLabsApiKey) setElevenLabsApiKey(result.elevenLabsApiKey);
        if (result.selectedVoiceId) setSelectedVoiceId(result.selectedVoiceId);
        if (result.voiceSource) setVoiceSource(result.voiceSource);
        if (result.systemVoiceURI) setSystemVoiceURI(result.systemVoiceURI);
      });
    }
  }, []);

  // Fetch voices when API key is set
  useEffect(() => {
    if (elevenLabsApiKey && isSettingsOpen && voiceSource === 'elevenlabs') {
      const trimmedKey = elevenLabsApiKey.trim();
      if (!trimmedKey) return;

      setIsLoadingVoices(true);
      setVoiceFetchError(null);
      ElevenLabsClient.getVoices(trimmedKey)
        .then(voices => setClonedVoices(voices))
        .catch(err => {
          console.error("Failed to load voices", err);
          setVoiceFetchError(typeof err === 'string' ? err : (err.message || String(err)));
        })
        .finally(() => setIsLoadingVoices(false));
    }
  }, [elevenLabsApiKey, isSettingsOpen, voiceSource]);

  // Save settings when they change
  useEffect(() => {
    const chromeApi = getChrome();
    if (chromeApi && chromeApi.storage && chromeApi.storage.local) { // Added check back for safety
      chromeApi.storage.local.set({ isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId, voiceSource, systemVoiceURI });
    }
  }, [isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId, voiceSource, systemVoiceURI]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      if (activeAudioUrl && activeAudioUrl !== recordedAudioUrl) { // Clean up ElevenLabs generated audio if different
        URL.revokeObjectURL(activeAudioUrl);
      }
    };
  }, [recordedAudioUrl, activeAudioUrl]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsTtsPlaying(false);
      setIsAudioPlaying(false);
    };
  }, []);

  // Sync active audio URL with recorded audio if system voice and recording exists
  useEffect(() => {
    if (recordedAudioUrl && voiceSource === 'system') {
      setActiveAudioUrl(recordedAudioUrl);
    }
  }, [recordedAudioUrl, voiceSource]);

  // Flatten words for easy indexing
  const allWords: Word[] = React.useMemo(() => {
    if (!alignmentMap) return [];
    return alignmentMap.sentences.flatMap(s => s.words);
  }, [alignmentMap]);

  // Initialize Chunks
  useEffect(() => {
    if (alignmentMap) {
      const chunks = ChunkManager.createChunks(alignmentMap);
      setAudioChunks(chunks);
      setCurrentChunkIndex(-1);
    } else {
      setAudioChunks([]);
      setCurrentChunkIndex(-1);
    }
  }, [alignmentMap]);

  // Helper to update a single chunk in state
  const updateChunk = (id: number, updates: Partial<AudioChunk>) => {
    setAudioChunks(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };


  // Play specific chunk
  const playChunk = async (index: number) => {
    if (index < 0 || index >= audioChunksRef.current.length) return;

    const chunk = audioChunksRef.current[index];
    setCurrentChunkIndex(index);

    if (chunk.status === 'ready' && chunk.audioUrl) {
      console.log(`[ChunkPlayback] Playing ready chunk ${index}`);
      setActiveAudioUrl(chunk.audioUrl);
      setCurrentAlignment(chunk.alignment);
      setIsAudioPlaying(true);
      setIsPaused(false);
      return;
    }

    if (chunk.status === 'pending' || chunk.status === 'error') {
      console.log(`[ChunkPlayback] Generating chunk ${index}`);
      setIsGenerating(true);
      updateChunk(chunk.id, { status: 'loading' });

      try {
        if (!elevenLabsApiKey || !selectedVoiceId) throw new Error("Missing API Key or Voice ID");

        const { audioData, alignment } = await ElevenLabsClient.generateAudio(elevenLabsApiKey, selectedVoiceId, chunk.text);

        updateChunk(chunk.id, {
          status: 'ready',
          audioUrl: audioData,
          alignment: alignment
        });

        // If we are still "waiting" for this chunk to play (user didn't stop), play it
        if (currentChunkIndex === index || currentChunkIndex === -1) { // Basic check
          setActiveAudioUrl(audioData);
          setCurrentAlignment(alignment);
          setIsAudioPlaying(true);
          setIsPaused(false);
        }

      } catch (err) {
        console.error(`[ChunkPlayback] Failed chunk ${index}`, err);
        const msg = typeof err === 'string' ? err : (err as Error).message;
        updateChunk(chunk.id, { status: 'error', error: msg });
        alert(`Failed to play segment: ${msg}`);
        setIsAudioPlaying(false);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  // Just-in-Time Pre-fetch
  const prefetchChunk = async (index: number) => {
    if (index < 0 || index >= audioChunksRef.current.length) return;
    const chunk = audioChunksRef.current[index];

    if (chunk.status === 'pending') {
      console.log(`[ChunkPlayback] Pre-fetching chunk ${index}`);
      updateChunk(chunk.id, { status: 'loading' });

      try {
        if (!elevenLabsApiKey || !selectedVoiceId) return; // Silent fail on prefetch

        const { audioData, alignment } = await ElevenLabsClient.generateAudio(elevenLabsApiKey, selectedVoiceId, chunk.text);

        updateChunk(chunk.id, {
          status: 'ready',
          audioUrl: audioData,
          alignment: alignment
        });
      } catch (err) {
        console.error(`[ChunkPlayback] Prefetch failed for ${index}`, err);
        // Reset to pending so we retry if we actually reach it? Or error?
        // Let's set error so we don't spam.
        updateChunk(chunk.id, { status: 'error', error: String(err) });
      }
    }
  }

  // Effect to handle auto-play when activeAudioUrl changes via ElevenLabs generation
  // We need to be careful not to autoplay when just switching settings, but handleReadAloud sets triggers.
  useEffect(() => {
    if (activeAudioUrl && isAudioPlaying && !isPaused && audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }
  }, [activeAudioUrl, isAudioPlaying, isPaused]);

  // STT Result Listener
  useEffect(() => {
    const handleSttResult = (event: CustomEvent) => {
      const data = event.detail;
      if (data && data.result && Array.isArray(data.result)) {
        const recognizedWords = data.result as RecognizedWord[];
        const matchedIndex = aligner.current.align(allWords, recognizedWords);

        if (matchedIndex !== -1) {
          setCurrentWordIndex(matchedIndex);
        }
      }
    };

    window.addEventListener('stt-result' as any, handleSttResult);
    return () => {
      window.removeEventListener('stt-result' as any, handleSttResult);
    };
  }, [allWords]);


  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const toggleHighContrast = () => {
    setIsHighContrast(!isHighContrast);
  };

  const toggleDyslexiaFont = () => {
    setIsDyslexiaFont(!isDyslexiaFont);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      try {
        const audioBlob = await audioRecorder.current.stop();
        sttEngine.current.stop();
        setIsRecording(false);
        console.log('Recording stopped, blob size:', audioBlob.size);

        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
        }
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        setActiveAudioUrl(url); // Set active immediately for playback
        // Clear alignment when recording (no alignment for user recording yet)
        setCurrentAlignment(null);

      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    } else {
      try {
        handleStop();

        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
          setRecordedAudioUrl(null);
        }
        setActiveAudioUrl(null);

        const stream = await audioRecorder.current.start();
        if (stream) {
          aligner.current.reset(); // Reset alignment state
          await sttEngine.current.start(stream);
          setIsRecording(true);
        }
      } catch (error) {
        console.error('Failed to start recording:', error);
        alert('Could not start recording. Please allow microphone access.');
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();

    setIsAudioPlaying(false);
    setIsTtsPlaying(false);
    setIsPaused(false);
    setIsAudioPlaying(false);
    setIsTtsPlaying(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
    setCurrentChunkIndex(-1);
  };

  const handlePause = () => {
    if (isAudioPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPaused(true);
      }
    } else if (isTtsPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (isAudioPlaying) {
      if (audioRef.current) {
        audioRef.current.play();
        setIsPaused(false);
      }
    } else if (isTtsPlaying) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const handleReadAloud = async () => {
    const tracer = trace.getTracer('readalong-extension');

    if (isRecording) {
      await toggleRecording();
      return;
    }

    // 1. Check for Configured Cloned Voice
    if (voiceSource === 'elevenlabs' && selectedVoiceId && elevenLabsApiKey) {
      console.log('Starting Chunked Playback via ElevenLabs');
      // Reset
      setIsAudioPlaying(true); // "Intent" to play
      setCurrentChunkIndex(0);
      // Wait for state update? No, playChunk uses ref eventually, but let's pass 0 directly.
      playChunk(0);
      return;
    }

    // 2. Play Recorded Audio
    if (recordedAudioUrl && voiceSource === 'system') {
      // Ensure activeAudio is set
      setActiveAudioUrl(recordedAudioUrl);
      setIsAudioPlaying(true);
      setIsPaused(false);
      setCurrentAlignment(null);
      // Playback handled by useEffect
      return;
    }

    // 3. FALLBACK: System TTS
    console.log('[DEBUG] Starting TTS fallback. Voice Source:', voiceSource);
    // Make sure we clear active audio url so we don't double play or show audio controls incorrectly if we wanted to hide them?
    // Actually we hide audio element if activeAudioUrl is null?
    // No, we want to clear it if we are switching to TTS.
    setActiveAudioUrl(null);

    const sentences = alignmentMap?.sentences || [];

    if (sentences.length === 0) {
      console.warn('[DEBUG] No sentences to speak');
      return;
    }

    // Ensure clean state
    window.speechSynthesis.cancel();

    // Prepare utterances
    const newUtterances: SpeechSynthesisUtterance[] = [];
    let globalWordOffset = 0;

    // Prefer selected voice, then local English, then Google US
    const preferredVoice = voices.find(v => v.voiceURI === systemVoiceURI) ||
      voices.find(v => v.localService && v.lang.startsWith('en')) ||
      voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.lang.startsWith('en'));

    sentences.forEach((sentence, sIndex) => {
      if (sentence.words.length === 0) return;

      const { text, map } = buildTextAndMap(sentence.words);
      const utterance = new SpeechSynthesisUtterance(text);

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      const currentSentenceOffset = globalWordOffset;
      const currentParams = { map, offset: currentSentenceOffset };

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const charIndex = event.charIndex;
          // IMPORTANT: charIndex is relative to the UTTERANCE text, not the full document

          // Use the map we built for this sentence
          const localWordIndex = currentParams.map[charIndex];

          if (localWordIndex !== undefined) {
            const absIndex = currentParams.offset + localWordIndex;
            // Ensure we don't jump backwards or to invalid indices
            if (absIndex >= 0 && absIndex < allWords.length) {
              setCurrentWordIndex(absIndex);
            }
          }
        }
      };

      if (sIndex === 0) {
        utterance.onstart = () => {
          console.log('[DEBUG] TTS Started');
          setIsTtsPlaying(true);
          setIsPaused(false);
          setCurrentWordIndex(0);
        };
      }

      if (sIndex === sentences.length - 1) {
        utterance.onend = () => {
          console.log('[DEBUG] TTS Ended');
          setIsTtsPlaying(false);
          setIsPaused(false);
          setCurrentWordIndex(-1);
        };
        utterance.onerror = (e) => {
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.error('[DEBUG] TTS Error:', e.error);
          }
          setIsTtsPlaying(false);
        };
      }

      newUtterances.push(utterance);
      globalWordOffset += sentence.words.length;
    });

    utterancesRef.current = newUtterances;

    if (newUtterances.length > 0) {
      newUtterances.forEach(u => window.speechSynthesis.speak(u));
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      setIsTtsPlaying(true);
    }
  };

  const showPlaybackControls = isTtsPlaying || isAudioPlaying;

  return (
    <div className={`readalong-overlay ${isHighContrast ? 'high-contrast' : ''} ${isDyslexiaFont ? 'dyslexia-font' : ''}`}>
      <div className="readalong-container">
        <div className="readalong-header">
          <h2>
            ReadAlong
            {!isOnline && <span style={{ fontSize: '0.6em', marginLeft: '10px', background: '#666', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>OFFLINE</span>}
          </h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
            {allWords.length > 0 && !showPlaybackControls && (
              <button
                className="readalong-control-btn"
                onClick={handleReadAloud}
                title="Read Aloud"
              >
                Read Aloud
              </button>
            )}

            {showPlaybackControls && (
              <>
                {isGenerating && <span style={{ fontSize: '12px', marginRight: '5px' }}>Generating...</span>}
                {!isPaused ? (
                  <button className="readalong-control-btn" onClick={handlePause} title="Pause">
                    Pause
                  </button>
                ) : (
                  <button className="readalong-control-btn" onClick={handleResume} title="Resume">
                    Resume
                  </button>
                )}
                <button className="readalong-control-btn active" onClick={handleStop} title="Stop">
                  Stop
                </button>
              </>
            )}

            <button onClick={toggleRecording} className={`readalong-control-btn ${isRecording ? 'recording' : ''}`}>
              {isRecording ? 'Stop' : 'Record'}
            </button>

            {/* Settings Toggle */}
            <button onClick={toggleSettings} className="readalong-control-btn" title="Settings">
              ⚙️
            </button>

            {/* Settings Menu Dropdown */}
            {isSettingsOpen && (
              <div className="readalong-settings-menu" style={{
                position: 'absolute',
                top: '100%',
                right: '40px',
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '10px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '200px'
              }}>
                <button onClick={toggleDyslexiaFont} className="readalong-control-btn" style={{ width: '100%', textAlign: 'left' }}>
                  {isDyslexiaFont ? '✓ Dyslexia Font' : 'Dyslexia Font'}
                </button>
                <button onClick={toggleHighContrast} className="readalong-control-btn" style={{ width: '100%', textAlign: 'left' }}>
                  {isHighContrast ? '✓ High Contrast' : 'High Contrast'}
                </button>

                <hr style={{ width: '100%', margin: '5px 0', border: '0', borderTop: '1px solid #eee' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Voice Source</label>
                  <select
                    value={voiceSource}
                    onChange={(e) => setVoiceSource(e.target.value as 'system' | 'elevenlabs')}
                    style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="system">System Voices</option>
                    <option value="elevenlabs">ElevenLabs</option>
                  </select>
                </div>

                {voiceSource === 'system' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>System Voice</label>
                    <select
                      value={systemVoiceURI}
                      onChange={(e) => setSystemVoiceURI(e.target.value)}
                      style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', maxWidth: '200px' }}
                    >
                      <option value="">-- Auto-Detect --</option>
                      {voices.map(v => (
                        <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                      ))}
                    </select>
                  </div>
                )}

                {voiceSource === 'elevenlabs' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>ElevenLabs API Key</label>
                      <input
                        type="password"
                        value={elevenLabsApiKey}
                        onChange={(e) => setElevenLabsApiKey(e.target.value)}
                        placeholder="sk-..."
                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>

                    {elevenLabsApiKey && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Cloned Voice</label>
                        {isLoadingVoices ? <span style={{ fontSize: '10px' }}>Loading...</span> : (
                          <>
                            {voiceFetchError && (
                              <div style={{ color: 'red', fontSize: '10px', marginBottom: '5px' }}>
                                Error: {voiceFetchError}
                              </div>
                            )}
                            <select
                              value={selectedVoiceId}
                              onChange={(e) => setSelectedVoiceId(e.target.value)}
                              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', maxWidth: '200px' }}
                            >
                              <option value="">-- Select Voice --</option>
                              {clonedVoices.map(v => (
                                <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button onClick={onClose} className="readalong-close-btn">&times;</button>
            {activeAudioUrl && (
              <audio
                ref={audioRef}
                src={activeAudioUrl}
                style={{ display: 'none' }} // Hidden audio for logic control, or we could keep controls if we want default native UI
                onPlay={() => {
                  setIsAudioPlaying(true);
                  setIsPaused(false);

                  // COST OPTIMIZATION: Just-in-Time Prefetch
                  // When chunk N starts playing, ensure N+1 is fetching.
                  if (currentChunkIndex !== -1) {
                    prefetchChunk(currentChunkIndex + 1);
                  }
                }}
                onPause={() => {
                  setIsPaused(true);
                }}
                onTimeUpdate={(e) => {
                  const currentTime = e.currentTarget.currentTime;

                  if (currentAlignment && currentAlignment.characters && currentAlignment.character_start_times_seconds) {
                    // ELEVENLABS SYNC (Chunk-Relative)

                    const charTimes = currentAlignment.character_start_times_seconds;
                    let charIdx = -1;
                    for (let i = 0; i < charTimes.length; i++) {
                      if (charTimes[i] <= currentTime) {
                        charIdx = i;
                      } else {
                        break;
                      }
                    }

                    if (charIdx !== -1 && currentChunkIndex !== -1 && audioChunksRef.current[currentChunkIndex]) {
                      const chunk = audioChunksRef.current[currentChunkIndex];
                      // charIdx is index in chunk text.

                      // We need to map this to the specific word in the chunk.
                      // Iterate words in this chunk to find matched char count.
                      // Start from chunk.startWordIndex.

                      const chunkWords = chunk.sentences.flatMap(s => s.words);

                      let charCounter = 0;
                      let foundLocalIndex = -1;

                      for (let i = 0; i < chunkWords.length; i++) {
                        const wordLen = chunkWords[i].text.length;
                        // Add 1 for space assumption
                        if (charCounter + wordLen > charIdx) {
                          foundLocalIndex = i;
                          break;
                        }
                        charCounter += wordLen + 1;
                      }

                      if (foundLocalIndex !== -1) {
                        const globalIndex = chunk.startWordIndex + foundLocalIndex;
                        if (globalIndex !== currentWordIndex) {
                          setCurrentWordIndex(globalIndex);
                        }
                      }
                    }

                  } else {
                    // FALLBACK / RECORDED AUDIO (Time based on recorded timestamps if available)
                    const index = allWords.findIndex(w =>
                      w.start !== undefined &&
                      w.end !== undefined &&
                      currentTime >= w.start &&
                      currentTime <= w.end
                    );
                    if (index !== currentWordIndex) {
                      setCurrentWordIndex(index);
                    }
                  }
                }}
                onEnded={() => {
                  // Play next chunk if available
                  if (currentChunkIndex !== -1 && currentChunkIndex < audioChunks.length - 1) {
                    console.log('[ChunkPlayback] Chunk ended, moving to next');
                    playChunk(currentChunkIndex + 1);
                  } else {
                    handleStop();
                  }
                }}
              />
            )}
          </div>
        </div>
        <div className="readalong-content">
          {alignmentMap ? (
            alignmentMap.sentences.map((sentence, sIdx) => (
              <p key={sIdx}>
                {sentence.words.map((word, wIdx) => {
                  // Check if this word is the currently spoken one
                  const isActive = currentWordIndex >= 0 && allWords[currentWordIndex] === word;

                  return (
                    <span
                      key={wIdx}
                      className={`readalong-word ${isActive ? 'active' : ''}`}
                    >
                      {word.text}{' '}
                    </span>
                  );
                })}
              </p>
            ))
          ) : (
            <div dangerouslySetInnerHTML={{ __html: text || '' }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ReadingPane;
