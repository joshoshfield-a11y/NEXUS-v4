import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { loadGraph, saveGraph, defaultGraph, type NexusGraph, type GraphNode } from './graph/GraphStore';
import { TopologicalEvaluator } from './graph/TopologicalEvaluator';
import { NODE_DEFINITIONS } from './graph/NodeRegistry';
import type { RenderFrame, BandName } from './core/Types';

const BAND_COLORS: Record<BandName, string> = {
  sub: '#ff0055',
  kick: '#00ff88',
  snare: '#ffaa00',
  vocals: '#0088ff',
  hats: '#cc44ff',
};

const evaluator = new TopologicalEvaluator();

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vizCanvasRef = useRef<HTMLCanvasElement>(null);
  const [audio] = useState(() => new AudioEngine());
  const [graph, setGraph] = useState<NexusGraph>(loadGraph);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [bandLevels, setBandLevels] = useState<Record<BandName, number>>({
    sub: 0, kick: 0, snare: 0, vocals: 0, hats: 0,
  });
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

      setBandLevels({ ...audioState.bands });
      drawVisualizer(audioState.spectrum);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audio]);

  const drawVisualizer = useCallback((spectrum: Float32Array) => {
    const canvas = vizCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    const bars = 64;
    const barW = w / bars;
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * (spectrum.length / 2));
      const val = spectrum[idx] ?? 0;
      const barH = val * h * 0.9;
      const hue = (i / bars) * 280 + 160;
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${0.5 + val * 0.5})`;
      ctx.fillRect(i * barW, h - barH, barW - 1, barH);
    }
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await audio.loadFile(file);
      audio.audioElement?.play();
      setIsPlaying(true);
    } catch (err) {
      alert('Could not load audio file: ' + (err as Error).message);
    }
  };

  const handleMic = async () => {
    try {
      await audio.useMicrophone();
      setIsPlaying(true);
    } catch (err) {
      alert('Microphone access denied or not available.');
    }
  };

  const handleStop = () => {
    audio.stop();
    setIsPlaying(false);
    setBandLevels({ sub: 0, kick: 0, snare: 0, vocals: 0, hats: 0 });
  };

  const handleResetGraph = () => {
    setGraph(defaultGraph());
  };

  const updateNodeParam = (nodeId: string, key: string, value: number) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n
      ),
    }));
  };

  const selectedNodeData = selectedNode
    ? graph.nodes.find((n) => n.id === selectedNode)
    : null;

  return (
    <div
      style={{
        background: '#0a0a0f',
        color: '#e0e0ff',
        minHeight: '100vh',
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>
            NEXUS <span style={{ color: '#00d4aa' }}>v4</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6666aa' }}>
            Audio-Reactive WebGPU Engine
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isPlaying ? '#00ff88' : '#ff4444',
              boxShadow: isPlaying ? '0 0 8px #00ff88' : 'none',
              transition: 'all 0.3s',
            }}
          />
          <span style={{ fontSize: 12, color: '#8888bb' }}>
            {isPlaying ? 'ENGINE ACTIVE' : 'STANDBY'}
          </span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            width: 320,
            borderRight: '1px solid #1a1a2e',
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <section>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, textTransform: 'uppercase', color: '#6666aa', letterSpacing: 1 }}>
              Audio Input
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: '#12121f',
                  border: '1px dashed #333355',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00d4aa')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333355')}
              >
                <span>📁</span> Drop Audio File
                <input type="file" accept="audio/*" onChange={handleFile} style={{ display: 'none' }} />
              </label>
              <button
                onClick={handleMic}
                style={{
                  padding: '12px 16px',
                  background: '#12121f',
                  border: '1px solid #333355',
                  borderRadius: 8,
                  color: '#e0e0ff',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>🎤</span> Use Microphone
              </button>
              <button
                onClick={handleStop}
                style={{
                  padding: '12px 16px',
                  background: '#1a0a0a',
                  border: '1px solid #552222',
                  borderRadius: 8,
                  color: '#ff6666',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                ⏹ Stop
              </button>
            </div>
          </section>

          <section>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, textTransform: 'uppercase', color: '#6666aa', letterSpacing: 1 }}>
              Band Analysis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.entries(bandLevels) as [BandName, number][]).map(([name, level]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 50, fontSize: 11, textTransform: 'uppercase', color: '#8888bb' }}>
                    {name}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 20,
                      background: '#12121f',
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, level * 100)}%`,
                        height: '100%',
                        background: BAND_COLORS[name],
                        borderRadius: 4,
                        transition: 'width 0.05s linear',
                        boxShadow: level > 0.5 ? `0 0 8px ${BAND_COLORS[name]}` : 'none',
                      }}
                    />
                  </div>
                  <span style={{ width: 36, fontSize: 11, color: '#6666aa', textAlign: 'right' }}>
                    {(level * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, textTransform: 'uppercase', color: '#6666aa', letterSpacing: 1 }}>
              Spectrum
            </h3>
            <canvas
              ref={vizCanvasRef}
              width={280}
              height={80}
              style={{ width: '100%', height: 80, borderRadius: 8, background: '#08080f' }}
            />
          </section>

          <section>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, textTransform: 'uppercase', color: '#6666aa', letterSpacing: 1 }}>
              Node Graph
            </h3>
            <button
              onClick={handleResetGraph}
              style={{
                padding: '10px 16px',
                background: '#12121f',
                border: '1px solid #333355',
                borderRadius: 8,
                color: '#e0e0ff',
                cursor: 'pointer',
                fontSize: 12,
                width: '100%',
              }}
            >
              ↺ Reset to Default Patch
            </button>
            <p style={{ fontSize: 11, color: '#555577', marginTop: 8 }}>
              {graph.nodes.length} nodes · {graph.edges.length} edges
            </p>
          </section>
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', background: '#06060c' }}
          />
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              bottom: 16,
              pointerEvents: 'none',
            }}
          >
            <svg width="100%" height="100%" style={{ pointerEvents: 'auto' }}>
              {graph.edges.map((edge) => {
                const from = graph.nodes.find((n) => n.id === edge.from);
                const to = graph.nodes.find((n) => n.id === edge.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={edge.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#333355"
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                );
              })}
              {graph.nodes.map((node) => {
                const def = NODE_DEFINITIONS[node.type];
                const isSelected = selectedNode === node.id;
                const value = frameRef.current.graph[node.id] ?? 0;
                const isActive = value > 0.01;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={-60}
                      y={-20}
                      width={120}
                      height={40}
                      rx={6}
                      fill={isSelected ? '#1a1a3a' : '#12121f'}
                      stroke={isSelected ? '#00d4aa' : isActive ? '#4444aa' : '#222244'}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    <text
                      x={0}
                      y={-4}
                      textAnchor="middle"
                      fill={isActive ? '#e0e0ff' : '#8888bb'}
                      fontSize={10}
                      fontWeight={600}
                    >
                      {def.label}
                    </text>
                    <text
                      x={0}
                      y={10}
                      textAnchor="middle"
                      fill="#555577"
                      fontSize={9}
                    >
                      {node.option || ''} {value > 0.01 ? `· ${value.toFixed(2)}` : ''}
                    </text>
                    {isActive && (
                      <circle
                        cx={50}
                        cy={-10}
                        r={3}
                        fill="#00ff88"
                        opacity={Math.min(1, value)}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div
          style={{
            width: 280,
            borderLeft: '1px solid #1a1a2e',
            padding: 20,
            overflowY: 'auto',
          }}
        >
          {selectedNodeData ? (
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, color: '#e0e0ff' }}>
                {NODE_DEFINITIONS[selectedNodeData.type].label}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 11, color: '#6666aa' }}>
                {NODE_DEFINITIONS[selectedNodeData.type].description}
              </p>

              {selectedNodeData.option && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, textTransform: 'uppercase', color: '#6666aa', letterSpacing: 1 }}>
                    Option
                  </label>
                  <div
                    style={{
                      marginTop: 4,
                      padding: '8px 12px',
                      background: '#12121f',
                      borderRadius: 6,
                      fontSize: 13,
                      color: '#e0e0ff',
                    }}
                  >
                    {selectedNodeData.option}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {NODE_DEFINITIONS[selectedNodeData.type].params.map((param) => (
                  <div key={param.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', color: '#6666aa', letterSpacing: 1 }}>
                        {param.label}
                      </label>
                      <span style={{ fontSize: 11, color: '#00d4aa', fontFamily: 'monospace' }}>
                        {selectedNodeData.params[param.key]?.toFixed(2) ?? param.default}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={selectedNodeData.params[param.key] ?? param.default}
                      onChange={(e) =>
                        updateNodeParam(selectedNodeData.id, param.key, parseFloat(e.target.value))
                      }
                      style={{ width: '100%', accentColor: '#00d4aa' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1a1a2e' }}>
                <label style={{ fontSize: 10, textTransform: 'uppercase', color: '#6666aa', letterSpacing: 1 }}>
                  Live Value
                </label>
                <div
                  style={{
                    marginTop: 8,
                    padding: '12px',
                    background: '#12121f',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    fontSize: 18,
                    color: '#00ff88',
                    textAlign: 'center',
                  }}
                >
                  {(frameRef.current.graph[selectedNodeData.id] ?? 0).toFixed(4)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <p style={{ color: '#444466', fontSize: 13 }}>
                Select a node in the graph to inspect and edit its parameters.
              </p>
            </div>
          )}
        </div>
      </div>

      <footer
        style={{
          padding: '12px 24px',
          borderTop: '1px solid #1a1a2e',
          fontSize: 11,
          color: '#444466',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>NEXUS v4 · MIT License</span>
        <span>github.com/joshoshfield-a11y/NEXUS-v4</span>
      </footer>
    </div>
  );
}

export default App;
