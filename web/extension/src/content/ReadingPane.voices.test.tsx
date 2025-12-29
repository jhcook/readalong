
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReadingPane from './ReadingPane';
import { AlignmentMap } from './types';

// Mock child components/icons
// Mock window.speechSynthesis
const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockGetVoices = jest.fn();

Object.defineProperty(window, 'speechSynthesis', {
    value: {
        speak: mockSpeak,
        cancel: mockCancel,
        pause: mockPause,
        resume: mockResume,
        getVoices: mockGetVoices,
        onvoiceschanged: null,
        speaking: false,
        paused: false,
    },
    writable: true,
});

describe('ReadingPane Voice Loading', () => {
    const mockOnClose = jest.fn();
    const mockAlignmentMap: AlignmentMap = { sentences: [], fullText: '' };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset voices
        mockGetVoices.mockReturnValue([]);
    });

    test('Loads voices on mount and displays them in settings', async () => {
        const voices = [
            { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English' },
            { name: 'Microsoft David', lang: 'en-US', voiceURI: 'Microsoft David' },
        ];
        mockGetVoices.mockReturnValue(voices);

        await act(async () => {
            render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={mockOnClose} />);
        });

        // Open settings
        const settingsBtn = screen.getByTitle('Settings');
        await act(async () => {
            settingsBtn.click();
        });

        // Expect voices to be listed in the system voice dropdown
        const select = screen.getByLabelText('System Voice');
        expect(select).toBeInTheDocument();

        expect(screen.getByText('Google US English (en-US)')).toBeInTheDocument();
        expect(screen.getByText('Microsoft David (en-US)')).toBeInTheDocument();
    });

    test('Updates voices when onvoiceschanged fires', async () => {
        mockGetVoices.mockReturnValue([]);

        await act(async () => {
            render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={mockOnClose} />);
        });

        // Trigger voices changed
        const newVoices = [
            { name: 'Microsoft Zira', lang: 'en-US', voiceURI: 'Microsoft Zira' }
        ];
        mockGetVoices.mockReturnValue(newVoices);

        await act(async () => {
            if (window.speechSynthesis.onvoiceschanged) {
                // @ts-ignore
                window.speechSynthesis.onvoiceschanged(new Event('voiceschanged'));
            }
        });

        // Open settings
        const settingsBtn = screen.getByTitle('Settings');
        await act(async () => {
            settingsBtn.click();
        });

        expect(screen.getByText('Microsoft Zira (en-US)')).toBeInTheDocument();
    });

    test('Refresh button forces a voice update', async () => {
        // Start with empty
        mockGetVoices.mockReturnValue([]);

        await act(async () => {
            render(<ReadingPane alignmentMap={mockAlignmentMap} onClose={mockOnClose} />);
        });

        // Open settings
        const settingsBtn = screen.getByTitle('Settings');
        await act(async () => {
            settingsBtn.click();
        });

        // Verify empty (or default option)
        // Now mock new voices available only after click
        const refreshedVoices = [
            { name: 'Microsoft Refresh', lang: 'en-US', voiceURI: 'Microsoft Refresh' }
        ];
        mockGetVoices.mockReturnValue(refreshedVoices);

        const refreshBtn = screen.getByTitle('Refresh System Voices');
        expect(refreshBtn).toBeInTheDocument();

        await act(async () => {
            refreshBtn.click();
        });

        expect(screen.getByText('Microsoft Refresh (en-US)')).toBeInTheDocument();
    });
});
