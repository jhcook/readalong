import React, { useState, useEffect, useRef } from 'react';
import { AlignmentMap, Sentence, Word } from './types';
import { AudioRecorder } from './audio/AudioRecorder';
import { SttEngine } from './audio/SttEngine';
import { Aligner, RecognizedWord } from './alignment/Aligner';
import { useNetworkStatus } from './hooks/useNetworkStatus';

interface ReadingPaneProps {
  alignmentMap?: AlignmentMap;
  text?: string; // Fallback for backward compatibility or error states
  onClose: () => void;
  // Simulation props for US1-3 verification
  isSimulating?: boolean;
}

const ReadingPane: React.FC<ReadingPaneProps> = ({ alignmentMap, text, onClose, isSimulating = false }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isOnline = useNetworkStatus();
  
  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
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
      chromeApi.storage.local.get(['isDyslexiaFont', 'isHighContrast'], (result: any) => {
        if (result.isDyslexiaFont !== undefined) setIsDyslexiaFont(result.isDyslexiaFont);
        if (result.isHighContrast !== undefined) setIsHighContrast(result.isHighContrast);
      });
    }
  }, []);

  // Save settings when they change
  useEffect(() => {
    const chromeApi = getChrome();
    if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
      chromeApi.storage.local.set({ isDyslexiaFont, isHighContrast });
    }
  }, [isDyslexiaFont, isHighContrast]);

  // Flatten words for easy indexing
  const allWords: Word[] = React.useMemo(() => {
    if (!alignmentMap) return [];
    return alignmentMap.sentences.flatMap(s => s.words);
  }, [alignmentMap]);

  // STT Result Listener
  useEffect(() => {
    const handleSttResult = (event: CustomEvent) => {
      // event.detail is the Vosk result object
      // { result: Array<{conf, end, start, word}>, text: string } OR { partial: string }
      
      const data = event.detail;
      if (data && data.result && Array.isArray(data.result)) {
        // We have recognized words
        const recognizedWords = data.result as RecognizedWord[];
        
        // Run alignment
        // We pass the full reference list (allWords) and the new recognized words
        const matchedIndex = aligner.current.align(allWords, recognizedWords);
        
        if (matchedIndex !== -1) {
          setCurrentWordIndex(matchedIndex);
        }
      }
    };

    window.addEventListener('stt-result' as any, handleSttResult);
    // Partial results usually don't have word timestamps in standard Vosk usage unless configured
    // For now we rely on 'result' (final) which definitely has them if setWords(true) is used.
    // If we want faster feedback, we might need to parse partials differently or use a different Aligner strategy.
    
    return () => {
      window.removeEventListener('stt-result' as any, handleSttResult);
    };
  }, [allWords]);

  // Cleanup STT on unmount

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating && isPlaying && allWords.length > 0) {
      interval = setInterval(() => {
        setCurrentWordIndex(prev => {
          const next = prev + 1;
          if (next >= allWords.length) {
            setIsPlaying(false);
            return -1; // Reset or stop
          }
          return next;
        });
      }, 300); // 300ms per word simulation
    }
    return () => clearInterval(interval);
  }, [isSimulating, isPlaying, allWords.length]);

  const toggleHighContrast = () => {
    setIsHighContrast(!isHighContrast);
  };

  const toggleDyslexiaFont = () => {
    setIsDyslexiaFont(!isDyslexiaFont);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      try {
        const audioBlob = await audioRecorder.current.stop();
        sttEngine.current.stop();
        setIsRecording(false);
        console.log('Recording stopped, blob size:', audioBlob.size);
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    } else {
      try {
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

  return (
    <div className={`readalong-overlay ${isHighContrast ? 'high-contrast' : ''} ${isDyslexiaFont ? 'dyslexia-font' : ''}`}>
      <div className="readalong-container">
        <div className="readalong-header">
          <h2>
            ReadAlong
            {!isOnline && <span style={{ fontSize: '0.6em', marginLeft: '10px', background: '#666', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>OFFLINE</span>}
          </h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="readalong-control-btn" disabled={!isOnline} title={!isOnline ? "Unavailable offline" : "Cloud Text-to-Speech"}>
              Cloud TTS
            </button>
            <button onClick={toggleRecording} className={`readalong-control-btn ${isRecording ? 'recording' : ''}`}>
              {isRecording ? 'Stop Recording' : 'Record Voice'}
            </button>
            <button onClick={toggleDyslexiaFont} className="readalong-control-btn">
              {isDyslexiaFont ? 'Standard Font' : 'Dyslexia Font'}
            </button>
            <button onClick={toggleHighContrast} className="readalong-control-btn">
              {isHighContrast ? 'Normal Contrast' : 'High Contrast'}
            </button>
            {alignmentMap && (
              <button onClick={togglePlay} className="readalong-control-btn">
                {isPlaying ? 'Pause' : 'Play Simulation'}
              </button>
            )}
            <button onClick={onClose} className="readalong-close-btn">&times;</button>
          </div>
        </div>
        <div className="readalong-content">
          {alignmentMap ? (
            alignmentMap.sentences.map((sentence, sIdx) => (
              <p key={sIdx}>
                {sentence.words.map((word, wIdx) => {
                  // Determine global index if needed, or just match by reference if we had IDs
                  // Here we can use the 'index' property we added to Word interface in US1-2?
                  // Or just use the flattened list logic. 
                  // Let's assume we want to match against the flattened index we are simulating.
                  // We need to know the 'global' index of this word.
                  // A simple way is to calculate it or store it.
                  // For now, let's look it up or trust the structure.
                  // US1-2 `Word` has `index` which is relative to sentence? 
                  // Let's re-read types.ts. Word.index is "Order in the sentence".
                  // So we need a global index. 
                  
                  // Let's compute global index on the fly or pre-compute.
                  // Pre-computing is better for render performance.
                  // But for this prototype, let's find the word in allWords to check equality? No, too slow.
                  // Let's rely on the fact that we iterate sequentially.
                  // Actually, let's just use a simple counter variable outside the map? No, impure.
                  
                  // Better: let's verify if `word` is the active one.
                  // We can't easily know the global index here without extra work.
                  // Let's temporarily check if this word is the one at allWords[currentWordIndex].
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
