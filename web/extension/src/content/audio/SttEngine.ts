import { createModel, KaldiRecognizer, Model } from 'vosk-browser';

export interface TranscriptionResult {
  text: string;
  result?: Array<{
    conf: number;
    start: number;
    end: number;
    word: string;
  }>;
}

export class SttEngine {
  private model: Model | null = null;
  private recognizer: KaldiRecognizer | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;

  // Placeholder URL - in a real app, you'd bundle a small model or download it
  private modelUrl = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
  private sampleRate = 16000;

  constructor(modelUrl?: string) {
    if (modelUrl) {
      this.modelUrl = modelUrl;
    }
  }

  async initialize(): Promise<void> {
    if (this.model) return;

    try {
      // Caching logic
      const cacheName = 'readalong-models-v1';
      const cache = await caches.open(cacheName);
      let response = await cache.match(this.modelUrl);
      let modelSource: string | Blob = this.modelUrl;

      if (!response) {
        try {
          console.log('Fetching model to cache...');
          // If we are online, fetch and cache
          if (navigator.onLine) {
            response = await fetch(this.modelUrl);
            if (response.ok) {
              cache.put(this.modelUrl, response.clone());
              console.log('Model cached.');
            }
          }
        } catch (e) {
          console.warn('Failed to fetch/cache model:', e);
        }
      }

      if (response) {
        console.log('Loading model from cache...');
        modelSource = await response.blob();
      }

      // Create the model - this spawns a web worker
      // createModel can accept a URL string or a Blob/File if passing a path isn't possible?
      // vosk-browser createModel signature: (modelUrl: string, logLevel?: number) => Promise<Model>
      // Wait, the types say `modelUrl: string`. 
      // Does it support object URLs? Yes, usually.
      
      if (modelSource instanceof Blob) {
        modelSource = URL.createObjectURL(modelSource);
      }

      this.model = await createModel(modelSource);
      
      // Create a recognizer
      this.recognizer = new this.model.KaldiRecognizer(this.sampleRate);
      this.recognizer.setWords(true); // Enable word timestamps

      this.recognizer.on("result", (message: any) => {
        console.log(`STT Result: ${message.result.text}`, message.result);
        // Dispatch custom event or callback
        const event = new CustomEvent('stt-result', { detail: message.result });
        window.dispatchEvent(event);
      });

      this.recognizer.on("partialresult", (message: any) => {
        // console.log(`STT Partial: ${message.result.partial}`);
        const event = new CustomEvent('stt-partial', { detail: message.result });
        window.dispatchEvent(event);
      });

      console.log('SttEngine initialized');
    } catch (error) {
      console.error('Failed to initialize SttEngine:', error);
      throw error;
    }
  }

  async start(stream: MediaStream): Promise<void> {
    if (!this.model || !this.recognizer) {
      await this.initialize();
    }

    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaStreamSource(stream);
    
    // Create a ScriptProcessorNode with a bufferSize of 4096 and a single input and output channel
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      try {
        if (this.recognizer) {
          this.recognizer.acceptWaveform(event.inputBuffer);
        }
      } catch (error) {
        console.error('acceptWaveform failed', error);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination); // Needed for the processor to run
  }

  stop(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  terminate(): void {
    this.stop();
    if (this.recognizer) {
      this.recognizer.remove();
      this.recognizer = null;
    }
    if (this.model) {
      this.model.terminate();
      this.model = null;
    }
  }
}
