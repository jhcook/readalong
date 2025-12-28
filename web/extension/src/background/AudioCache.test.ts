import { AudioCache } from './AudioCache';

// Simple In-Memory Mock for IndexedDB
class MockIDBRequest {
    public result: any;
    public error: any;
    public onsuccess: Function | null = null;
    public onerror: Function | null = null;
    public onupgradeneeded: Function | null = null;
    public transaction: any = null;

    triggerSuccess(result: any) {
        this.result = result;
        if (this.onsuccess) {
            this.onsuccess({ target: this });
        }
    }

    triggerError(err: any) {
        this.error = err;
        if (this.onerror) {
            this.onerror({ target: this });
        }
    }

    triggerUpgrade(db: any) {
        this.result = db;
        if (this.onupgradeneeded) {
            this.onupgradeneeded({ target: this });
        }
    }
}

const mockStore = new Map<string, any>();

class MockIDBObjectStore {
    put(data: any) {
        mockStore.set(data.id, data);
        const req = new MockIDBRequest();
        setTimeout(() => req.triggerSuccess(undefined), 0);
        return req;
    }
    get(key: string) {
        const req = new MockIDBRequest();
        setTimeout(() => req.triggerSuccess(mockStore.get(key)), 0);
        return req;
    }
}

class MockIDBTransaction {
    objectStore(name: string) {
        return new MockIDBObjectStore();
    }
}

class MockIDBDatabase {
    public objectStoreNames = {
        contains: (name: string) => false
    };

    createObjectStore(name: string, options: any) {
        return new MockIDBObjectStore();
    }

    transaction(stores: string[], mode: string) {
        return new MockIDBTransaction();
    }
}

const mockIndexedDB = {
    open: (name: string, version: number) => {
        const req = new MockIDBRequest();
        const db = new MockIDBDatabase();
        setTimeout(() => {
            req.triggerUpgrade(db); // Simulate upgrade needed first time
            req.triggerSuccess(db);
        }, 0);
        return req;
    }
};

Object.defineProperty(global, 'indexedDB', {
    value: mockIndexedDB
});

const readBlob = (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
    });
};

describe('AudioCache', () => {
    let cache: AudioCache;

    beforeEach(() => {
        mockStore.clear();
        cache = new AudioCache();
        // Reset the Singleton promise or instance if needed, 
        // but AudioCache implementation doesn't look static so new instance is fine.
    });

    it('returns null if key does not exist', async () => {
        const result = await cache.getAudio('non-existent');
        expect(result).toBeNull();
    });

    it('saves and retrieves a blob', async () => {
        const id = 'test-id';
        const content = new Blob(['audio data'], { type: 'audio/mpeg' });

        await cache.saveAudio(id, content);
        const result = await cache.getAudio(id);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(Blob);

        const text = await readBlob(result!);
        expect(text).toBe('audio data');
    });

    it('updates existing key', async () => {
        const id = 'overwrite-id';
        await cache.saveAudio(id, new Blob(['first'], { type: 'text/plain' }));
        await cache.saveAudio(id, new Blob(['second'], { type: 'text/plain' }));

        const result = await cache.getAudio(id);
        const text = await readBlob(result!);
        expect(text).toBe('second');
    });
});
