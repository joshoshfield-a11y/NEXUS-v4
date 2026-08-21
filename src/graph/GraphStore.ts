import { NODE_DEFINITIONS, type NodeType } from "./NodeRegistry";

export interface GraphNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  params: Record<string, number>;
  option?: string | undefined;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** Index into the target node's inputs array. */
  input: number;
}

export interface NexusGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const STORAGE_KEY = "nexus-v4-graph";

export function makeId(prefix = "n") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createNode(type: NodeType, x: number, y: number): GraphNode {
  const def = NODE_DEFINITIONS[type];
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.key] = p.default;
  return {
    id: makeId(type),
    type,
    x,
    y,
    params,
    option: def.options?.default,
  };
}

/** Default patch: kick -> displacement, snare -> chromatic aberration, hats -> hue. */
export function defaultGraph(): NexusGraph {
  const kick = createNode("band", 40, 60);
  kick.option = "kick";
  const kickCurve = createNode("curve", 260, 60);
  kickCurve.option = "exponential";
  kickCurve.params["amount"] = 2.4;
  const displacement = createNode("destination", 480, 60);
  displacement.option = "mesh.displacement";
  displacement.params["base"] = 0.08;
  displacement.params["amount"] = 1.1;

  const snare = createNode("band", 40, 240);
  snare.option = "snare";
  const snareSmooth = createNode("smooth", 260, 240);
  snareSmooth.params["amount"] = 0.12;
  const aberration = createNode("destination", 480, 240);
  aberration.option = "post.chromaticAberration";
  aberration.params["base"] = 0.05;
  aberration.params["amount"] = 0.8;

  const sub = createNode("band", 40, 420);
  sub.option = "sub";
  const shake = createNode("destination", 480, 420);
  shake.option = "camera.shake";
  shake.params["base"] = 0.0;
  shake.params["amount"] = 0.7;
  const shakeThreshold = createNode("threshold", 260, 420);
  shakeThreshold.params["level"] = 0.35;

  const vocals = createNode("band", 40, 600);
  vocals.option = "vocals";
  const glow = createNode("destination", 480, 600);
  glow.option = "mesh.emissive";
  glow.params["base"] = 0.3;
  glow.params["amount"] = 2.0;

  const hats = createNode("band", 40, 780);
  hats.option = "hats";
  const hatsVelocity = createNode("destination", 480, 780);
  hatsVelocity.option = "particles.velocity";
  hatsVelocity.params["base"] = 0.35;
  hatsVelocity.params["amount"] = 2.4;
  const hatsSmooth = createNode("smooth", 260, 780);
  hatsSmooth.params["amount"] = 0.2;

  const lfo = createNode("lfo", 40, 960);
  lfo.params["rate"] = 0.08;
  const hue = createNode("destination", 480, 960);
  hue.option = "post.hue";
  hue.params["base"] = 0;
  hue.params["amount"] = 1;

  const nodes = [
    kick,
    kickCurve,
    displacement,
    snare,
    snareSmooth,
    aberration,
    sub,
    shakeThreshold,
    shake,
    vocals,
    glow,
    hats,
    hatsSmooth,
    hatsVelocity,
    lfo,
    hue,
  ];

  const link = (from: GraphNode, to: GraphNode, input = 0): GraphEdge => ({
    id: makeId("e"),
    from: from.id,
    to: to.id,
    input,
  });

  const edges = [
    link(kick, kickCurve),
    link(kickCurve, displacement),
    link(snare, snareSmooth),
    link(snareSmooth, aberration),
    link(sub, shakeThreshold),
    link(shakeThreshold, shake),
    link(vocals, glow),
    link(hats, hatsSmooth),
    link(hatsSmooth, hatsVelocity),
    link(lfo, hue),
  ];

  return { nodes, edges };
}

export function loadGraph(): NexusGraph {
  if (typeof window === "undefined") return defaultGraph();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultGraph();
    const parsed = JSON.parse(raw) as NexusGraph;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return defaultGraph();
    return parsed;
  } catch {
    return defaultGraph();
  }
}

export function saveGraph(graph: NexusGraph) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
  } catch {
    /* quota or private mode — non fatal */
  }
}

export interface StoredPreset {
  name: string;
  graph: NexusGraph;
}

const PRESET_KEY = "nexus-v4-presets";

export function loadPresets(): StoredPreset[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(PRESET_KEY) ?? "[]") as StoredPreset[];
  } catch {
    return [];
  }
}

export function savePresets(presets: StoredPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}
