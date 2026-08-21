import type { BandName } from "../core/Types";

export interface BandChannel {
  name: BandName;
  filter: BiquadFilterNode;
  analyser: AnalyserNode;
}

export interface BandDefinition {
  name: BandName;
  freq: number;
  q: number;
  detector: [number, number, number, number, number, number];
}

export const BAND_DEFINITIONS: BandDefinition[] = [
  { name: "sub",    freq: 60,   q: 1.2, detector: [0.01, 0.05, 0.02, 0.08, 3.0, 1.0] },
  { name: "kick",   freq: 120,  q: 1.5, detector: [0.01, 0.04, 0.015, 0.06, 2.5, 1.2] },
  { name: "snare",  freq: 240,  q: 1.8, detector: [0.008, 0.03, 0.012, 0.05, 2.0, 1.5] },
  { name: "vocals", freq: 2000, q: 2.0, detector: [0.005, 0.02, 0.01, 0.04, 1.5, 2.0] },
  { name: "hats",   freq: 8000, q: 2.5, detector: [0.003, 0.015, 0.008, 0.03, 1.0, 3.0] },
];

export function createBandSplitter(ctx: AudioContext, destination: AudioNode): BandChannel[] {
  return BAND_DEFINITIONS.map((def) => {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = def.freq;
    filter.Q.value = def.q;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.3;

    destination.connect(filter);
    filter.connect(analyser);

    return { name: def.name, filter, analyser };
  });
}
