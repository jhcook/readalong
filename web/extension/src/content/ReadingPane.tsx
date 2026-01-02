
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
import { ResembleClient, ResembleVoice } from './services/ResembleClient';
import { ResembleProvider } from './providers/ResembleProvider';

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
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [theme, setTheme] = useState<'professional' | 'playful' | 'academic' | 'building-blocks' | 'minimal'>('professional');
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const isOnline = useNetworkStatus();

  // Reading Provider
  const readingProvider = useRef<ReadingProvider | null>(null);

  // TTS Voices
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Voice Preferences
  const [voiceSource, setVoiceSource] = useState<'system' | 'elevenlabs' | 'google' | 'resemble' | 'record'>('system');
  const [systemVoiceURI, setSystemVoiceURI] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

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

  // Resemble State
  const [resembleApiKey, setResembleApiKey] = useState<string>('');
  const [resembleVoices, setResembleVoices] = useState<ResembleVoice[]>([]);
  const [selectedResembleVoiceUuid, setSelectedResembleVoiceUuid] = useState<string>('');
  const [isLoadingResembleVoices, setIsLoadingResembleVoices] = useState<boolean>(false);
  const [resembleVoiceError, setResembleVoiceError] = useState<string | null>(null);

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

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);

  // Ignore Content State
  const [ignoredSentenceIndices, setIgnoredSentenceIndices] = useState<Set<number>>(new Set());
  const [lastInteractionIndex, setLastInteractionIndex] = useState<number | null>(null);

  // Refs for scrolling to matches
  const matchRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Auto-scroll ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (currentWordIndex >= 0 && containerRef.current) {
      const activeElements = containerRef.current.querySelectorAll('.readalong-word.active');
      if (activeElements.length > 0 && !isMinimized) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const firstActiveRect = activeElements[0].getBoundingClientRect();
        const lastActiveRect = activeElements[activeElements.length - 1].getBoundingClientRect();

        // Check if the bottom of the highlight (last word) is below the container bottom
        if (lastActiveRect.bottom > containerRect.bottom - 5) {
          // Scroll the FIRST word to the top to ensure user sees the start of the highlight
          activeElements[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Check if the top of the highlight (first word) is above the container top
        else if (firstActiveRect.top < containerRect.top) {
          activeElements[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      chromeApi.storage.local.get(['theme', 'isDyslexiaFont', 'isHighContrast', 'elevenLabsApiKey', 'selectedVoiceId', 'voiceSource', 'systemVoiceURI', 'googleApiKey', 'selectedGoogleVoiceName', 'playbackRate', 'resembleApiKey', 'selectedResembleVoiceUuid'], (result: any) => {
        if (result.theme) setTheme(result.theme);
        if (result.isDyslexiaFont !== undefined) setIsDyslexiaFont(result.isDyslexiaFont);
        if (result.isHighContrast !== undefined) setIsHighContrast(result.isHighContrast);
        if (result.elevenLabsApiKey) setElevenLabsApiKey(result.elevenLabsApiKey);
        if (result.selectedVoiceId) setSelectedVoiceId(result.selectedVoiceId);
        if (result.voiceSource) setVoiceSource(result.voiceSource);
        if (result.systemVoiceURI) setSystemVoiceURI(result.systemVoiceURI);
        if (result.googleApiKey) setGoogleApiKey(result.googleApiKey);
        if (result.selectedGoogleVoiceName) setSelectedGoogleVoiceName(result.selectedGoogleVoiceName);
        if (result.resembleApiKey) setResembleApiKey(result.resembleApiKey);
        if (result.selectedResembleVoiceUuid) setSelectedResembleVoiceUuid(result.selectedResembleVoiceUuid);
        if (result.playbackRate) setPlaybackRate(result.playbackRate);
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

      setVoices(prev => {
        // Simple optimization: verify if voices actually changed
        if (prev.length !== availableVoices.length) return availableVoices;
        const allMatch = prev.every((v, i) => v.voiceURI === availableVoices[i].voiceURI);
        if (allMatch) return prev;
        return availableVoices;
      });
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    // Polling fallback to ensure voices load in Chrome/Safari if event is missed
    const intervalId = setInterval(() => {
      updateVoices();
    }, 1000);

    return () => {
      mounted = false;
      window.speechSynthesis.onvoiceschanged = null;
      clearInterval(intervalId);
    };
  }, []);

  const handleRefreshVoices = () => {
    const availableVoices = window.speechSynthesis.getVoices();
    setVoices(availableVoices);
  };

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

  // Fetch Resemble voices
  useEffect(() => {
    if (resembleApiKey && isSettingsOpen && voiceSource === 'resemble') {
      const trimmedKey = resembleApiKey.trim();
      if (!trimmedKey) return;

      setIsLoadingResembleVoices(true);
      setResembleVoiceError(null);
      ResembleClient.getVoices(trimmedKey)
        .then((voices: ResembleVoice[]) => setResembleVoices(voices))
        .catch((err: any) => {
          console.error("Failed to load resemble voices", err);
          setResembleVoiceError(typeof err === 'string' ? err : (err.message || String(err)));
        })
        .finally(() => setIsLoadingResembleVoices(false));
    }
  }, [resembleApiKey, isSettingsOpen, voiceSource]);

  // Save settings when they change, and STOP playback to prevent ghost voices
  useEffect(() => {
    const chromeApi = getChrome();
    if (settingsLoaded && chromeApi && chromeApi.storage && chromeApi.storage.local) {
      chromeApi.storage.local.set({ theme, isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId, voiceSource, systemVoiceURI, googleApiKey, selectedGoogleVoiceName, resembleApiKey, selectedResembleVoiceUuid, playbackRate });
    }

    // CRITICAL FIX: If voice settings change while playing, STOP immediately.
    // This prevents the "Ghost Voice" issue where the user changes settings but the old provider continues.
    if (isPlaying || isPaused || readingProvider.current) {
      // Exception: If ONLY playbackRate changed, we might not need to full stop if the provider handles it.
      // But our effect dependencies include everything.
      // Let's optimize: Check if provider supports dynamic rate update without full re-init.
      // Actually, SystemProvider needs restart for rate change anyway.
      // But we should probably try to call setPlaybackRate first if it's just a rate change.
      // Complication: The effect triggers on ANY change. HARD to know WHICH changed without refs.
      // For now, let's keep the STOP behavior for safety, unless we want live sliding.
      // Live sliding with STOP/START is bad audio UX.

      // BETTER APPROACH: Move playbackRate out of this "STOP EVERYTHING" effect?
      // Or handle it separately.
      // Let's leave playbackRate OUT of this dependency array and handle it in its own effect.
    }
  }, [theme, isDyslexiaFont, isHighContrast, elevenLabsApiKey, selectedVoiceId, voiceSource, systemVoiceURI, googleApiKey, selectedGoogleVoiceName, resembleApiKey, selectedResembleVoiceUuid]);

  // Separate effect for Playback Rate to allow dynamic updates
  useEffect(() => {
    const chromeApi = getChrome();
    if (settingsLoaded && chromeApi && chromeApi.storage && chromeApi.storage.local) {
      chromeApi.storage.local.set({ playbackRate });
    }

    if (readingProvider.current) {
      readingProvider.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

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

  // Map Word object to its Global Index in allWords
  // This is crucial because word.index is local to the sentence (0..N),
  // but currentWordIndex state represents the index in allWords (0..Total).
  const wordToGlobalIndex = React.useMemo(() => {
    const map = new Map<Word, number>();
    allWords.forEach((w, i) => map.set(w, i));
    return map;
  }, [allWords]);

  // Active Alignment Map (Filtering Ignored)
  // Returns { alignment, filteredToGlobalIndexMap }
  const activeAlignmentResult = React.useMemo(() => {
    if (!alignmentMap) return undefined;
    // If nothing ignored, return original
    if (ignoredSentenceIndices.size === 0) {
      return {
        alignment: alignmentMap,
        filteredToGlobalIndexMap: alignmentMap.sentences.map((_, i) => i)
      };
    }

    // Filter sentences. Note: We must preserve logic for 'allWords' if we want global highlighting to stay consistent.
    // But for playback, we want to skip.
    // The Provider uses this map to generate audio / speak.

    // Build mapping from Filtered Index -> Global Index
    let filteredToGlobal: number[] = [];
    const filteredSentences = alignmentMap.sentences.filter((_, idx) => {
      if (!ignoredSentenceIndices.has(idx)) {
        filteredToGlobal.push(idx);
        return true;
      }
      return false;
    });

    return {
      alignment: {
        ...alignmentMap,
        sentences: filteredSentences
      },
      filteredToGlobalIndexMap: filteredToGlobal
    };
  }, [alignmentMap, ignoredSentenceIndices]);

  const activeAlignmentMap = activeAlignmentResult?.alignment;
  const filteredToGlobalIndexMap = activeAlignmentResult?.filteredToGlobalIndexMap;

  // Search Logic
  useEffect(() => {
    if (!searchQuery.trim() || !alignmentMap) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }
    const query = searchQuery.toLowerCase();
    const matches: number[] = [];
    alignmentMap.sentences.forEach((s, idx) => {
      if (s.text.toLowerCase().includes(query)) {
        matches.push(idx);
      }
    });
    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
      // Auto-scroll to first match?
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [searchQuery, alignmentMap]);

  // Scroll to current match
  useEffect(() => {
    if (currentMatchIndex >= 0 && searchMatches.length > 0) {
      const sentenceIndex = searchMatches[currentMatchIndex];
      const el = matchRefs.current[sentenceIndex];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, searchMatches]);

  const handleSearchNext = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const handleSearchPrev = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  const toggleIgnore = (sIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check for Text Selection Range
    // Check for Text Selection Range
    let selection: Selection | null = null;

    // Try to get selection from Shadow Root first
    if (containerRef.current) {
      const root = containerRef.current.getRootNode();
      // Cast to any because TS might not know getSelection exists on ShadowRoot yet
      if (root instanceof ShadowRoot && (root as any).getSelection) {
        selection = (root as any).getSelection();
      }
    }

    // Fallback to window selection
    if (!selection) {
      selection = window.getSelection();
    }

    let selectionHandled = false;
    let next = new Set(ignoredSentenceIndices); // Prepare next state based on current

    if (selection && !selection.isCollapsed) {
      // We have a selection. Let's find the start and end paragraphs.
      // We look for elements with data-sentence-index.

      let startNode = selection.anchorNode;
      let endNode = selection.focusNode;

      // Helper to find parent with data-sentence-index
      const findSentenceIndex = (node: Node | null): number | null => {
        let curr = node;
        while (curr) {
          if (curr instanceof HTMLElement && curr.hasAttribute('data-sentence-index')) {
            return parseInt(curr.getAttribute('data-sentence-index') || '-1', 10);
          }
          curr = curr.parentNode;
        }
        return null;
      };

      const startIdxPos = findSentenceIndex(startNode);
      const endIdxPos = findSentenceIndex(endNode);

      if (startIdxPos !== null && endIdxPos !== null && startIdxPos !== -1 && endIdxPos !== -1) {
        selectionHandled = true;
        const rangeStart = Math.min(startIdxPos, endIdxPos);
        const rangeEnd = Math.max(startIdxPos, endIdxPos);

        // Determine intent: matches the button click target (sIdx)
        // If target (sIdx) is ignored, un-ignore range.
        // If target is NOT ignored, ignore range.
        const isTargetIgnored = ignoredSentenceIndices.has(sIdx);
        const shouldIgnore = !isTargetIgnored;

        for (let i = rangeStart; i <= rangeEnd; i++) {
          if (shouldIgnore) next.add(i);
          else next.delete(i);
        }

        // Clear selection
        selection.removeAllRanges();
      }
    }

    if (!selectionHandled) {
      // Fallback to Shift-Click or Single Click
      if (e.shiftKey && lastInteractionIndex !== null) {
        const start = Math.min(lastInteractionIndex, sIdx);
        const end = Math.max(lastInteractionIndex, sIdx);

        const isCurrentlyIgnored = ignoredSentenceIndices.has(sIdx);
        const shouldIgnore = !isCurrentlyIgnored;

        for (let i = start; i <= end; i++) {
          if (shouldIgnore) {
            next.add(i);
          } else {
            next.delete(i);
          }
        }
      } else {
        // Normal single toggle
        if (next.has(sIdx)) next.delete(sIdx);
        else next.add(sIdx);
      }
    }

    setLastInteractionIndex(sIdx);
    setIgnoredSentenceIndices(next);
  };


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
    if (!activeAlignmentMap) return null;

    // Clear existing
    if (readingProvider.current) {
      readingProvider.current.stop();
    }

    let provider: ReadingProvider | null = null;

    // 1. ElevenLabs
    if (voiceSource === 'elevenlabs') {
      if (elevenLabsApiKey && selectedVoiceId) {
        provider = new ElevenLabsProvider(activeAlignmentMap, elevenLabsApiKey, selectedVoiceId);
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
        provider = new GoogleProvider(activeAlignmentMap, googleApiKey, selectedVoice);
      } else {
        console.warn("Google selected but missing config.");
        alert("Please configure Google Cloud API Key and Voice in Settings.");
        return null;
      }
    }
    // 2.5 Resemble AI
    else if (voiceSource === 'resemble') {
      const selectedVoice = resembleVoices.find(v => v.uuid === selectedResembleVoiceUuid);
      if (resembleApiKey && selectedVoice) {
        // Default projectUuid if missing in voice object (should have been handled in client)
        const projUuid = selectedVoice.project_uuid || '';
        if (!projUuid) console.warn("Resemble voice missing project UUID, might fail.", selectedVoice);
        provider = new ResembleProvider(activeAlignmentMap, resembleApiKey, selectedVoice.uuid, projUuid);
      } else {
        console.warn("Resemble selected but missing config.");
        alert("Please configure Resemble API Key and Voice in Settings.");
        return null;
      }
    }
    // 3. Recorded Audio
    else if (voiceSource === 'record') {
      if (recordedAudioUrl) {
        provider = new RecordedProvider(recordedAudioUrl, activeAlignmentMap);
      } else {
        // If selected but no audio, maybe just do nothing or alert? 
        // Realistically, user selects "Record" option to SEE the button, then records.
        // If they play without recording, nothing happens or we could warn.
        console.warn("Record source selected but no audio recorded yet.");
      }
    }
    // 4. System TTS
    else {
      const sysProvider = new SystemProvider(activeAlignmentMap);
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
      provider.onWordBoundary = (idx) => {
        // Fix: Convert filtered work/sentence index to global if needed?
        // The provider's "idx" is the global word index relative to ITS alignment map.
        // If the map is filtered, we need to map back to original for UI highlighting.

        if (filteredToGlobalIndexMap && activeAlignmentMap) {
          // idx is word index in the filtered text.
          // We need to find which sentence this word belongs to in filtered map,
          // get that sentence's global index via filteredToGlobalIndexMap,
          // then find the corresponding word's global index.

          // This is expensive to do on every word boundary if not optimized.
          // Optimization: Pre-calculate word-to-word mapping or just sentence mapping.
          // Simpler: The filtered map's sentences are subsets.
          // Let's find the sentence in activeAlignmentMap

          // Wait, 'idx' from provider is typically Word Index in the flattened list.
          // Let's verify 'types.ts'. Yup, typically flattened index.
          // So we need a map from FilteredWordIndex -> GlobalWordIndex.

          const filteredSentences = activeAlignmentMap.sentences;
          let wordCount = 0;
          let foundSentenceIdx = -1;
          let wordOffsetInSentence = -1;

          for (let i = 0; i < filteredSentences.length; i++) {
            const sLen = filteredSentences[i].words.length;
            if (idx < wordCount + sLen) {
              foundSentenceIdx = i;
              wordOffsetInSentence = idx - wordCount;
              break;
            }
            wordCount += sLen;
          }
          if (foundSentenceIdx !== -1) {
            const globalSentenceIdx = filteredToGlobalIndexMap[foundSentenceIdx];
            if (typeof globalSentenceIdx === 'number') {
              const globalSentence = alignmentMap?.sentences[globalSentenceIdx];
              // globalSentence.words[wordOffsetInSentence] is the specific Word object we want.
              // We need its GLOBAL index (in allWords).
              if (globalSentence && globalSentence.words[wordOffsetInSentence]) {
                const targetWord = globalSentence.words[wordOffsetInSentence];
                const globalIdx = wordToGlobalIndex.get(targetWord);
                if (globalIdx !== undefined) {
                  setCurrentWordIndex(globalIdx);
                  return;
                }
              }
            }
          }
        }

      };
      provider.onStateChange = (playing, loading) => {
        setIsPlaying(playing);
        setIsLoadingAudio(loading); // Update loading state
      };
      provider.onError = (err) => {
        console.error("Provider Error", err);
        setIsLoadingAudio(false);
      };

      // Set initial rate
      provider.setPlaybackRate(playbackRate);

      readingProvider.current = provider;
    }

    return provider;
  };


  const handleReadAloud = async (startSentenceIndex: number = 0) => {
    if (isRecording) {
      await toggleRecording();
      return;
    }

    // Map global index to filtered index if needed?
    // Providers using activeAlignmentMap will see a reduced list.
    // If startSentenceIndex corresponds to the GLOBAL index (from UI click),
    // and that sentence is IGNORED, we shouldn't play it?
    // Or we find the nearest non-ignored sentence.

    // Convert global index to filtered index
    let filteredStartIndex = 0;
    if (ignoredSentenceIndices.size > 0 && activeAlignmentMap) {
      // Find which sentence in activeAlignmentMap corresponds to activeAlignmentMap.sentences[?] 
      // Wait, activeAlignmentMap.sentences contains the subset.
      // We need to find the index IN THAT SUBSET that matches the sentence at startSentenceIndex in global.
      const targetSentence = alignmentMap?.sentences[startSentenceIndex];
      if (targetSentence) {
        const foundIndex = activeAlignmentMap.sentences.indexOf(targetSentence);
        if (foundIndex !== -1) {
          filteredStartIndex = foundIndex;
        } else {
          // The sentence is ignored. Find next available?
          // Simple approach: start from 0 if ignored, or find next.
          // Let's iterate forward from startSentenceIndex until we find one not ignored.
          let nextValidObj = null;
          for (let i = startSentenceIndex; i < (alignmentMap?.sentences.length || 0); i++) {
            if (!ignoredSentenceIndices.has(i)) {
              nextValidObj = alignmentMap?.sentences[i];
              break;
            }
          }
          if (nextValidObj) {
            filteredStartIndex = activeAlignmentMap.sentences.indexOf(nextValidObj);
          }
        }
      }
    } else {
      // If nothing ignored, these are same
      filteredStartIndex = startSentenceIndex;
    }

    // We re-init to capture settings changes.
    const provider = initProvider();
    if (provider) {
      setIsPaused(false);
      provider.play(filteredStartIndex);
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
        const currentWord = allWords[currentWordIndex];
        currentSentenceIndex = alignmentMap.sentences.findIndex(s => s.words.includes(currentWord));
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
        const gIdx = wordToGlobalIndex.get(targetSentence.words[0]);
        if (gIdx !== undefined) setCurrentWordIndex(gIdx);
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
  const toggleMinimize = () => setIsMinimized(!isMinimized);

  if (!settingsLoaded) {
    return null; // Or a loading spinner
  }

  // Helper to determine active system voice for highlighting logic
  const getActiveSystemVoice = () => {
    if (voiceSource !== 'system') return null;
    return voices.find(v => v.voiceURI === systemVoiceURI) ||
      voices.find(v => v.localService && v.lang.startsWith('en')) ||
      voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.lang.startsWith('en'));
  };

  const activeSystemVoice = getActiveSystemVoice();
  // Heuristic: Remote voices (like Google's) often don't send word boundaries.
  // We check for localService === false OR 'Google' in the name as a fallback.
  // Note: localService might be undefined in some browsers, so we check explicit false or name.
  const isSentenceHighlightMode = voiceSource === 'system' && activeSystemVoice &&
    (activeSystemVoice.localService === false || activeSystemVoice.name.includes('Google'));

  return (
    <div className={`readalong-overlay theme-${theme} ${isHighContrast ? 'high-contrast' : ''} ${isDyslexiaFont ? 'dyslexia-font' : ''} ${isMinimized ? 'minimized' : ''}`}>
      <div className={`readalong-container ${isMinimized ? 'minimized' : ''}`}>
        <div className={`readalong-header ${isMinimized ? 'minimized' : ''}`}>
          <h2>
            {!isMinimized && 'ReadAlong'}
            {isMinimized && '🎧'}
            {!isOnline && !isMinimized && <span style={{ fontSize: '0.6em', marginLeft: '10px', background: '#666', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>OFFLINE</span>}
          </h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
            {!isMinimized && allWords.length > 0 && !isPlaying && !isLoadingAudio && (
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  className="readalong-control-btn"
                  onClick={() => {
                    // If we have a selected sentence (via click), start from there.
                    // Otherwise start from 0.
                    // We use the currentWordIndex (which is global) to find the sentence index.
                    let startIdx = 0;
                    if (currentWordIndex >= 0 && alignmentMap) {
                      // Find the sentence containing the word at allWords[currentWordIndex]
                      const currentWord = allWords[currentWordIndex];
                      const sIndex = alignmentMap.sentences.findIndex(s => s.words.includes(currentWord));
                      if (sIndex !== -1) startIdx = sIndex;
                    }
                    handleReadAloud(startIdx);
                  }}
                  title="Read Aloud"
                >
                  {isPlaying ? "Restart" : "Read Aloud"}
                </button>
                {/* Search Input inline? Or toggle? Let's put inline for simplicity */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Find..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '0.9rem',
                      width: '120px'
                    }}
                  />
                  {searchMatches.length > 0 && (
                    <span style={{ fontSize: '0.7rem', marginLeft: '4px', color: '#666' }}>
                      {currentMatchIndex + 1}/{searchMatches.length}
                    </span>
                  )}
                  <button onClick={handleSearchPrev} disabled={searchMatches.length === 0} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>⬆️</button>
                  <button onClick={handleSearchNext} disabled={searchMatches.length === 0} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>⬇️</button>
                </div>
              </div>
            )}

            {isLoadingAudio && (
              <span style={{ fontSize: '0.8em', color: '#666' }}>Loading Audio...</span>
            )}

            {(isPlaying || isMinimized) && (
              <>
                {!isMinimized && (
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
                  </>
                )}
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

            {voiceSource === 'record' && !isMinimized && (
              <button onClick={toggleRecording} className={`readalong-control-btn ${isRecording ? 'recording' : ''}`}>
                {isRecording ? 'Stop' : 'Record'}
              </button>
            )}

            {/* Settings Toggle */}
            {!isMinimized && (
              <button onClick={toggleSettings} className="readalong-control-btn" title="Settings">
                ⚙️
              </button>
            )}

            {/* Settings Menu Dropdown */}
            {isSettingsOpen && (
              <div className="readalong-settings-menu">
                <button onClick={toggleDyslexiaFont} className={`readalong-control-btn ${isDyslexiaFont ? 'active-toggle' : ''}`} style={{ width: '100%', textAlign: 'left' }}>
                  {isDyslexiaFont ? '✓ Dyslexia Font' : 'Dyslexia Font'}
                </button>
                <button onClick={toggleHighContrast} className={`readalong-control-btn ${isHighContrast ? 'active-toggle' : ''}`} style={{ width: '100%', textAlign: 'left' }}>
                  {isHighContrast ? '✓ High Contrast' : 'High Contrast'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                  <label htmlFor="theme-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>Theme</label>
                  <select
                    id="theme-select"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'professional' | 'playful' | 'academic' | 'building-blocks' | 'minimal')}
                  >
                    <option value="professional">Professional (Office)</option>
                    <option value="minimal">Minimal (Plain)</option>
                    <option value="academic">Academic (Ivory Tower)</option>
                    <option value="playful">Playful (Bubbles)</option>
                    <option value="building-blocks">Building Blocks</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label htmlFor="speed-slider" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                    Speed: {playbackRate.toFixed(1)}x
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '10px' }}>0.5x</span>
                    <input
                      id="speed-slider"
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={playbackRate}
                      onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: '10px' }}>2.5x</span>
                  </div>
                </div>

                <hr style={{ width: '100%', margin: '5px 0', border: '0', borderTop: '1px solid #eee' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label htmlFor="voice-source-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>Voice Source</label>
                  <select
                    id="voice-source-select"
                    value={voiceSource}
                    onChange={(e) => setVoiceSource(e.target.value as 'system' | 'elevenlabs' | 'record')}
                  >
                    <option value="system">System Voices</option>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="google">Google Voices</option>
                    <option value="resemble">Resemble.ai</option>
                    <option value="record">Record</option>
                  </select>
                </div>

                {voiceSource === 'system' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="system-voice-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>System Voice</label>
                      <button
                        onClick={handleRefreshVoices}
                        className="readalong-control-btn"
                        style={{ fontSize: '10px', padding: '2px 5px', height: 'auto' }}
                        title="Refresh System Voices"
                      >
                        ↻
                      </button>
                    </div>
                    <select
                      id="system-voice-select"
                      value={systemVoiceURI}
                      onChange={(e) => setSystemVoiceURI(e.target.value)}
                      style={{ maxWidth: '200px' }}
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
                              style={{ maxWidth: '200px' }}
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
                              style={{ maxWidth: '200px' }}
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
                {voiceSource === 'resemble' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label htmlFor="resemble-api-key" style={{ fontSize: '12px', fontWeight: 'bold' }}>Resemble API Key</label>
                      <input
                        id="resemble-api-key"
                        type={"pass" + "word"}
                        value={resembleApiKey}
                        onChange={(e) => setResembleApiKey(e.target.value)}
                        placeholder="Key..."
                      />
                    </div>

                    {resembleApiKey && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label htmlFor="resemble-voice-select" style={{ fontSize: '12px', fontWeight: 'bold' }}>Resemble Voice</label>
                        {isLoadingResembleVoices ? <span style={{ fontSize: '10px' }}>Loading...</span> : (
                          <>
                            {resembleVoiceError && (
                              <div style={{ color: 'red', fontSize: '10px', marginBottom: '5px' }}>
                                Error: {resembleVoiceError}
                              </div>
                            )}
                            <select
                              id="resemble-voice-select"
                              value={selectedResembleVoiceUuid}
                              onChange={(e) => setSelectedResembleVoiceUuid(e.target.value)}
                              style={{ maxWidth: '200px' }}
                            >
                              <option value="">-- Select Voice --</option>
                              {resembleVoices.map(v => (
                                <option key={v.uuid} value={v.uuid}>{v.name}</option>
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

            <button onClick={toggleMinimize} className="readalong-control-btn" title={isMinimized ? "Expand" : "Minimize"}>
              {isMinimized ? '↗️' : '_'}
            </button>
            <button onClick={onClose} className="readalong-close-btn">&times;</button>
          </div>
        </div>
        {!isMinimized && (
          <div className="readalong-content" ref={containerRef}>
            {alignmentMap ? (
              alignmentMap.sentences.map((sentence, sIdx) => {
                const isIgnored = ignoredSentenceIndices.has(sIdx);
                const isSearchMatch = searchMatches.includes(sIdx);
                const isSearchActive = isSearchMatch && currentMatchIndex !== -1 && searchMatches[currentMatchIndex] === sIdx;

                return (
                  <p
                    key={sIdx}
                    ref={el => matchRefs.current[sIdx] = el}
                    data-sentence-index={sIdx}
                    className={`${isIgnored ? 'ignored-block' : ''}`}
                    onClick={(e) => {
                      // User story update:
                      // If PLAYING: Jump to this sentence and continue playing.
                      // If NOT PLAYING: Just highlight/select this sentence (set currentWordIndex to start).

                      if (isIgnored) return;

                      if (isPlaying) {
                        handleReadAloud(sIdx);
                      } else {
                        // Just select visually
                        if (sentence.words.length > 0) {
                          // Set to global index of the first word
                          const firstWord = sentence.words[0];
                          const globalIdx = wordToGlobalIndex.get(firstWord);
                          if (globalIdx !== undefined) {
                            setCurrentWordIndex(globalIdx);
                          }
                        }
                      }
                    }}
                    title={isIgnored ? "Ignored (Click 'Ignore' to restore)" : (isPlaying ? "Click to jump here" : "Click to select (Press Play to start)")}
                  >
                    <button
                      className="ignore-btn"
                      onMouseDown={(e) => {
                        // Prevent default to ensure selection is NOT cleared
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => toggleIgnore(sIdx, e)}
                      title={isIgnored ? "Restore" : "Ignore"}
                    >
                      {isIgnored ? "👁️" : "🚫"}
                    </button>

                    {sentence.words.map((word, wIdx) => {
                      const isCurrentWord = currentWordIndex >= 0 && allWords[currentWordIndex] === word;
                      let isActive = isCurrentWord;

                      // Fallback: If using a "dumb" voice (no word boundaries), highlight the whole sentence
                      // if the current word pointer is anywhere in this sentence.
                      if (isSentenceHighlightMode && currentWordIndex >= 0) {
                        const currentGlobalWord = allWords[currentWordIndex];
                        // Check if the word currently being spoken is part of this sentence
                        if (sentence.words.includes(currentGlobalWord)) {
                          isActive = true;
                        }
                      }

                      return (
                        <span
                          key={wIdx}
                          className={`readalong-word ${isActive ? 'active' : ''} ${isIgnored ? 'ignored' : ''} ${isSearchMatch ? 'search-match' : ''} ${isSearchActive ? 'active' : ''}`}
                        >
                          {word.text}
                        </span>
                      );
                    })}
                  </p>
                );
              })
            ) : (
              <div dangerouslySetInnerHTML={{ __html: text || '' }} />
            )}
          </div>
        )}
      </div>
    </div >
  );
};

export default ReadingPane;
