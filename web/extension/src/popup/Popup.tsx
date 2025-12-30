import React from 'react';

const Popup = () => {
  const sendMessage = async (message: { type: string }) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (initialError) {
          console.log('Content script not ready, injecting...', initialError);
          // If first attempt fails, try injecting the content script
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });

          // Retry sending the message
          await chrome.tabs.sendMessage(tab.id, message);
        }
        window.close(); // Close popup after action
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Error: Could not communicate with the page. Try refreshing the page.');
    }
  };

  const handleLoadText = () => sendMessage({ type: 'LOAD_TEXT' });

  const handleSelectContent = () => sendMessage({ type: 'ENTER_SELECTION_MODE' });

  return (
    <div>
      <button onClick={handleLoadText}>Load Text from Page</button>
      <button onClick={handleSelectContent} style={{ marginTop: '10px' }}>Select Content</button>
    </div>
  );
};

export default Popup;