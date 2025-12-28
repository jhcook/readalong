import React, { useState, useEffect, useRef } from 'react';
import { AlignmentMap, Sentence, Word } from './types';
import { AudioRecorder } from './audio/AudioRecorder';
import { SttEngine } from './audio/SttEngine';
import { Aligner, RecognizedWord } from './alignment/Aligner';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { ElevenLabsClient, Voice } from './services/ElevenLabsClient';
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

  // ElevenLabs State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Predictive Highlighting Ref
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      chromeApi.storage.local.get(['isDyslexiaFont', 'isHighContrast', 'elevenLabsApiKey', 'selectedVoiceId'], (result: any) => {
        if (result.isDyslexiaFont !== undefined) setIsDyslexiaFont(result.isDyslexiaFont);
        if (result.isHighContrast !== undefined) setIsHighContrast(result.isHighContrast);
        if (result.elevenLabsApiKey) setElevenLabsApiKey(result.elevenLabsApiKey);
        if (result.selectedVoiceId) setSelectedVoiceId(result.selectedVoiceId);
      });
    }
  }, []);

  // Fetch voices when API key is set
  useEffect(() => {
    if (elevenLabsApiKey && isSettingsOpen) {
      setIsLoadingVoices(true);
      ElevenLabsClient.getVoices(elevenLabsApiKey)
        .then(voices => setClonedVoices(voices))
        .catch(err => console.error("Failed to load voices", err))
        .finally(() => setIsLoadingVoices(false));
    }
  }, [elevenLabsApiKey, isSettingsOpen]);

  // Save settings when they change
  useEffect(() => {
    const chromeApi = getChrome();
    if (chromeApi && chromeApi.storage && chromeApi.storage.local) { // Added check back for safety
      chromeApi.storage.local.set({ isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId });
    }
  }, [isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      setIsTtsPlaying(false);
      setIsAudioPlaying(false);
    };
  }, []);

  // Flatten words for easy indexing
  const allWords: Word[] = React.useMemo(() => {
    if (!alignmentMap) return [];
    return alignmentMap.sentences.flatMap(s => s.words);
  }, [alignmentMap]);

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
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

    setIsAudioPlaying(false);
    setIsTtsPlaying(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
  };

  const handlePause = () => {
    if (isAudioPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPaused(true);
      }
    } else if (isTtsPlaying) {
      window.speechSynthesis.pause();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
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
      // Restart predictive highlighting from current word
      if (currentWordIndex !== -1) {
        scheduleNextHighlight(currentWordIndex);
      }
    }
  };

  // Estimate duration: 50ms per character + 200ms base padding?
  // Adjustable logic.
  const estimateWordDuration = (word: Word | undefined): number => {
    if (!word) return 300;
    const base = 250;
    const perChar = 30; // 5 chars = 150ms. Total ~400ms.
    return base + (word.text.length * perChar);
  };

  const scheduleNextHighlight = (index: number) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (index >= allWords.length) return;

    const duration = estimateWordDuration(allWords[index]);

    highlightTimerRef.current = setTimeout(() => {
      const nextIndex = index + 1;
      if (nextIndex < allWords.length) {
        setCurrentWordIndex(nextIndex);
        scheduleNextHighlight(nextIndex);
      } else {
        // End of fallback
        setCurrentWordIndex(-1);
      }
    }, duration);
  };

  const handleReadAloud = async () => {
    const tracer = trace.getTracer('readalong-extension');

    if (isRecording) {
      await toggleRecording();
      return;
    }

    // 1. Check for Configured Cloned Voice
    if (selectedVoiceId && elevenLabsApiKey) {
      await tracer.startActiveSpan('ReadingPane.handleReadAloud.elevenLabs', async (span) => {
        try {
          console.log('Generating/Playing via ElevenLabs');
          const textToSpeak = alignmentMap?.sentences.map(s => s.words.map(w => w.text).join(' ')).join(' ') || text || '';
          if (!textToSpeak) return;

          setIsGenerating(true);
          const audioDataUrl = await ElevenLabsClient.generateAudio(elevenLabsApiKey, selectedVoiceId, textToSpeak);

          if (audioRef.current) {
            audioRef.current.src = audioDataUrl;
            audioRef.current.play();
            setIsAudioPlaying(true);
            setIsPaused(false);
          }
          span.end();
        } catch (err) {
          console.error('ElevenLabs generation failed:', err);
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          alert('Failed to generate audio. falling back to system TTS.');
          span.end();
        } finally {
          setIsGenerating(false);
        }
      });
      return;
    }

    // 2. Play Recorded Audio
    if (recordedAudioUrl) {
      if (audioRef.current) {
        console.log('Playing recorded audio');
        setIsAudioPlaying(true);
        setIsPaused(false);
        audioRef.current.play().catch(e => console.error("Error playing recording:", e));
      } else {
        console.warn('recordedAudioUrl exists but audioRef invalid');
      }
      return;
    }

    // 3. FALLBACK: System TTS
    console.log('[DEBUG] Starting TTS fallback.');
    const sentences = alignmentMap?.sentences || [];

    if (sentences.length === 0) {
      console.warn('[DEBUG] No sentences to speak');
      return;
    }

    // Ensure clean state
    window.speechSynthesis.cancel();
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

    // Prepare utterances
    const newUtterances: SpeechSynthesisUtterance[] = [];
    let globalWordOffset = 0;

    // Prefer local voices for better reliability
    const preferredVoice = voices.find(v => v.localService && v.lang.startsWith('en')) ||
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
          const localWordIndex = currentParams.map[charIndex];
          if (localWordIndex !== undefined) {
            const absIndex = currentParams.offset + localWordIndex;
            setCurrentWordIndex(absIndex);
            // Sync the fallback timer
            scheduleNextHighlight(absIndex);
          }
        }
      };

      if (sIndex === 0) {
        utterance.onstart = () => {
          console.log('[DEBUG] TTS Started');
          setIsTtsPlaying(true);
          setIsPaused(false);
          // Kick off highlighting at 0 immediately
          setCurrentWordIndex(0);
          scheduleNextHighlight(0);
        };
      }

      if (sIndex === sentences.length - 1) {
        utterance.onend = () => {
          console.log('[DEBUG] TTS Ended');
          setIsTtsPlaying(false);
          setIsPaused(false);
          setCurrentWordIndex(-1);
          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        };
        utterance.onerror = (e) => {
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.error('[DEBUG] TTS Error:', e.error);
          }
          setIsTtsPlaying(false);
          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
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
                minWidth: '150px'
              }}>
                <button onClick={toggleDyslexiaFont} className="readalong-control-btn" style={{ width: '100%', textAlign: 'left' }}>
                  {isDyslexiaFont ? '✓ Dyslexia Font' : 'Dyslexia Font'}
                </button>
                <button onClick={toggleHighContrast} className="readalong-control-btn" style={{ width: '100%', textAlign: 'left' }}>
                  {isHighContrast ? '✓ High Contrast' : 'High Contrast'}
                </button>

                <hr style={{ width: '100%', margin: '5px 0', border: '0', borderTop: '1px solid #eee' }} />

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
                    )}
                  </div>
                )}
              </div>
            )}

            <button onClick={onClose} className="readalong-close-btn">&times;</button>
            {recordedAudioUrl && (
              <audio
                ref={audioRef}
                src={recordedAudioUrl}
                style={{ display: 'none' }} // Hidden audio for logic control, or we could keep controls if we want default native UI
                onPlay={() => { setIsAudioPlaying(true); setIsPaused(false); }}
                onPause={() => {
                  setIsPaused(true);
                }}
                onTimeUpdate={(e) => {
                  const currentTime = e.currentTarget.currentTime;
                  const index = allWords.findIndex(w =>
                    w.start !== undefined &&
                    w.end !== undefined &&
                    currentTime >= w.start &&
                    currentTime <= w.end
                  );
                  if (index !== currentWordIndex) {
                    setCurrentWordIndex(index);
                  }
                }}
                onEnded={() => {
                  handleStop();
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
