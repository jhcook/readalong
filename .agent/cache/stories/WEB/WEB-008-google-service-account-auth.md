# WEB-008: Google Cloud TTS Service Account Authentication

## State
COMMITTED

## Problem Statement
The current Google Voices integration uses an API Key passed as a URL query parameter (`?key=API_KEY`). This approach has several drawbacks:
1. **Short-lived tokens** - API Keys can expire or be revoked
2. **Security exposure** - Keys appear in server logs and browser history
3. **Limited scoping** - API Keys cannot be scoped to specific services as granularly

Google Cloud recommends using **Service Account JSON keys** for server-to-server authentication, which generate OAuth2 access tokens via JWT signing. These tokens are automatically refreshed and provide more stable authentication.

## User Story
As a **ReadAlong user**, I want to authenticate to Google Cloud TTS using a Service Account JSON key (instead of an API Key) so that I have more reliable, secure, and stable authentication that doesn't expire unexpectedly.

## Acceptance Criteria
- [ ] **Scenario 1 (Upload)**: Given I am on the settings page, When I upload a valid Google Cloud Service Account JSON file, Then the file is validated and stored securely in `chrome.storage.local`.
- [ ] **Scenario 2 (Voice Fetch)**: Given a valid Service Account JSON is stored, When I select "Google Voices" as my voice source, Then available Google TTS voices are fetched and displayed.
- [ ] **Scenario 3 (Audio Generation)**: Given a valid Service Account JSON and selected voice, When I click "Read Aloud", Then audio is generated using OAuth2 authentication derived from the JSON key.
- [ ] **Scenario 4 (Backward Compatibility)**: Given an existing API Key is stored, When I upgrade the extension, Then the API Key authentication continues to work until a Service Account JSON is provided.
- [ ] **Negative Test**: Given an invalid or incomplete JSON file is uploaded, Then an error message is displayed and the file is not stored.

## Observability Requirements
- [ ] **Tracing**: OAuth2 token generation and refresh traced in `Background.generateGoogleAccessToken`
- [ ] **Logging**: Auth failures logged with error codes (no credentials exposed)
- [ ] **Metrics**: N/A (extension context)
- [ ] **Alerts**: N/A (extension context)

## Non-Functional Requirements
- **Performance**: OAuth2 token generation adds ~500ms latency on first request; tokens cached for 55 minutes (5-min buffer before 1-hour expiry)
- **Security**: Private key never leaves the extension; JWT signed locally using Web Crypto API
- **Compliance**: No PII involved; Service Account JSON is user-provided

## Linked ADRs
- N/A (follows existing Provider pattern)

---

## Technical Specification

### Deliverables

| # | Deliverable | Path | Description |
|---|-------------|------|-------------|
| 1 | **GoogleAuth utility** | `web/extension/src/background/GoogleAuth.ts` | [NEW] JWT signing + OAuth2 token exchange |
| 2 | **Background handlers** | `web/extension/src/background/index.ts` | [MODIFY] Add `GET_GOOGLE_ACCESS_TOKEN` handler; update voice/audio handlers to use token |
| 3 | **GoogleClient** | `web/extension/src/content/services/GoogleClient.ts` | [MODIFY] Support both API Key and Service Account auth modes |
| 4 | **GoogleProvider** | `web/extension/src/content/providers/GoogleProvider.ts` | [MODIFY] Pass auth mode to client methods |
| 5 | **UI Settings** | `web/extension/src/content/ReadingPane.tsx` | [MODIFY] Add JSON file upload button + validation |
| 6 | **Types** | `web/extension/src/types/google-auth.ts` | [NEW] TypeScript interfaces for Service Account JSON |

---

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| JWT Signing | **Web Crypto API** (`crypto.subtle`) | RS256 signature using `importKey` + `sign` |
| PEM Parsing | **pkcs8** format via `crypto.subtle.importKey` | Convert PEM private key to CryptoKey |
| Token Cache | `chrome.storage.session` | Store access token with expiry (cleared on browser restart) |
| File Upload | HTML5 `<input type="file">` | Read JSON file via `FileReader` API |
| Persistence | `chrome.storage.local` | Store Service Account JSON (encrypted at rest by Chrome) |

