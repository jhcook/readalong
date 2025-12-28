/**
 * AudioWorkletProcessor for handling real-time audio buffering.
 * Captures audio chunks and sends them to the main thread for Vosk processing.
 */
class SttProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];

      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];

        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage(this.buffer);
          this.buffer = new Float32Array(this.bufferSize); // Create new buffer to avoid race conditions
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('stt-processor', SttProcessor);
