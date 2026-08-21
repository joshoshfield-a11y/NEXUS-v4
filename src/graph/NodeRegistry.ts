import type { RenderFrame } from "../core/Types";

export type NodeKind = "source" | "operator" | "destination";

export type NodeType =
  | "band"
  | "onset"
  | "lfo"
  | "constant"
  | "time"
  | "multiply"
  | "add"
  | "clamp"
  | "curve"
  | "smooth"
  | "sampleHold"
  | "threshold"
  | "destination";

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface NodeDefinition {
  type: NodeType;
  kind: NodeKind;
  label: string;
  description: string;
  inputs: string[];
  params: ParamSpec[];
  /** Selectable option (band name, LFO shape, destination target...). */
  options?: { key: string; values: string[]; default: string };
}

/** Every RenderFrame field a destination node may drive. */
export interface DestinationTarget {
  path: string;
  label: string;
  group: string;
  min: number;
  max: number;
}

export const DESTINATION_TARGETS: DestinationTarget[] = [
  { path: "particles.velocity", label: "Particle velocity", group: "Particles", min: 0, max: 4 },
  { path: "particles.size", label: "Particle size", group: "Particles", min: 0.2, max: 8 },
  { path: "particles.noiseScale", label: "Noise scale", group: "Particles", min: 0.05, max: 4 },
  { path: "particles.lifespan", label: "Lifespan", group: "Particles", min: 0.5, max: 12 },
  { path: "camera.shake", label: "Camera shake", group: "Camera", min: 0, max: 1 },
  { path: "camera.fov", label: "Field of view", group: "Camera", min: 20, max: 110 },
  { path: "camera.azimuth", label: "Orbit", group: "Camera", min: -3.2, max: 3.2 },
  { path: "camera.elevation", label: "Elevation", group: "Camera", min: -1.2, max: 1.2 },
  { path: "mesh.displacement", label: "Mesh displacement", group: "Mesh", min: 0, max: 1.5 },
  { path: "mesh.emissive", label: "Glow / emissive", group: "Mesh", min: 0, max: 3 },
  { path: "mesh.roughness", label: "Roughness", group: "Mesh", min: 0.03, max: 1 },
  { path: "mesh.metallic", label: "Metallic", group: "Mesh", min: 0, max: 1 },
  { path: "mesh.wireframe", label: "Wireframe mix", group: "Mesh", min: 0, max: 1 },
  { path: "post.bloom", label: "Bloom", group: "Post", min: 0, max: 2 },
  {
    path: "post.chromaticAberration",
    label: "Chromatic aberration",
    group: "Post",
    min: 0,
    max: 1,
  },
  { path: "post.glitch", label: "Glitch threshold", group: "Post", min: 0, max: 1 },
  { path: "post.scanline", label: "Scanline tear", group: "Post", min: 0, max: 1 },
  { path: "post.vignette", label: "Vignette", group: "Post", min: 0, max: 1 },
  { path: "post.hue", label: "Hue shift", group: "Post", min: -1, max: 1 },
];

