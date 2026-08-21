import { WGSL_COMMON } from "./common.wgsl";

/** Particle simulation (compute) + instanced billboard rendering. */
export const WGSL_PARTICLES = /* wgsl */ `
${WGSL_COMMON}

struct Particle {
  pos  : vec3<f32>,
  life : f32,
  vel  : vec3<f32>,
  seed : f32,
};

struct Particles { data : array<Particle> };

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read_write> particlesRW : Particles;

fn spawn(seed: f32) -> Particle {
  let r = hash31(seed * 17.13 + u.timing.w);
  let dir = normalize(r * 2.0 - 1.0 + vec3<f32>(0.0001, 0.0, 0.0));
  let radius = 1.15 + r.x * 2.4;
  var p : Particle;
  p.pos = dir * radius;
  p.vel = dir * 0.05;
  p.life = mix(0.2, 1.0, r.y) * max(0.5, u.particleA.w);
  p.seed = seed;
  return p;
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) gid : vec3<u32>) {
  let index = gid.x;
  let count = u32(u.audioB.z);
  if (index >= count) { return; }

  var p = particlesRW.data[index];
  let dt = u.timing.y;

  if (p.life <= 0.0) {
    p = spawn(f32(index) + u.timing.z * 0.0001);
    particlesRW.data[index] = p;
    return;
  }

  let scale = max(0.05, u.particleA.z);
  let field = noiseField(p.pos * scale + vec3<f32>(0.0, u.timing.x * 0.15, 0.0));
  let inward = -normalize(p.pos + vec3<f32>(0.0001, 0.0, 0.0)) * (0.55 + u.audioA.x * 1.6);
  let swirl = cross(p.pos, vec3<f32>(0.0, 1.0, 0.0)) * 0.22;

  let accel = (field * 3.2 + inward + swirl) * u.particleA.y;
  p.vel = p.vel * 0.965 + accel * dt;
  p.vel = p.vel + normalize(p.pos + vec3<f32>(0.0001, 0.0, 0.0)) * u.audioB.y * u.audioA.y * 2.4 * dt;
  p.pos = p.pos + p.vel * dt;
  p.life = p.life - dt;

  particlesRW.data[index] = p;
}

struct VSOut {
  @builtin(position) position : vec4<f32>,
  @location(0) uv    : vec2<f32>,
  @location(1) tint  : vec3<f32>,
  @location(2) alpha : f32,
};

@group(0) @binding(0) var<uniform> ur : Uniforms;
@group(0) @binding(1) var<storage, read> particlesR : Particles;

@vertex
fn vs_particles(
  @builtin(vertex_index) vi : u32,
  @builtin(instance_index) ii : u32,
) -> VSOut {
  let p = particlesR.data[ii];

  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),  vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  );
  let corner = corners[vi];

  let clip = ur.viewProj * vec4<f32>(p.pos, 1.0);
  let sizeWorld = ur.particleA.x * 0.0045 * (1.0 + ur.audioA.w * 0.8);
  let aspect = ur.resolution.x / max(1.0, ur.resolution.y);

  var out : VSOut;
  var pos = clip;
  pos.x = pos.x + corner.x * sizeWorld * clip.w / aspect;
  pos.y = pos.y + corner.y * sizeWorld * clip.w;
  out.position = pos;
  out.uv = corner;

  let speed = clamp(length(p.vel) * 0.6, 0.0, 1.0);
  let warm = vec3<f32>(1.0, 0.42, 0.18);
  let cool = vec3<f32>(0.24, 0.72, 1.0);
  let violet = vec3<f32>(0.72, 0.35, 1.0);
  var tint = mix(cool, violet, clamp(p.seed * 0.00004 + ur.audioA.z, 0.0, 1.0));
  tint = mix(tint, warm, speed);
  out.tint = tint * (0.7 + ur.audioA.y * 1.4);
  out.alpha = clamp(p.life * 0.55, 0.0, 1.0);
  return out;
}

@fragment
fn fs_particles(in : VSOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  if (d > 1.0) { discard; }
  let falloff = pow(1.0 - d, 2.4);
  return vec4<f32>(in.tint * falloff, falloff * in.alpha);
}
`;
