export async function generateId(voiceId: string, text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(voiceId + '::' + text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
