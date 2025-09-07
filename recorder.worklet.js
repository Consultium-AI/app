class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRateOut = 16000;
    this.frameSamples = Math.floor(this.sampleRateOut * 0.02); // 20ms = 320 samples
    this._buffer = new Float32Array(0);
  }

  static get parameterDescriptors() { return []; }

  _downsampleTo16k(input) {
    const inRate = sampleRate; // AudioWorklet global
    if (inRate === this.sampleRateOut) return input;
    const ratio = inRate / this.sampleRateOut;
    const outLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outLength);
    let idx = 0;
    for (let i = 0; i < outLength; i++) {
      output[i] = input[Math.floor(idx)];
      idx += ratio;
    }
    return output;
  }

  _floatToPCM16(float32) {
    const out = new Uint8Array(float32.length * 2);
    let offset = 0;
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      const val = s | 0;
      out[offset++] = val & 0xff;
      out[offset++] = (val >> 8) & 0xff;
    }
    return out;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0];
    if (!ch0) return true;

    // downsample and append to internal buffer
    const ds = this._downsampleTo16k(ch0);
    const merged = new Float32Array(this._buffer.length + ds.length);
    merged.set(this._buffer, 0);
    merged.set(ds, this._buffer.length);
    this._buffer = merged;

    // emit 20ms frames
    while (this._buffer.length >= this.frameSamples) {
      const frame = this._buffer.slice(0, this.frameSamples);
      this._buffer = this._buffer.slice(this.frameSamples);
      const pcm = this._floatToPCM16(frame);
      this.port.postMessage(pcm);
    }

    return true;
  }
}

registerProcessor('pcm-recorder', PCMRecorderProcessor);
