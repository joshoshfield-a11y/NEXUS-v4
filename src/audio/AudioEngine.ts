import type { AudioFrameState, BandName } from "../core/Types";
import { BAND_NAMES } from "../core/Types";
import { BAND_DEFINITIONS, createBandSplitter, type BandChannel } from "./BandSplitter";
import { TransientDetector } from "./TransientDetector";

export type AudioSourceKind = "none" | "file" | "mic";

/**
 * WebAudio front-end: file or mic input, parallel biquad band split, and
 * per-band transient detection. Produces normalized 0..1 signals plus
 * discrete onsets, sampled once per frame.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private element: HTMLAudioElement | null = null;
  private elementSource: MediaElementAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private channels: BandChannel[] = [];
  private detectors = new Map<BandName, TransientDetector>();

  private timeBuffer = new Float32Array(1024);
  private spectrum = new Float32Array(512);
  private state: AudioFrameState = {
    bands: { sub: 0, kick: 0, snare: 0, vocals: 0, hats: 0 },
    onsets: { sub: false, kick: false, snare: false, vocals: false, hats: false, global: false },
    spectrum: new Float32Array(512),
  };

  kind: AudioSourceKind = "none";
  objectUrl: string | null = null;

  get context() {
    return this.ctx;
  }

  get audioElement() {
    return this.element;
  }

  get isReady() {
    return this.ctx !== null;
  }

  async initialize(): Promise<void> {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error("WebAudio is not supported in this browser.");

    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.65;

    this.masterGain.connect(this.analyser);
    this.masterGain.connect(ctx.destination);

    this.channels = createBandSplitter(ctx, this.masterGain);

    // Detectors run over decimated time-domain samples (every 4th sample).
    const detectorRate = ctx.sampleRate / 4;
    for (const def of BAND_DEFINITIONS) {
      const [fa, fr, sa, sr, ratio, gain] = def.detector;
      this.detectors.set(def.name, new TransientDetector(detectorRate, fa, fr, sa, sr, ratio, gain));
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  async loadFile(file: File): Promise<HTMLAudioElement> {
    await this.initialize();
    const ctx = this.ctx!;
    this.disconnectSources();

    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);

    const el = new Audio();
    el.src = this.objectUrl;
    el.crossOrigin = "anonymous";
    el.loop = true;
    el.preload = "auto";
    this.element = el;

    this.elementSource = ctx.createMediaElementSource(el);
    this.elementSource.connect(this.masterGain!);
    this.kind = "file";

    await new Promise<void>((resolve, reject) => {
      el.addEventListener("loadedmetadata", () => resolve(), { once: true });
      el.addEventListener("error", () => reject(new Error("Could not decode that audio file.")), {
        once: true,
      });
    });
    return el;
  }

  async useMicrophone(): Promise<void> {
    await this.initialize();
    const ctx = this.ctx!;
    this.disconnectSources();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.micStream = stream;
    this.micSource = ctx.createMediaStreamSource(stream);

    // Route mic through the band bank but not to the speakers (feedback).
    const tap = ctx.createGain();
    tap.gain.value = 1;
    this.micSource.connect(this.masterGain!);
    this.masterGain!.disconnect(ctx.destination);
    this.kind = "mic";
    await this.resume();
  }

  private disconnectSources() {
    if (this.elementSource) {
      this.elementSource.disconnect();
      this.elementSource = null;
    }
    if (this.element) {
      this.element.pause();
      this.element = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) track.stop();
      this.micStream = null;
    }
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.connect(this.ctx.destination);
      } catch {
        /* already connected */
      }
    }
    for (const d of this.detectors.values()) d.reset();
    this.kind = "none";
  }

  stop() {
    this.disconnectSources();
  }

  /** Samples all bands once; call exactly once per rendered frame. */
  sample(): AudioFrameState {
    const ctx = this.ctx;
    if (!ctx || this.kind === "none") {
      for (const name of BAND_NAMES) {
        this.state.bands[name] *= 0.9;
        this.state.onsets[name] = false;
      }
      this.state.onsets.global = false;
      return this.state;
    }

    const now = ctx.currentTime;
    let onsetCount = 0;

    for (const channel of this.channels) {
      const detector = this.detectors.get(channel.name);
      if (!detector) continue;
      channel.analyser.getFloatTimeDomainData(this.timeBuffer);

      let envelope = 0;
      let onset = false;
      for (let i = 0; i < this.timeBuffer.length; i += 4) {
        const sampleTime = now + (i / this.timeBuffer.length) * 0.016;
        const result = detector.process(this.timeBuffer[i] ?? 0, sampleTime);
        envelope = result.envelope;
        if (result.isOnset) onset = true;
      }

      this.state.bands[channel.name] = Math.min(1, envelope);
      this.state.onsets[channel.name] = onset;
      if (onset) onsetCount++;
    }

    this.state.onsets.global = onsetCount > 0;

    if (this.analyser) {
      this.analyser.getFloatFrequencyData(this.spectrum);
      for (let i = 0; i < this.spectrum.length; i++) {
        // dB (-100..0) -> 0..1
        this.state.spectrum[i] = Math.max(0, Math.min(1, ((this.spectrum[i] ?? -100) + 100) / 100));
      }
    }

    return this.state;
  }

  destroy() {
    this.disconnectSources();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
