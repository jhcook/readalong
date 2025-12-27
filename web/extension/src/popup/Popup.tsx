import React from 'react';

const Popup = () => {
  const handleLoadText = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'LOAD_TEXT' });
        window.close(); // Close popup after action
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Error: Could not communicate with the page. Try refreshing the page.');
    }
  };

  return (
    <div>
      <button onClick={handleLoadText}>Load Text from Page</button>
    </div>
  );
};

export default Popup;