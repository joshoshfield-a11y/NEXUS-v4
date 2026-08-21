export type BandName = "sub" | "kick" | "snare" | "vocals" | "hats";

export const BAND_NAMES: BandName[] = ["sub", "kick", "snare", "vocals", "hats"];

export interface AudioFrameState {
  bands: Record<BandName, number>;
  onsets: Record<BandName | "global", boolean>;
  spectrum: Float32Array;
}

export interface RenderFrame {
  time: number;
  deltaTime: number;
  particles: {
    velocity: number;
    size: number;
    noiseScale: number;
    lifespan: number;
  };
  camera: {
    shake: number;
    fov: number;
    azimuth: number;
    elevation: number;
  };
  mesh: {
    displacement: number;
    emissive: number;
    roughness: number;
    metallic: number;
    wireframe: number;
  };
  post: {
    bloom: number;
    chromaticAberration: number;
    glitch: number;
    scanline: number;
    vignette: number;
    hue: number;
  };
  graph: Record<string, number>;
}
