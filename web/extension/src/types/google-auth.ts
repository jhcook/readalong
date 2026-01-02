/**
 * Google Service Account Authentication Types
 * Used for OAuth2-based authentication with Google Cloud TTS API
 */

/**
 * Service Account JSON structure as downloaded from Google Cloud Console.
 * Following the steps in: https://sonaar.io/docs/how-to-get-google-cloud-text-to-speech-api-key/
 */
export interface ServiceAccountJson {
    type: 'service_account';
    project_id: string;
    private_key_id: string;
    private_key: string;      // PEM-encoded RSA private key (PKCS#8 format)
    client_email: string;     // Used as JWT "iss" claim
    client_id: string;
    auth_uri: string;
    token_uri: string;        // OAuth2 endpoint (typically https://oauth2.googleapis.com/token)
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
}

/**
 * Cached OAuth2 access token with expiry
 */
export interface TokenCache {
    accessToken: string;
    expiresAt: number;        // Unix timestamp in milliseconds
}

/**
 * Authentication options for Google Cloud API calls.
 * Supports both API Key (legacy) and Service Account JSON (recommended).
 */
export interface GoogleAuthOptions {
    /** Legacy API Key authentication (passed in URL query parameter) */
    apiKey?: string;
    /** Service Account JSON for OAuth2 authentication (recommended) */
    serviceAccountJson?: ServiceAccountJson;
}

/**
 * JWT Header for RS256 signing
 */
export interface JwtHeader {
    alg: 'RS256';
    typ: 'JWT';
}

/**
 * JWT Claims for Google OAuth2 service account authentication
 */
export interface JwtClaims {
    iss: string;    // Service account email
    scope: string;  // API scope (e.g., "https://www.googleapis.com/auth/cloud-platform")
    aud: string;    // Token URI
    iat: number;    // Issued at (Unix seconds)
    exp: number;    // Expiry (Unix seconds)
}

/**
 * OAuth2 token response from Google
 */
export interface TokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;       // Seconds until expiry (typically 3600)
}
