import type { AudioFrameState, BandName, RenderFrame } from "../core/Types";
import { applyToFrame, NODE_DEFINITIONS } from "./NodeRegistry";
import type { GraphNode, NexusGraph } from "./GraphStore";

interface NodeState {
  smooth: number;
  hold: number;
  lastTrigger: number;
  onsetEnv: number;
}

/**
 * Cycle-checked DAG evaluator. Pure with respect to wall-clock time: every
 * time-dependent value comes from the frame's `time` / `deltaTime`.
 */
export class TopologicalEvaluator {
  private states = new Map<string, NodeState>();
  private order: GraphNode[] = [];
  private graph: NexusGraph = { nodes: [], edges: [] };
  private values = new Map<string, number>();
  cycleDetected = false;

  setGraph(graph: NexusGraph) {
    this.graph = graph;
    this.order = this.sort(graph);
    for (const id of [...this.states.keys()]) {
      if (!graph.nodes.some((n) => n.id === id)) this.states.delete(id);
    }
  }

  reset() {
    this.states.clear();
    this.values.clear();
  }

  private state(id: string): NodeState {
    let s = this.states.get(id);
    if (!s) {
      s = { smooth: 0, hold: 0, lastTrigger: 0, onsetEnv: 0 };
      this.states.set(id, s);
    }
    return s;
  }

  private sort(graph: NexusGraph): GraphNode[] {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    for (const n of graph.nodes) {
      indegree.set(n.id, 0);
      outgoing.set(n.id, []);
    }
    for (const e of graph.edges) {
      if (!byId.has(e.from) || !byId.has(e.to)) continue;
      indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
      outgoing.get(e.from)?.push(e.to);
    }

    const queue = graph.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
    const sorted: GraphNode[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      const node = byId.get(id);
      if (node) sorted.push(node);
      for (const next of outgoing.get(id) ?? []) {
        const d = (indegree.get(next) ?? 1) - 1;
        indegree.set(next, d);
        if (d === 0) queue.push(next);
      }
    }

    this.cycleDetected = sorted.length !== graph.nodes.length;
    return sorted;
  }

  /** Evaluates the graph and writes destination values into `frame`. */
  evaluate(frame: RenderFrame, audio: AudioFrameState): Record<string, number> {
    const out: Record<string, number> = {};
    const dt = frame.deltaTime;
    this.values.clear();

    for (const node of this.order) {
      const def = NODE_DEFINITIONS[node.type];
      const state = this.state(node.id);
      const inputs: number[] = def.inputs.map((_, index) => {
        const edge = this.graph.edges.find((e) => e.to === node.id && e.input === index);
        return edge ? (this.values.get(edge.from) ?? 0) : Number.NaN;
      });
      const a = Number.isNaN(inputs[0] ?? Number.NaN) ? 0 : (inputs[0] as number);
      const hasA = !Number.isNaN(inputs[0] ?? Number.NaN);
      const p = node.params;
      let value = 0;

      switch (node.type) {
        case "band": {
          const band = (node.option ?? "kick") as BandName;
          value = (audio.bands[band] ?? 0) * (p["gain"] ?? 1);
          break;
        }
        case "onset": {
          const key = (node.option ?? "kick") as keyof AudioFrameState["onsets"];
          const decay = Math.max(0.02, p["decay"] ?? 0.18);
          if (audio.onsets[key]) state.onsetEnv = 1;
          else state.onsetEnv = Math.max(0, state.onsetEnv - dt / decay);
          value = state.onsetEnv;
          break;
        }
        case "lfo": {
          const rate = p["rate"] ?? 0.5;
          const phase = (frame.time * rate + (p["phase"] ?? 0)) % 1;
          switch (node.option) {
            case "triangle":
              value = 1 - Math.abs(phase * 2 - 1);
              break;
            case "saw":
              value = phase;
              break;
            case "square":
              value = phase < 0.5 ? 1 : 0;
              break;
            case "noise": {
              const s = Math.sin(Math.floor(phase * 16) * 127.1 + node.id.length * 13.7) * 43758.5453;
              value = s - Math.floor(s);
              break;
            }
            default:
              value = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
          }
          break;
        }
        case "constant":
          value = p["value"] ?? 1;
          break;
        case "time":
          value = frame.time * (p["scale"] ?? 0.1);
          break;
        case "multiply": {
          const hasB = !Number.isNaN(inputs[1] ?? Number.NaN);
          const b = hasB ? (inputs[1] as number) : 1;
          value = a * b * (p["factor"] ?? 1);
          break;
        }
        case "add": {
          const b = Number.isNaN(inputs[1] ?? Number.NaN) ? 0 : (inputs[1] as number);
          value = a + b + (p["offset"] ?? 0);
          break;
        }
        case "clamp":
          value = Math.min(p["max"] ?? 1, Math.max(p["min"] ?? 0, a));
          break;
        case "curve": {
          const amount = Math.max(0.01, p["amount"] ?? 2);
          const x = Math.min(1, Math.max(0, a));
          switch (node.option) {
            case "logarithmic":
              value = Math.pow(x, 1 / amount);
              break;
            case "smoothstep":
              value = x * x * (3 - 2 * x);
              break;
            case "invert":
              value = 1 - x;
              break;
            default:
              value = Math.pow(x, amount);
          }
          break;
        }
        case "smooth": {
          const amount = Math.min(0.99, Math.max(0, p["amount"] ?? 0.15));
          const coef = amount <= 0 ? 0 : Math.exp(-dt / amount);
          state.smooth = coef * state.smooth + (1 - coef) * a;
          value = state.smooth;
          break;
        }
        case "sampleHold": {
          const trigger = Number.isNaN(inputs[1] ?? Number.NaN) ? 0 : (inputs[1] as number);
          if (trigger >= 0.5 && state.lastTrigger < 0.5) state.hold = a;
          state.lastTrigger = trigger;
          value = state.hold;
          break;
        }
        case "threshold": {
          const level = p["level"] ?? 0.5;
          const hard = (p["hard"] ?? 0) >= 0.5;
          value = a >= level ? (hard ? 1 : a) : 0;
          break;
        }
        case "destination": {
          const signal = hasA ? a : 0;
          value = (p["base"] ?? 0) + (p["amount"] ?? 1) * signal;
          if (node.option) applyToFrame(frame, node.option, value);
          break;
        }
      }

      if (!Number.isFinite(value)) value = 0;
      this.values.set(node.id, value);
      out[node.id] = value;
    }

    frame.graph = out;
    return out;
  }
}
