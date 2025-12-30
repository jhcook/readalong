import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Popup from './Popup';

// Mock window.close
const originalClose = window.close;
beforeAll(() => {
  window.close = jest.fn();
});
afterAll(() => {
  window.close = originalClose;
});

describe('Popup', () => {
  it('sends LOAD_TEXT message when button is clicked', async () => {
    // Mock chrome.tabs.query to return a mock tab
    const mockTab = { id: 123 };
    (chrome.tabs.query as jest.Mock).mockResolvedValue([mockTab]);

    render(<Popup />);
    
    const button = screen.getByText('Load Text from Page');
    fireEvent.click(button);

    await waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, { type: 'LOAD_TEXT' });
    });
    
    expect(window.close).toHaveBeenCalled();
  });

  it('shows error message if chrome.tabs.query fails', async () => {
    console.error = jest.fn();
    window.alert = jest.fn();
    
    chrome.tabs.query.mockImplementation(() => {
      throw new Error('Tabs query failed');
    });

    render(<Popup />);
    
    const button = screen.getByText('Load Text from Page');
    fireEvent.click(button);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error: Could not communicate'));
    });
  });
});
