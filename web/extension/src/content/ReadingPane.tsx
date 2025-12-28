import React, { useState, useEffect } from 'react';
import { AlignmentMap, Sentence, Word } from './types';

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

  // Flatten words for easy indexing
  const allWords: Word[] = React.useMemo(() => {
    if (!alignmentMap) return [];
    return alignmentMap.sentences.flatMap(s => s.words);
  }, [alignmentMap]);

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

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="readalong-overlay">
      <div className="readalong-container">
        <div className="readalong-header">
          <h2>ReadAlong</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
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
