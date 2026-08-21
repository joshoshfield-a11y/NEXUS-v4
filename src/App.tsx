import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { loadGraph, saveGraph, defaultGraph, type NexusGraph } from './graph/GraphStore';
import { TopologicalEvaluator } from './graph/TopologicalEvaluator';
import type { RenderFrame } from './core/Types';

const evaluator = new TopologicalEvaluator();

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audio] = useState(() => new AudioEngine());
  const [graph, setGraph] = useState<NexusGraph>(loadGraph);
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<RenderFrame>({
    time: 0,
    deltaTime: 0.016,
    particles: { velocity: 0, size: 0, noiseScale: 0, lifespan: 0 },
    camera: { shake: 0, fov: 60, azimuth: 0, elevation: 0 },
    mesh: { displacement: 0, emissive: 0, roughness: 0.5, metallic: 0, wireframe: 0 },
    post: { bloom: 0, chromaticAberration: 0, glitch: 0, scanline: 0, vignette: 0, hue: 0 },
    graph: {},
  });

  useEffect(() => {
    evaluator.setGraph(graph);
    saveGraph(graph);
  }, [graph]);

  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const frame = frameRef.current;
      frame.time += dt;
      frame.deltaTime = dt;

      const audioState = audio.sample();
      evaluator.evaluate(frame, audioState);

      // Render frame data is now populated — wire to WebGPU renderer here
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audio]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await audio.loadFile(file);
    audio.audioElement?.play();
    setIsPlaying(true);
  };

  const handleMic = async () => {
    await audio.useMicrophone();
    setIsPlaying(true);
  };

  return (
    <div style={{ background: '#0a0a0f', color: '#e0e0ff', minHeight: '100vh', padding: 20 }}>
      <h1>Nexus v4</h1>
      <p>Audio-Reactive WebGPU Engine</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input type="file" accept="audio/*" onChange={handleFile} />
        <button onClick={handleMic}>Use Microphone</button>
        <button onClick={() => { audio.stop(); setIsPlaying(false); }}>Stop</button>
      </div>
      <div>Status: {isPlaying ? '● Active' : '○ Idle'}</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 400, background: '#000', borderRadius: 8 }} />
      <pre style={{ fontSize: 12, marginTop: 20 }}>{JSON.stringify(frameRef.current.graph, null, 2)}</pre>
    </div>
  );
}

export default App;
