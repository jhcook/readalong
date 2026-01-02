# Runbook for WEB-008: Google Cloud TTS Service Account Authentication

## Overview
Migration of Google Cloud TTS authentication from API Key (URL query parameter) to Service Account JSON (OAuth2 Bearer token). This provides more stable, secure authentication that doesn't expire unexpectedly.

---

## Architecture

### Authentication Flow
```
ReadingPane.tsx (UI)
    ↓ (file upload → validate → store)
chrome.storage.local
    ↓ (serviceAccountJson)
GoogleAuth.ts (Background)
    ↓ (signJwt → exchangeToken)
https://oauth2.googleapis.com/token
    ↓ (access_token)
Token Cache (chrome.storage.session)
    ↓ (cached for 55 min)
Background Handlers (FETCH_GOOGLE_VOICES / GENERATE_GOOGLE_AUDIO)
    ↓ (Authorization: Bearer <token>)
https://texttospeech.googleapis.com/v1/*
```

### Component Flow (Audio Generation)
```
ReadingPane.tsx (UI)
    ↓ (settings: serviceAccountJson OR apiKey)
GoogleProvider.ts (Provider)
    ↓ (message: GENERATE_GOOGLE_AUDIO)
GoogleClient.ts (Client)
    ↓ (chrome.runtime.sendMessage)
background/index.ts
    ↓ (getAccessToken if serviceAccount, else use apiKey)
GoogleAuth.ts
    ↓ (JWT sign → token exchange)
Google TTS API
    ↓ (audio + timepoints)
AudioCache.ts → offscreen.ts (Playback)
```

---

## Files

### 1. GoogleAuth.ts [NEW]
**Path:** `web/extension/src/background/GoogleAuth.ts`

#### Purpose
Handles JWT signing and OAuth2 token exchange using Web Crypto API.

#### Interfaces
```typescript
interface ServiceAccountJson {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;      // PEM-encoded RSA private key
  client_email: string;     // Used as JWT "iss" claim
  client_id: string;
  auth_uri: string;
  token_uri: string;        // OAuth2 endpoint
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;        // Unix timestamp (ms)
}
```

#### Functions
| Function | Description |
|----------|-------------|
| `parsePrivateKey(pem: string): Promise<CryptoKey>` | Converts PEM private key to Web Crypto CryptoKey |
| `signJwt(claims: JwtClaims, privateKey: CryptoKey): Promise<string>` | Signs JWT with RS256 algorithm |
| `exchangeJwtForToken(jwt: string, tokenUri: string): Promise<TokenResponse>` | Exchanges signed JWT for OAuth2 access token |
| `getAccessToken(serviceAccount: ServiceAccountJson): Promise<string>` | Main entry point - returns cached or fresh access token |

#### Implementation Details

**PEM Parsing:**
```typescript
async function parsePrivateKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and decode base64
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}
```

**JWT Structure:**
```typescript
const header = { alg: 'RS256', typ: 'JWT' };
const payload = {
  iss: serviceAccount.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  aud: serviceAccount.token_uri,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
};
```

**Token Exchange:**
```typescript
const response = await fetch(tokenUri, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
});
// Returns: { access_token: "ya29...", token_type: "Bearer", expires_in: 3600 }
```

---

### 2. Background Script Updates
**Path:** `web/extension/src/background/index.ts`

#### New Message Handler
| Message Type | Description |
|--------------|-------------|
| `GET_GOOGLE_ACCESS_TOKEN` | Returns cached access token or generates new one |

#### Modified Handlers

**FETCH_GOOGLE_VOICES:**
```typescript
if (message.type === 'FETCH_GOOGLE_VOICES') {
  const { apiKey, serviceAccountJson } = message;
  
  let headers: HeadersInit = {};
  let url = 'https://texttospeech.googleapis.com/v1/voices';
  
  if (serviceAccountJson) {
    // OAuth2 path
    const accessToken = await GoogleAuth.getAccessToken(serviceAccountJson);
    headers = { 'Authorization': `Bearer ${accessToken}` };
  } else if (apiKey) {
    // Legacy API Key path
    url = `${url}?key=${apiKey}`;
  }
  
  const res = await fetch(url, { headers });
  // ... rest of handler
}
```