export const BAND_OPTIONS = ["sub", "kick", "snare", "vocals", "hats"];
export const ONSET_OPTIONS = ["kick", "snare", "hats", "sub", "vocals", "global"];
export const LFO_SHAPES = ["sine", "triangle", "saw", "square", "noise"];
export const CURVE_SHAPES = ["exponential", "logarithmic", "smoothstep", "invert"];

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  band: {
    type: "band",
    kind: "source",
    label: "Band Envelope",
    description: "Normalized 0-1 envelope of one frequency band.",
    inputs: [],
    params: [{ key: "gain", label: "Gain", min: 0, max: 4, step: 0.01, default: 1 }],
    options: { key: "band", values: BAND_OPTIONS, default: "kick" },
  },
  onset: {
    type: "onset",
    kind: "source",
    label: "Onset Trigger",
    description: "Fires to 1.0 on a transient, then decays.",
    inputs: [],
    params: [{ key: "decay", label: "Decay (s)", min: 0.02, max: 2, step: 0.01, default: 0.18 }],
    options: { key: "band", values: ONSET_OPTIONS, default: "kick" },
  },
  lfo: {
    type: "lfo",
    kind: "source",
    label: "LFO",
    description: "Free-running oscillator driven by frame time.",
    inputs: [],
    params: [
      { key: "rate", label: "Rate (Hz)", min: 0.01, max: 12, step: 0.01, default: 0.5 },
      { key: "phase", label: "Phase", min: 0, max: 1, step: 0.01, default: 0 },
    ],
    options: { key: "shape", values: LFO_SHAPES, default: "sine" },
  },
  constant: {
    type: "constant",
    kind: "source",
    label: "Constant",
    description: "A fixed value.",
    inputs: [],
    params: [{ key: "value", label: "Value", min: -4, max: 4, step: 0.01, default: 1 }],
  },
  time: {
    type: "time",
    kind: "source",
    label: "Time",
    description: "Elapsed frame time multiplied by a scale.",
    inputs: [],
    params: [{ key: "scale", label: "Scale", min: 0, max: 2, step: 0.01, default: 0.1 }],
  },
  multiply: {
    type: "multiply",
    kind: "operator",
    label: "Multiply",
    description: "a * b (b falls back to the factor param).",
    inputs: ["a", "b"],
    params: [{ key: "factor", label: "Factor", min: -8, max: 8, step: 0.01, default: 1 }],
  },
  add: {
    type: "add",
    kind: "operator",
    label: "Add",
    description: "a + b + offset.",
    inputs: ["a", "b"],
    params: [{ key: "offset", label: "Offset", min: -4, max: 4, step: 0.01, default: 0 }],
  },
  clamp: {
    type: "clamp",
    kind: "operator",
    label: "Clamp",
    description: "Limits the signal to a range.",
    inputs: ["in"],
    params: [
      { key: "min", label: "Min", min: -4, max: 4, step: 0.01, default: 0 },
      { key: "max", label: "Max", min: -4, max: 4, step: 0.01, default: 1 },
    ],
  },
  curve: {
    type: "curve",
    kind: "operator",
    label: "Curve",
    description: "Reshapes the 0-1 response.",
    inputs: ["in"],
    params: [{ key: "amount", label: "Amount", min: 0.1, max: 6, step: 0.01, default: 2 }],
    options: { key: "shape", values: CURVE_SHAPES, default: "exponential" },
  },
  smooth: {
    type: "smooth",
    kind: "operator",
    label: "Smooth",
    description: "Time-based slew limiter (0 = instant).",
    inputs: ["in"],
    params: [{ key: "amount", label: "Amount", min: 0, max: 0.99, step: 0.01, default: 0.15 }],
  },
  sampleHold: {
    type: "sampleHold",
    kind: "operator",
    label: "Sample & Hold",
    description: "Latches the input whenever the trigger crosses 0.5.",
    inputs: ["in", "trigger"],
    params: [],
  },
  threshold: {
    type: "threshold",
    kind: "operator",
    label: "Threshold",
    description: "Gate: 0 below the level, passthrough above.",
    inputs: ["in"],
    params: [
      { key: "level", label: "Level", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "hard", label: "Hard gate", min: 0, max: 1, step: 1, default: 0 },
    ],
  },
  destination: {
    type: "destination",
    kind: "destination",
    label: "Destination",
    description: "Writes base + amount * signal into the render frame.",
    inputs: ["in"],
    params: [
      { key: "base", label: "Base", min: -4, max: 4, step: 0.01, default: 0 },
      { key: "amount", label: "Amount", min: -8, max: 8, step: 0.01, default: 1 },
    ],
    options: {
      key: "target",
      values: DESTINATION_TARGETS.map((t) => t.path),
      default: "mesh.displacement",
    },
  },
};

export const NODE_TYPES = Object.keys(NODE_DEFINITIONS) as NodeType[];

export function getTarget(path: string): DestinationTarget | undefined {
  return DESTINATION_TARGETS.find((t) => t.path === path);
}

export function applyToFrame(frame: RenderFrame, path: string, value: number) {
  const target = getTarget(path);
  if (!target) return;
  const clamped = Math.min(target.max, Math.max(target.min, value));
  const [group, key] = path.split(".") as [keyof RenderFrame, string];
  const bucket = frame[group] as unknown as Record<string, number>;
  if (bucket && typeof bucket === "object") bucket[key] = clamped;
}
