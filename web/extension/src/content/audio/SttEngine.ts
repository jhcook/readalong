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
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sandboxFrame: HTMLIFrameElement | null = null;
  private isInitialized = false;

  // Placeholder URL - in a real app, you'd bundle a small model or download it
  private modelUrl = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';

  constructor(modelUrl?: string) {
    if (modelUrl) {
      this.modelUrl = modelUrl;
    }
  }

  async initialize(): Promise<void> {
    const tracer = trace.getTracer('readalong-extension');
    return tracer.startActiveSpan('SttEngine.initialize', async (span) => {
      if (this.isInitialized && this.sandboxFrame) {
        span.end();
        return;
      }

      try {
        // Create hidden iframe for sandbox
        this.sandboxFrame = document.createElement('iframe');
        this.sandboxFrame.style.display = 'none';
        this.sandboxFrame.src = chrome.runtime.getURL('sandbox.html');
        document.body.appendChild(this.sandboxFrame);

        // Wait for iframe to load? 
        // We can listen for an INITIALIZED message or just wait for onload.
        await new Promise<void>((resolve) => {
          if (this.sandboxFrame) {
            this.sandboxFrame.onload = () => resolve();
          }
        });

        // Setup message listener
        window.addEventListener('message', this.handleSandboxMessage);

        // Send initialization command
        this.sandboxFrame.contentWindow?.postMessage({
          type: 'INITIALIZE',
          modelUrl: this.modelUrl
        }, '*');

        // Wait for confirmation?
        // Let's assume initialized for now or track state via message
        this.isInitialized = true;

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

  private handleSandboxMessage = (event: MessageEvent) => {
    // Security check: ensure origin? 
    // Extensions are tricky, but checking if source matches our iframe contentWindow is good.
    if (event.source !== this.sandboxFrame?.contentWindow) return;

    const { type, result, error } = event.data;

    if (type === 'STT_RESULT') {
      window.dispatchEvent(new CustomEvent('stt-result', { detail: result }));
    } else if (type === 'STT_PARTIAL') {
      window.dispatchEvent(new CustomEvent('stt-partial', { detail: result }));
    } else if (type === 'ERROR') {
      console.error('[SttEngine] Sandbox error:', error);
    }
  };

  async start(stream: MediaStream): Promise<void> {
    const tracer = trace.getTracer('readalong-extension');
    return tracer.startActiveSpan('SttEngine.start', async (span) => {
      try {
        if (!this.isInitialized || !this.sandboxFrame) {
          await this.initialize();
        }

        this.audioContext = new AudioContext();
        await this.audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio-processor.js'));
        this.source = this.audioContext.createMediaStreamSource(stream);

        // Send Sample Rate to Sandbox?
        // Actually the sandbox might need to create a recognizer with specific sample rate.
        // We do that lazily in sandbox's PROCESS_AUDIO or sends a CONFIG message.
        // For now, let's assume sandbox handles it on first data or we can assume standard 16k/44.1k
        // The sandbox.ts logic currently initializes recognizer on first chunk using passed sampleRate.

        this.workletNode = new AudioWorkletNode(this.audioContext, 'stt-processor');

        this.workletNode.port.onmessage = (event) => {
          try {
            const float32Data = event.data; // Should be Float32Array
            // Send to sandbox
            if (this.sandboxFrame?.contentWindow) {
              this.sandboxFrame.contentWindow.postMessage({
                type: 'PROCESS_AUDIO',
                data: float32Data, // Structured clone should handle this efficiently
                sampleRate: this.audioContext?.sampleRate || 48000
              }, '*');
            }
          } catch (error) {
            console.error('Failed to forward audio to sandbox', error);
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
    window.removeEventListener('message', this.handleSandboxMessage);

    if (this.sandboxFrame) {
      this.sandboxFrame.contentWindow?.postMessage({ type: 'TERMINATE' }, '*');
      // Give it a moment? Then remove.
      setTimeout(() => {
        if (this.sandboxFrame && this.sandboxFrame.parentNode) {
          this.sandboxFrame.parentNode.removeChild(this.sandboxFrame);
        }
        this.sandboxFrame = null;
      }, 100);
    }
    this.isInitialized = false;
  }
}
