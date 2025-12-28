import { createModel, KaldiRecognizer, Model } from 'vosk-browser';
import { trace } from '@opentelemetry/api';

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
  private workletNode: AudioWorkletNode | null = null;

  // Placeholder URL - in a real app, you'd bundle a small model or download it
  private modelUrl = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
  private sampleRate = 16000;

  constructor(modelUrl?: string) {
    if (modelUrl) {
      this.modelUrl = modelUrl;
    }
  }

  async initialize(): Promise<void> {
    const tracer = trace.getTracer('readalong-extension');
    return tracer.startActiveSpan('SttEngine.initialize', async (span) => {
      if (this.model) {
        span.end();
        return;
      }

      try {
        // Caching logic
        const cacheName = 'readalong-models-v1';
        const cache = await caches.open(cacheName);
        let response = await cache.match(this.modelUrl);
        let modelSource: string | Blob = this.modelUrl;

        if (!response) {
          try {
            // If we are online, fetch and cache
            if (navigator.onLine) {
              response = await fetch(this.modelUrl);
              if (response.ok) {
                cache.put(this.modelUrl, response.clone());
                cache.put(this.modelUrl, response.clone());
              }
            }
          } catch (e) {
            console.warn('Failed to fetch/cache model:', e);
          }
        }

        if (response) {
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

        // Recognizer creation is now deferred to start() to allow dynamic sample rate usage

      } catch (error) {
        console.error('Failed to initialize SttEngine:', error);
        span.recordException(error as Error);
        span.setStatus({ code: 2 }); // Error
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async start(stream: MediaStream): Promise<void> {
    const tracer = trace.getTracer('readalong-extension');
    return tracer.startActiveSpan('SttEngine.start', async (span) => {
      try {
        if (!this.model || !this.recognizer) {
          await this.initialize();
        }

        this.audioContext = new AudioContext();
        await this.audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio-processor.js'));
        this.source = this.audioContext.createMediaStreamSource(stream);

        // Initialize recognizer with the correct sample rate from the AudioContext
        if (this.recognizer) {
          this.recognizer.remove();
        }
        this.recognizer = new this.model!.KaldiRecognizer(this.audioContext.sampleRate);
        this.recognizer.setWords(true);
        this.recognizer.on("result", (message: any) => {
          const event = new CustomEvent('stt-result', { detail: message.result });
          window.dispatchEvent(event);
        });
        this.recognizer.on("partialresult", (message: any) => {
          const event = new CustomEvent('stt-partial', { detail: message.result });
          window.dispatchEvent(event);
        });

        this.workletNode = new AudioWorkletNode(this.audioContext, 'stt-processor');

        this.workletNode.port.onmessage = (event) => {
          try {
            if (this.recognizer && this.audioContext) {
              const float32Data = event.data as unknown as Float32Array;

              // Use a real AudioBuffer to ensure compatibility with vosk-browser's checks
              // This resolves "TypeError: U.getChannelData is not a function"
              const audioBuffer = this.audioContext.createBuffer(
                1,
                float32Data.length,
                this.audioContext.sampleRate
              );
              audioBuffer.copyToChannel(float32Data as any, 0);

              this.recognizer.acceptWaveform(audioBuffer);
            }
          } catch (error) {
            console.error('acceptWaveform failed', error);
          }
        };

        this.source.connect(this.workletNode);
        this.workletNode.connect(this.audioContext.destination);
      } catch (e) {
        span.recordException(e as Error);
        span.setStatus({ code: 2 });
        throw e;
      } finally {
        span.end();
      }
    });
  }

  stop(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
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
