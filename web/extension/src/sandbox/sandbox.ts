import { createModel, KaldiRecognizer, Model } from 'vosk-browser';

let model: Model | null = null;
let recognizer: KaldiRecognizer | null = null;

// Message handling
window.addEventListener('message', async (event) => {
    const message = event.data;
    if (!message || !message.type) return;

    try {
        switch (message.type) {
            case 'INITIALIZE':
                await initialize(message.modelUrl);
                break;
            case 'PROCESS_AUDIO':
                processAudio(message.data, message.sampleRate);
                break;
            case 'TERMINATE':
                cleanup();
                break;
        }
    } catch (error) {
        console.error('[Sandbox] Error processing message:', error);
        window.parent.postMessage({
            type: 'ERROR',
            error: error instanceof Error ? error.message : String(error)
        }, '*');
    }
});

async function initialize(modelUrl: string) {
    if (model) return;

    console.debug('[Sandbox] Initializing model...', modelUrl);

    // Vosk createModel can take a URL. 
    // In the sandbox, we have relaxed CSP, so we can run the wasm.
    model = await createModel(modelUrl);

    window.parent.postMessage({ type: 'INITIALIZED' }, '*');
}

function processAudio(float32Data: Float32Array | number[], sampleRate: number) {
    if (!model) {
        throw new Error('Model not initialized');
    }

    if (!recognizer) {
        recognizer = new model.KaldiRecognizer(sampleRate);
        recognizer.setWords(true);

        recognizer.on("result", (message: any) => {
            window.parent.postMessage({ type: 'STT_RESULT', result: message.result }, '*');
        });

        recognizer.on("partialresult", (message: any) => {
            window.parent.postMessage({ type: 'STT_PARTIAL', result: message.result }, '*');
        });
    }

    // Ensure data is Float32Array (it might be serialized as generic array via postMessage)
    // Actually, if transferred, it's Float32Array. If copied, also likely.

    // We need to create an AudioBuffer-like object or use correct method.
    // vosk-browser expects AudioBuffer check usually. 
    // Let's create a minimal AudioBuffer shim or use AudioContext if available?
    // Sandbox usually has AudioContext access.

    const buffer = new AudioBuffer({
        length: float32Data.length,
        numberOfChannels: 1,
        sampleRate: sampleRate
    });

    // Fix lint: cast to any to bypass ArrayBufferLike mismatch with copyToChannel in some TS envs
    const dataArray = float32Data instanceof Float32Array ? float32Data : new Float32Array(float32Data);
    buffer.copyToChannel(dataArray as any, 0);

    recognizer.acceptWaveform(buffer);
}

function cleanup() {
    if (recognizer) {
        recognizer.remove();
        recognizer = null;
    }
    if (model) {
        model.terminate();
        model = null;
    }
}
