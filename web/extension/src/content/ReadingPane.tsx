import React from 'react';

interface ReadingPaneProps {
  text: string;
  onClose: () => void;
}

const ReadingPane: React.FC<ReadingPaneProps> = ({ text, onClose }) => {
  return (
    <div className="readalong-overlay">
      <div className="readalong-container">
        <div className="readalong-header">
          <h2>ReadAlong</h2>
          <button onClick={onClose} className="readalong-close-btn">&times;</button>
        </div>
        <div className="readalong-content" dangerouslySetInnerHTML={{ __html: text }}>
        </div>
      </div>
    </div>
  );
};

export default ReadingPane;
