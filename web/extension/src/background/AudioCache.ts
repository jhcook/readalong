export class AudioCache {
    private dbName = 'ReadAlongCache';
    private storeName = 'audio_blobs';
    private version = 1;
    private dbPromise: Promise<IDBDatabase> | null = null;

    constructor() {
        this.init();
    }

    private init(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event);
                reject('Error opening database');
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // Key is a combination of voiceId + text hash
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
        return this.dbPromise;
    }

    async getAudio(id: string): Promise<{ blob: Blob, alignment?: any } | null> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onerror = () => {
                // Not found or error
                resolve(null);
            };

            request.onsuccess = () => {
                if (request.result) {
                    resolve({ blob: request.result.blob, alignment: request.result.alignment });
                } else {
                    resolve(null);
                }
            };
        });
    }

    async saveAudio(id: string, blob: Blob, alignment?: any): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ id, blob, alignment, timestamp: Date.now() });

            request.onerror = () => reject('Error saving blob');
            request.onsuccess = () => resolve();
        });
    }
}
