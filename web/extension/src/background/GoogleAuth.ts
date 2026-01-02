/**
 * GoogleAuth - JWT signing and OAuth2 token exchange for Service Account authentication
 * 
 * Uses Web Crypto API for RS256 JWT signing.
 * Tokens are cached in chrome.storage.session with a 55-minute TTL (5-min buffer before 1-hour expiry).
 */

import { ServiceAccountJson, JwtClaims, JwtHeader, TokenCache, TokenResponse } from '../types/google-auth';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const GOOGLE_TTS_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry, refresh

// In-memory cache as fallback (chrome.storage.session may not be available)
let memoryTokenCache: TokenCache | null = null;

/**
 * Parse a PEM-encoded PKCS#8 private key into a CryptoKey for signing
 */
async function parsePrivateKey(pem: string): Promise<CryptoKey> {
    // Remove PEM headers and all whitespace
    const pemContents = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');

    // Decode base64 to binary
    const binaryString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        binaryDer[i] = binaryString.charCodeAt(i);
    }

    // Import as PKCS#8 RSA key for RSASSA-PKCS1-v1_5 with SHA-256
    return crypto.subtle.importKey(
        'pkcs8',
        binaryDer.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, // not extractable
        ['sign']
    );
}

/**
 * Base64URL encode (no padding, URL-safe characters)
 */
function base64UrlEncode(data: Uint8Array | string): string {
    let input: string;
    if (typeof data === 'string') {
        input = btoa(data);
    } else {
        // Convert Uint8Array to string then base64
        let binary = '';
        for (let i = 0; i < data.length; i++) {
            binary += String.fromCharCode(data[i]);
        }
        input = btoa(binary);
    }
    // Make URL-safe: replace + with -, / with _, remove =
    return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign a JWT using RS256 algorithm
 */
async function signJwt(claims: JwtClaims, privateKey: CryptoKey): Promise<string> {
    const header: JwtHeader = { alg: 'RS256', typ: 'JWT' };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const claimsB64 = base64UrlEncode(JSON.stringify(claims));
    const signatureInput = `${headerB64}.${claimsB64}`;

    // Sign using Web Crypto
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        encoder.encode(signatureInput)
    );

    const signatureB64 = base64UrlEncode(new Uint8Array(signature));
    return `${signatureInput}.${signatureB64}`;
}

/**
 * Exchange a signed JWT for an OAuth2 access token
 */
async function exchangeJwtForToken(jwt: string, tokenUri: string): Promise<TokenResponse> {
    const response = await fetch(tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * Get cached token from chrome.storage.session or memory
 */
async function getCachedToken(): Promise<TokenCache | null> {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.session) {
            const result = await chrome.storage.session.get('googleAccessToken');
            if (result.googleAccessToken) {
                return result.googleAccessToken as TokenCache;
            }
        }
    } catch {
        // Fall back to memory cache
    }
    return memoryTokenCache;
}

/**
 * Store token in chrome.storage.session and memory
 */
async function setCachedToken(cache: TokenCache): Promise<void> {
    memoryTokenCache = cache;
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.session) {
            await chrome.storage.session.set({ googleAccessToken: cache });
        }
    } catch {
        // Memory fallback already set
    }
}

/**
 * Clear cached token
 */
async function clearCachedToken(): Promise<void> {
    memoryTokenCache = null;
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.session) {
            await chrome.storage.session.remove('googleAccessToken');
        }
    } catch {
        // Ignore
    }
}

/**
 * Main entry point: Get a valid access token, using cache if available.
 * Will generate a new token via JWT if cache is expired or missing.
 */
export async function getAccessToken(serviceAccount: ServiceAccountJson): Promise<string> {
    const tracer = trace.getTracer('readalong-extension');

    return tracer.startActiveSpan('GoogleAuth.getAccessToken', async (span) => {
        try {
            // Check cache first
            const cached = await getCachedToken();
            const now = Date.now();

            if (cached && cached.expiresAt > now + TOKEN_BUFFER_MS) {
                span.addEvent('cache_hit');
                span.end();
                return cached.accessToken;
            }

            span.addEvent('cache_miss');

            // Generate new token
            const privateKey = await parsePrivateKey(serviceAccount.private_key);

            const nowSeconds = Math.floor(now / 1000);
            const claims: JwtClaims = {
                iss: serviceAccount.client_email,
                scope: GOOGLE_TTS_SCOPE,
                aud: serviceAccount.token_uri,
                iat: nowSeconds,
                exp: nowSeconds + 3600 // 1 hour
            };

            const jwt = await signJwt(claims, privateKey);
            const tokenResponse = await exchangeJwtForToken(jwt, serviceAccount.token_uri);

            // Cache the token
            const cache: TokenCache = {
                accessToken: tokenResponse.access_token,
                expiresAt: now + (tokenResponse.expires_in * 1000)
            };
            await setCachedToken(cache);

            span.addEvent('token_generated');
            span.end();
            return tokenResponse.access_token;

        } catch (err: any) {
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            span.end();

            // Clear cache on error to force re-generation
            await clearCachedToken();
            throw err;
        }
    });
}

/**
 * Validate that a JSON object is a valid Service Account JSON
 */
export function validateServiceAccountJson(json: unknown): json is ServiceAccountJson {
    if (!json || typeof json !== 'object') return false;

    const obj = json as Record<string, unknown>;

    return (
        obj.type === 'service_account' &&
        typeof obj.private_key === 'string' &&
        typeof obj.client_email === 'string' &&
        typeof obj.token_uri === 'string' &&
        obj.private_key.includes('-----BEGIN PRIVATE KEY-----')
    );
}

export { clearCachedToken };
