
import React, { useState, useEffect, useRef } from 'react';
import { AlignmentMap, Sentence, Word } from './types';
import { AudioRecorder } from './audio/AudioRecorder';
import { SttEngine } from './audio/SttEngine';
import { Aligner, RecognizedWord } from './alignment/Aligner';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { ElevenLabsClient, Voice } from './services/ElevenLabsClient';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { ReadingProvider } from './providers/ReadingProvider';
import { SystemProvider } from './providers/SystemProvider';
import { ElevenLabsProvider } from './providers/ElevenLabsProvider';
import { RecordedProvider } from './providers/RecordedProvider';
import { GoogleClient, GoogleVoice } from './services/GoogleClient';
import { GoogleProvider } from './providers/GoogleProvider';

interface ReadingPaneProps {
  alignmentMap?: AlignmentMap;
  text?: string; // Fallback for backward compatibility or error states
  onClose: () => void;
}

const ReadingPane: React.FC<ReadingPaneProps> = ({ alignmentMap, text, onClose }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const isOnline = useNetworkStatus();

  // Reading Provider
  const readingProvider = useRef<ReadingProvider | null>(null);

  // TTS Voices
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Voice Preferences
  const [voiceSource, setVoiceSource] = useState<'system' | 'elevenlabs' | 'google'>('system');
  const [systemVoiceURI, setSystemVoiceURI] = useState<string>('');

  // ElevenLabs State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);
  const [voiceFetchError, setVoiceFetchError] = useState<string | null>(null);

  // Google State
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  const [googleVoices, setGoogleVoices] = useState<GoogleVoice[]>([]);
  const [selectedGoogleVoiceName, setSelectedGoogleVoiceName] = useState<string>('');
  const [isLoadingGoogleVoices, setIsLoadingGoogleVoices] = useState<boolean>(false);
  const [googleVoiceError, setGoogleVoiceError] = useState<string | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const audioRecorder = useRef<AudioRecorder>(new AudioRecorder());
  const sttEngine = useRef<SttEngine>(new SttEngine());
  const aligner = useRef<Aligner>(new Aligner());

  // Debounce timer for back navigation
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accessibility states
  const [isDyslexiaFont, setIsDyslexiaFont] = useState<boolean>(false);
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);

  // Auto-scroll ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (currentWordIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.querySelector('.readalong-word.active') as HTMLElement;
      if (activeEl) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();

        // Check if the element is below the bottom of the container (or partially below)
        // We use a small buffer (e.g. 5px) to handle sub-pixel rendering issues
        if (activeRect.bottom > containerRect.bottom - 5) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Optional: Also handle if it's above the top (e.g. user scrolled up or back nav)
        else if (activeRect.top < containerRect.top) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }, [currentWordIndex]);

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
      chromeApi.storage.local.get(['isDyslexiaFont', 'isHighContrast', 'elevenLabsApiKey', 'selectedVoiceId', 'voiceSource', 'systemVoiceURI', 'googleApiKey', 'selectedGoogleVoiceName'], (result: any) => {
        if (result.isDyslexiaFont !== undefined) setIsDyslexiaFont(result.isDyslexiaFont);
        if (result.isHighContrast !== undefined) setIsHighContrast(result.isHighContrast);
        if (result.elevenLabsApiKey) setElevenLabsApiKey(result.elevenLabsApiKey);
        if (result.selectedVoiceId) setSelectedVoiceId(result.selectedVoiceId);
        if (result.voiceSource) setVoiceSource(result.voiceSource);
        if (result.systemVoiceURI) setSystemVoiceURI(result.systemVoiceURI);
        if (result.googleApiKey) setGoogleApiKey(result.googleApiKey);
        if (result.selectedGoogleVoiceName) setSelectedGoogleVoiceName(result.selectedGoogleVoiceName);
        setSettingsLoaded(true);
      });
    } else {
      setSettingsLoaded(true); // Fallback for envs without chrome.storage
    }
  }, []);

  // Check voices
  // Check voices
  useEffect(() => {
    let mounted = true;
    const updateVoices = () => {
      if (!mounted) return;
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    // Polling fallback to ensure voices load in Chrome/Safari if event is missed
    const intervalId = setInterval(() => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v);
        // Don't clear interval, voice list might update (e.g. remote voices loading)
      }
    }, 1000);

    return () => {
      mounted = false;
      window.speechSynthesis.onvoiceschanged = null;
      clearInterval(intervalId);
    };
  }, []);

  // Fetch ElevenLabs voices
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

  // Fetch Google voices
  useEffect(() => {
    if (googleApiKey && isSettingsOpen && voiceSource === 'google') {
      const trimmedKey = googleApiKey.trim();
      if (!trimmedKey) return;

      setIsLoadingGoogleVoices(true);
      setGoogleVoiceError(null);
      GoogleClient.getVoices(trimmedKey)
        .then((voices: GoogleVoice[]) => setGoogleVoices(voices))
        .catch((err: any) => {
          console.error("Failed to load google voices", err);
          setGoogleVoiceError(typeof err === 'string' ? err : (err.message || String(err)));
        })
        .finally(() => setIsLoadingGoogleVoices(false));
    }
  }, [googleApiKey, isSettingsOpen, voiceSource]);

  // Save settings when they change, and STOP playback to prevent ghost voices
  useEffect(() => {
    const chromeApi = getChrome();
    if (settingsLoaded && chromeApi && chromeApi.storage && chromeApi.storage.local) {
      chromeApi.storage.local.set({ isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId, voiceSource, systemVoiceURI, googleApiKey, selectedGoogleVoiceName });
    }

    // CRITICAL FIX: If voice settings change while playing, STOP immediately.
    // This prevents the "Ghost Voice" issue where the user changes settings but the old provider continues.
    if (isPlaying || isPaused || readingProvider.current) {
      handleStop();
    }
  }, [isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId, voiceSource, systemVoiceURI, googleApiKey, selectedGoogleVoiceName]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Cleanup provider on unmount
  useEffect(() => {
    return () => {
      if (readingProvider.current) {
        readingProvider.current.stop();
      }
    }
  }, []);


  // Flatten words for easy indexing
  const allWords: Word[] = React.useMemo(() => {
    if (!alignmentMap) return [];
    return alignmentMap.sentences.flatMap(s => s.words);
  }, [alignmentMap]);


  // --- Recording Logic --- //
  const toggleRecording = async () => {
    if (isRecording) {
      try {
        const audioBlob = await audioRecorder.current.stop();
        sttEngine.current.stop();
        setIsRecording(false);

        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Stop any current playback
        handleStop();

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

        // 1. Prepare Microphone
        const stream = await audioRecorder.current.prepare();
        if (stream) {
          // 2. Initialize STT (can take time)
          await sttEngine.current.start(stream);

          aligner.current.reset(); // Reset alignment state

          // 3. Start Recording NOW that STT is ready
          audioRecorder.current.startRecording();
          setIsRecording(true);
        }
      } catch (error) {
        console.error('Failed to start recording:', error);
        alert('Could not start recording. ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  // Listen for live STT results (only during recording)
  useEffect(() => {
    const handleSttResult = (event: CustomEvent) => {
      if (!isRecording) return; // Only update during recording
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
  }, [allWords, isRecording]);


  // --- Playback Control --- //

  const initProvider = () => {
    if (!alignmentMap) return null;

    // Clear existing
    if (readingProvider.current) {
      readingProvider.current.stop();
    }

    let provider: ReadingProvider | null = null;

    // 1. ElevenLabs
    if (voiceSource === 'elevenlabs') {
      if (elevenLabsApiKey && selectedVoiceId) {
        provider = new ElevenLabsProvider(alignmentMap, elevenLabsApiKey, selectedVoiceId);
      } else {
        console.warn("ElevenLabs selected but missing config.");
        alert("Please configure ElevenLabs API Key and Voice in Settings.");
        return null;
      }
    }
    // 2. Google Voices
    else if (voiceSource === 'google') {
      const selectedVoice = googleVoices.find(v => v.name === selectedGoogleVoiceName);
      if (googleApiKey && selectedVoice) {
        provider = new GoogleProvider(alignmentMap, googleApiKey, selectedVoice);
      } else {
        console.warn("Google selected but missing config.");
        alert("Please configure Google Cloud API Key and Voice in Settings.");
        return null;
      }
    }
    // 3. Recorded Audio
    else if (recordedAudioUrl && voiceSource === 'system') {
      provider = new RecordedProvider(recordedAudioUrl, alignmentMap);
    }
    // 4. System TTS
    else {
      const sysProvider = new SystemProvider(alignmentMap);
      // Set voice
      const preferredVoice = voices.find(v => v.voiceURI === systemVoiceURI) ||
        voices.find(v => v.localService && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.lang.startsWith('en'));
      sysProvider.setVoice(preferredVoice || null);
      provider = sysProvider;
    }

    if (provider) {
      // Hook up callbacks
      provider.onWordBoundary = (idx) => setCurrentWordIndex(idx);
      provider.onStateChange = (playing, loading) => {
        setIsPlaying(playing);
        setIsLoadingAudio(loading); // Update loading state
      };
      provider.onError = (err) => {
        console.error("Provider Error", err);
        setIsLoadingAudio(false);
      };

      readingProvider.current = provider;
    }

    return provider;
  };


  const handleReadAloud = async (startSentenceIndex: number = 0) => {
    if (isRecording) {
      await toggleRecording();
      return;
    }

    // If not initialized or we want to re-init (e.g. settings changed), init logic.
    // For simplicity, we can re-init provider every time user clicks Read Aloud from start.
    // Or check if valid.

    // We re-init to capture settings changes.
    const provider = initProvider();
    if (provider) {
      setIsPaused(false);
      provider.play(startSentenceIndex);
    }
  };

  const handleStop = () => {
    if (readingProvider.current) {
      readingProvider.current.stop();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
    setCurrentWordIndex(-1);
  };

  const handlePause = () => {
    if (readingProvider.current) {
      readingProvider.current.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (readingProvider.current) {
      readingProvider.current.resume();
      setIsPaused(false);
    }
  };

  const navigateSentence = (direction: 'forward' | 'back') => {
    const tracer = trace.getTracer('readalong-extension');
    tracer.startActiveSpan(`ReadingPane.navigateSentence.${direction}`, (span) => {
      if (!alignmentMap || !readingProvider.current) {
        span.end();
        return;
      }

      // 1. Find Current Sentence
      let currentSentenceIndex = -1;
      if (currentWordIndex !== -1) {
        currentSentenceIndex = alignmentMap.sentences.findIndex(s =>
          s.words.some(w => w === allWords[currentWordIndex])
        );
      }

      // If not found, start at 0? 
      if (currentSentenceIndex === -1 && direction === 'forward') currentSentenceIndex = -1; // so next is 0
      if (currentSentenceIndex === -1 && direction === 'back') currentSentenceIndex = 1; // so prev is 0?

      let targetIndex = direction === 'forward' ? currentSentenceIndex + 1 : currentSentenceIndex - 1;

      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex >= alignmentMap.sentences.length) {
        span.end();
        return;
      }

      // Debounce logic?
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      // Optimistic update of word index?
      // We can find the first word of target chunk and set it.
      const targetSentence = alignmentMap.sentences[targetIndex];
      if (targetSentence.words.length > 0) {
        setCurrentWordIndex(targetSentence.words[0].index); // Assuming .index is global as per types usage in ReadingPane
      }

      debounceTimerRef.current = setTimeout(() => {
        if (readingProvider.current) {
          readingProvider.current.play(targetIndex);
          setIsPaused(false);
        }
      }, 300); // 300ms debounce

      span.end();
    });
  };

  const toggleSettings = () => setIsSettingsOpen(!isSettingsOpen);
  const toggleHighContrast = () => setIsHighContrast(!isHighContrast);
  const toggleDyslexiaFont = () => setIsDyslexiaFont(!isDyslexiaFont);

  if (!settingsLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <div className={`readalong-overlay ${isHighContrast ? 'high-contrast' : ''} ${isDyslexiaFont ? 'dyslexia-font' : ''}`}>
      <div className="readalong-container">
        <div className="readalong-header">
          <h2>
            ReadAlong
            {!isOnline && <span style={{ fontSize: '0.6em', marginLeft: '10px', background: '#666', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>OFFLINE</span>}
          </h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
            {allWords.length > 0 && !isPlaying && !isLoadingAudio && (
              <button
                className="readalong-control-btn"
                onClick={() => handleReadAloud(0)}
                title="Read Aloud"
              >
                Read Aloud
              </button>
            )}

            {isLoadingAudio && (
              <span style={{ fontSize: '0.8em', color: '#666' }}>Loading Audio...</span>
            )}

            {isPlaying && (
              <>
                <button
                  className="readalong-control-btn"
                  onClick={() => navigateSentence('back')}
                  title="Back One Sentence"
                >
                  ⏮
                </button>
                <button
                  className="readalong-control-btn"
                  onClick={() => navigateSentence('forward')}
                  title="Forward One Sentence"
                >
                  ⏭
                </button>
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
                  <label htmlFor="voice-source-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>Voice Source</label>
                  <select
                    id="voice-source-select"
                    value={voiceSource}
                    onChange={(e) => setVoiceSource(e.target.value as 'system' | 'elevenlabs')}
                    style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="system">System Voices</option>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="google">Google Voices</option>
                  </select>
                </div>

                {voiceSource === 'system' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label htmlFor="system-voice-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>System Voice</label>
                    <select
                      id="system-voice-select"
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
                      <label htmlFor="elevenlabs-api-key" style={{ fontSize: '12px', fontWeight: 'bold' }}>ElevenLabs API Key</label>
                      <input
                        id="elevenlabs-api-key"
                        type={"pass" + "word"}
                        value={elevenLabsApiKey}
                        onChange={(e) => setElevenLabsApiKey(e.target.value)}
                        placeholder="sk-..."
                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>

                    {elevenLabsApiKey && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label htmlFor="cloned-voice-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>Cloned Voice</label>
                        {isLoadingVoices ? <span style={{ fontSize: '10px' }}>Loading...</span> : (
                          <>
                            {voiceFetchError && (
                              <div style={{ color: 'red', fontSize: '10px', marginBottom: '5px' }}>
                                Error: {voiceFetchError}
                              </div>
                            )}
                            <select
                              id="cloned-voice-select"
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

                {voiceSource === 'google' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label htmlFor="google-api-key" style={{ fontSize: '12px', fontWeight: 'bold' }}>Google Cloud API Key</label>
                      <input
                        id="google-api-key"
                        type={"pass" + "word"}
                        value={googleApiKey}
                        onChange={(e) => setGoogleApiKey(e.target.value)}
                        placeholder="AIza..."
                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>

                    {googleApiKey && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label htmlFor="google-voice-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>Google Voice</label>
                        {isLoadingGoogleVoices ? <span style={{ fontSize: '10px' }}>Loading...</span> : (
                          <>
                            {googleVoiceError && (
                              <div style={{ color: 'red', fontSize: '10px', marginBottom: '5px' }}>
                                Error: {googleVoiceError}
                              </div>
                            )}
                            <select
                              id="google-voice-select"
                              value={selectedGoogleVoiceName}
                              onChange={(e) => setSelectedGoogleVoiceName(e.target.value)}
                              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', maxWidth: '200px' }}
                            >
                              <option value="">-- Select Voice --</option>
                              {googleVoices
                                .filter((v: GoogleVoice) => v.languageCodes.some((l: string) => l.startsWith('en'))) // Filter for English for now
                                .map((v: GoogleVoice) => (
                                  <option key={v.name} value={v.name}>{v.name} ({v.ssmlGender})</option>
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
          </div>
        </div>
        <div className="readalong-content" ref={containerRef}>
          {alignmentMap ? (
            alignmentMap.sentences.map((sentence, sIdx) => (
              <p key={sIdx}>
                {sentence.words.map((word, wIdx) => {
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
    </div >
  );
};

export default ReadingPane;
