# NEXUS v4

**Audio-Reactive WebGPU Engine**

Real-time audio analysis → band-split transient detection → DAG node graph → WebGPU particle & mesh rendering.

## Architecture

| Layer | File | Purpose |
|---|---|---|
| Audio | `src/audio/AudioEngine.ts` | WebAudio input, 5-band biquad split, transient detection |
| Graph | `src/graph/GraphStore.ts` | Node/edge storage, default patch, localStorage persistence |
| Graph | `src/graph/NodeRegistry.ts` | 13 node types, 18 destination targets |
| Graph | `src/graph/TopologicalEvaluator.ts` | Cycle-checked DAG evaluator, frame-by-frame |
| Mesh | `src/mesh/Icosphere.ts` | Subdivided icosahedron with barycentrics |
| Shaders | `src/shaders/common.wgsl` | Uniforms, hash, noise, hue rotation |
| Shaders | `src/shaders/particles.wgsl` | Compute simulation + instanced billboard rendering |

## Quick Start

```bash
npm install
npm run dev
```

Drop an audio file or use microphone input. The default patch maps:
- **Kick** → mesh displacement
- **Snare** → chromatic aberration
- **Sub** → camera shake
- **Vocals** → mesh emissive glow
- **Hats** → particle velocity
- **LFO** → hue rotation

## Node Types

| Type | Kind | Description |
|---|---|---|
| band | source | Frequency band envelope |
| onset | source | Transient trigger with decay |
| lfo | source | Free-running oscillator |
| constant | source | Fixed value |
| time | source | Scaled elapsed time |
| multiply | operator | a × b × factor |
| add | operator | a + b + offset |
| clamp | operator | Min/max limiter |
| curve | operator | Exponential/logarithmic/smoothstep/invert |
| smooth | operator | Slew limiter |
| sampleHold | operator | Latch on trigger crossing |
| threshold | operator | Gate with hard/soft modes |
| destination | destination | Writes to render frame |

## Stack

React 19 · TypeScript · Vite · WebGPU · WebAudio API