---

### Service Account JSON Structure

The user downloads this file from Google Cloud Console following the steps in the [Sonaar guide](https://sonaar.io/docs/how-to-get-google-cloud-text-to-speech-api-key/):

```json
{
  "type": "service_account",
  "project_id": "my-project-123",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "tts-service@my-project-123.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**Required fields for authentication:**
- `client_email` - JWT `iss` (issuer) claim
- `private_key` - RSA key for signing JWT
- `token_uri` - OAuth2 token endpoint (typically `https://oauth2.googleapis.com/token`)

---

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: User uploads Service Account JSON                                   │
│         → Validated (type === "service_account", has private_key)           │
│         → Stored in chrome.storage.local                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2: Extension needs to call Google TTS API                              │
│         a) Check token cache for valid (non-expired) access token           │
│         b) If expired or missing → Generate new token (Step 3)              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: Generate JWT (in background script)                                 │
│         Header: { "alg": "RS256", "typ": "JWT" }                            │
│         Payload: {                                                          │
│           "iss": "client_email",                                            │
│           "scope": "https://www.googleapis.com/auth/cloud-platform",        │
│           "aud": "https://oauth2.googleapis.com/token",                     │
│           "iat": 1704200000,                                                │
│           "exp": 1704203600  (iat + 3600)                                   │
│         }                                                                   │
│         Signature: RS256(header.payload, private_key)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 4: Exchange JWT for Access Token                                       │
│         POST https://oauth2.googleapis.com/token                            │
│         Content-Type: application/x-www-form-urlencoded                     │
│         Body: grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer        │
│               &assertion=<signed_jwt>                                       │
│         Response: { "access_token": "ya29...", "expires_in": 3600, ... }    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 5: Call Google TTS API with Bearer token                               │
│         GET https://texttospeech.googleapis.com/v1/voices                   │
│         Authorization: Bearer ya29...                                       │
│                                                                             │
│         POST https://texttospeech.googleapis.com/v1/text:synthesize         │
│         Authorization: Bearer ya29...                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### API Changes

#### Current (API Key)
```typescript
// Voices
fetch(`https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`)

// Synthesis
fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
})
```

#### New (Service Account → OAuth2)
```typescript
// Get access token first (cached)
const accessToken = await getGoogleAccessToken(serviceAccountJson);

// Voices
fetch('https://texttospeech.googleapis.com/v1/voices', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})

// Synthesis
fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
})
```

---

## Impact Analysis Summary
**Components touched:**
- `web/extension/src/background/GoogleAuth.ts` [NEW]
- `web/extension/src/background/index.ts` [MODIFY]
- `web/extension/src/content/services/GoogleClient.ts` [MODIFY]
- `web/extension/src/content/providers/GoogleProvider.ts` [MODIFY]
- `web/extension/src/content/ReadingPane.tsx` [MODIFY]
- `web/extension/src/types/google-auth.ts` [NEW]

**Workflows affected:**
- Google Voices voice fetching
- Google Voices audio generation
- Settings UI (new upload component)

**Risks identified:**
- PEM key parsing edge cases (different line-ending formats)
- Token refresh race conditions during concurrent requests
- Storage quota for JSON file (~2KB typical)

---

## Test Strategy

### Unit Tests
- [ ] `GoogleAuth.signJwt()` produces valid RS256 signature
- [ ] `GoogleAuth.parsePrivateKey()` handles various PEM formats
- [ ] Token cache respects expiry (returns cached or refreshes)

### Manual Verification
1. **Upload Flow**: Upload valid JSON → verify stored in `chrome.storage.local`
2. **Voice Fetch**: Select Google Voices → voices populate dropdown
3. **Audio Playback**: Click "Read Aloud" → audio plays with highlighting
4. **Fallback**: Clear JSON, enter API Key → API Key auth still works

---

## Rollback Plan
- API Key authentication is preserved as fallback
- If Service Account auth fails, user can:
  1. Clear Service Account JSON from settings
  2. Enter API Key in the original field
  3. Extension reverts to query-parameter auth
