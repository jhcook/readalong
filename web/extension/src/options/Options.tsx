import React, { useEffect, useState } from 'react';
import { ServiceAccountJson, GoogleAuthOptions } from '../types/google-auth';

export const Options: React.FC = () => {
    const [googleApiKey, setGoogleApiKey] = useState<string>('');
    const [googleServiceAccountJson, setGoogleServiceAccountJson] = useState<ServiceAccountJson | null>(null);
    const [authMode, setAuthMode] = useState<'apiKey' | 'serviceAccount'>('apiKey');
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        // Load settings
        chrome.storage.local.get(['googleApiKey', 'googleServiceAccountJson', 'googleAuthMode'], (result) => {
            if (result.googleApiKey) setGoogleApiKey(result.googleApiKey);
            if (result.googleServiceAccountJson) setGoogleServiceAccountJson(result.googleServiceAccountJson);
            if (result.googleAuthMode) setAuthMode(result.googleAuthMode);
        });
    }, []);

    const saveSettings = () => {
        setStatus('Saving...');
        chrome.storage.local.set({
            googleApiKey,
            googleServiceAccountJson,
            googleAuthMode: authMode
        }, () => {
            setStatus('Saved!');
            setTimeout(() => setStatus(''), 2000);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const json = JSON.parse(text);

            // Basic validation
            if (!json.client_email || !json.private_key) {
                alert("Invalid Service Account JSON. Missing client_email or private_key.");
                return;
            }

            setGoogleServiceAccountJson(json);
        } catch (err) {
            alert("Error parsing JSON file");
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>ReadAlong Settings</h1>

            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>Google Cloud Text-to-Speech</h2>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                    Configure authentication to use high-quality Google Cloud voices.
                    Credentials are stored securely in your browser's local storage and are never exposed to web pages.
                </p>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Authentication Mode</label>
                    <select
                        value={authMode}
                        onChange={(e) => setAuthMode(e.target.value as any)}
                        style={{ padding: '8px', width: '100%' }}
                    >
                        <option value="apiKey">API Key (Simple)</option>
                        <option value="serviceAccount">Service Account (Secure)</option>
                    </select>
                </div>

                {authMode === 'apiKey' && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>API Key</label>
                        <input
                            type="password"
                            value={googleApiKey}
                            onChange={(e) => setGoogleApiKey(e.target.value)}
                            placeholder="Enter AIza..."
                            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                )}

                {authMode === 'serviceAccount' && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Service Account JSON</label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            style={{ marginBottom: '5px' }}
                        />
                        {googleServiceAccountJson && (
                            <div style={{ fontSize: '13px', color: 'green', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>Loaded: {googleServiceAccountJson.client_email}</span>
                                <button onClick={() => setGoogleServiceAccountJson(null)}>Clear</button>
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={saveSettings}
                    style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Save Settings
                </button>
                {status && <span style={{ marginLeft: '10px', color: status === 'Saved!' ? 'green' : 'gray' }}>{status}</span>}
            </div>
        </div>
    );
};