**GENERATE_GOOGLE_AUDIO:**
```typescript
if (message.type === 'GENERATE_GOOGLE_AUDIO') {
  const { text, voiceId, apiKey, serviceAccountJson, languageCode, ssmlGender } = message;
  
  let headers: HeadersInit = { 'Content-Type': 'application/json' };
  let url = 'https://texttospeech.googleapis.com/v1/text:synthesize';
  
  if (serviceAccountJson) {
    const accessToken = await GoogleAuth.getAccessToken(serviceAccountJson);
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (apiKey) {
    url = `${url}?key=${apiKey}`;
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ... })
  });
  // ... rest of handler
}
```

---

### 3. GoogleClient.ts
**Path:** `web/extension/src/content/services/GoogleClient.ts`

#### Interface Changes
```typescript
interface GoogleAuthOptions {
  apiKey?: string;
  serviceAccountJson?: ServiceAccountJson;
}
```

#### Method Signature Updates
```typescript
// Before
static async getVoices(apiKey: string): Promise<GoogleVoice[]>
static async generateAudio(apiKey: string, ...): Promise<...>

// After
static async getVoices(auth: GoogleAuthOptions): Promise<GoogleVoice[]>
static async generateAudio(auth: GoogleAuthOptions, ...): Promise<...>
```

---

### 4. ReadingPane.tsx UI Updates
**Path:** `web/extension/src/content/ReadingPane.tsx`

#### New State Variables
```typescript
const [googleServiceAccount, setGoogleServiceAccount] = useState<ServiceAccountJson | null>(null);
const [googleAuthMode, setGoogleAuthMode] = useState<'apiKey' | 'serviceAccount'>('apiKey');
```

#### New UI Components

**Auth Mode Toggle:**
```tsx
<select value={googleAuthMode} onChange={(e) => setGoogleAuthMode(e.target.value)}>
  <option value="apiKey">API Key</option>
  <option value="serviceAccount">Service Account JSON</option>
</select>
```

**JSON File Upload (when serviceAccount selected):**
```tsx
{googleAuthMode === 'serviceAccount' && (
  <div className="service-account-upload">
    <label>Service Account JSON:</label>
    <input
      type="file"
      accept=".json"
      onChange={handleJsonUpload}
    />
    {googleServiceAccount && (
      <span className="success">✓ {googleServiceAccount.client_email}</span>
    )}
  </div>
)}
```

**File Upload Handler:**
```typescript
const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    
    // Validate required fields
    if (json.type !== 'service_account') {
      throw new Error('Not a service account JSON file');
    }
    if (!json.private_key || !json.client_email || !json.token_uri) {
      throw new Error('Missing required fields');
    }
    
    setGoogleServiceAccount(json);
    await chrome.storage.local.set({ googleServiceAccountJson: json });
  } catch (err) {
    alert(`Invalid Service Account JSON: ${err.message}`);
  }
};
```

#### Settings Persistence
```typescript
// Load on mount
useEffect(() => {
  chrome.storage.local.get(['googleServiceAccountJson', 'googleAuthMode'], (result) => {
    if (result.googleServiceAccountJson) {
      setGoogleServiceAccount(result.googleServiceAccountJson);
    }
    if (result.googleAuthMode) {
      setGoogleAuthMode(result.googleAuthMode);
    }
  });
}, []);

// Save on change
useEffect(() => {
  chrome.storage.local.set({ googleAuthMode });
}, [googleAuthMode]);
```

---

## Implementation Checklist

### 1. GoogleAuth Utility [NEW]
- [ ] Create `web/extension/src/background/GoogleAuth.ts`
  - [ ] Implement `parsePrivateKey()` with PEM parsing
  - [ ] Implement `signJwt()` with RS256 via Web Crypto
  - [ ] Implement `exchangeJwtForToken()` OAuth2 exchange
  - [ ] Implement `getAccessToken()` with caching logic
  - [ ] Handle token refresh (5-minute buffer before expiry)

### 2. Background Handlers
- [ ] Update `web/extension/src/background/index.ts`
  - [ ] Import `GoogleAuth`
  - [ ] Update `FETCH_GOOGLE_VOICES` to accept `serviceAccountJson`
  - [ ] Update `GENERATE_GOOGLE_AUDIO` to accept `serviceAccountJson`
  - [ ] Add token error handling (401 → re-generate token)

### 3. GoogleClient
- [ ] Update `web/extension/src/content/services/GoogleClient.ts`
  - [ ] Change method signatures to accept `GoogleAuthOptions`
  - [ ] Pass both `apiKey` and `serviceAccountJson` to background

### 4. UI Integration
- [ ] Update `web/extension/src/content/ReadingPane.tsx`
  - [ ] Add auth mode toggle (API Key vs Service Account)
  - [ ] Add JSON file upload component
  - [ ] Add validation and feedback
  - [ ] Persist settings to `chrome.storage.local`
  - [ ] Display `client_email` on successful upload

### 5. Types
- [ ] Create `web/extension/src/types/google-auth.ts`
  - [ ] `ServiceAccountJson` interface
  - [ ] `TokenCache` interface
  - [ ] `GoogleAuthOptions` type

---

## Verification

### Build Check
```bash
cd web/extension
npm run build
```
Ensure no TypeScript errors and build succeeds.

### Manual Testing

#### 1. Upload Flow
1. Open extension settings
2. Select "Google Voices" as Voice Source
3. Switch auth mode to "Service Account JSON"
4. Click file upload and select valid JSON file
5. **Expected:** Green checkmark with `client_email` displayed

#### 2. Invalid JSON Handling
1. Upload a regular JSON file (not service account)
2. **Expected:** Error alert "Not a service account JSON file"
3. Upload JSON missing `private_key`
4. **Expected:** Error alert "Missing required fields"

#### 3. Voice Fetching with Service Account
1. Upload valid Service Account JSON
2. Wait for voices dropdown to populate
3. **Expected:** Google TTS voices appear in dropdown

#### 4. Audio Generation with Service Account
1. Configure Service Account + select voice
2. Navigate to any article
3. Click "Read Aloud"
4. **Expected:** Audio plays with word highlighting

#### 5. Fallback to API Key
1. Switch auth mode back to "API Key"
2. Enter valid API Key
3. Click "Read Aloud"
4. **Expected:** Audio plays (legacy path still works)

### Error Scenarios
| Scenario | Expected Behavior |
|----------|-------------------|
| Expired/revoked Service Account | Error: "Invalid grant" → prompt to re-upload JSON |
| Missing TTS API enablement | Error: "Cloud Text-to-Speech API has not been used..." |
| Quota exceeded | Error: "Quota exceeded" |
| Network error during token exchange | Error: "Failed to get access token: [network error]" |

---

## Known Limitations

1. **Token Caching**: Tokens cached in `chrome.storage.session` are lost on browser restart. First request after restart has ~500ms added latency for token generation.

2. **Private Key Security**: The private key is stored in `chrome.storage.local`. While Chrome encrypts this at rest, a compromised extension could theoretically access it. Users should use dedicated service accounts with minimal permissions.

3. **No Key Rotation UI**: If user rotates their service account key in Google Cloud, they must manually re-upload the new JSON file.

4. **PEM Format Requirement**: Only PKCS#8 format private keys are supported (standard Google Cloud format). PKCS#1 format will fail.

---

## Troubleshooting

### "Failed to import private key"
- Ensure JSON is from Google Cloud Console (not manually created)
- Check `private_key` field contains `-----BEGIN PRIVATE KEY-----` (PKCS#8 format)

### "Invalid grant" error
- Service account may be disabled in Google Cloud Console
- Token URI may be incorrect (should be `https://oauth2.googleapis.com/token`)
- Clock skew: system time significantly off from actual time

### "Cloud Text-to-Speech API has not been used in project..."
- User needs to enable the API at: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com

### Voices load but audio fails
- Service account may lack `Cloud Text-to-Speech User` role
- Check billing is enabled on the Google Cloud project
