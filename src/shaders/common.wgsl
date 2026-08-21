/**
 * Shared WGSL prelude: uniform block layout + hash/noise helpers.
 * Kept in TS so the string can be composed into each pipeline module.
 */
export const WGSL_COMMON = /* wgsl */ `
struct Uniforms {
  viewProj   : mat4x4<f32>,
  camPos     : vec4<f32>,   // xyz = eye, w = fov
  timing     : vec4<f32>,   // time, deltaTime, frame, seed
  particleA  : vec4<f32>,   // size, velocity, noiseScale, lifespan
  meshA      : vec4<f32>,   // displacement, emissive, roughness, metallic
  meshB      : vec4<f32>,   // wireframe, shadows, spare, spare
  postA      : vec4<f32>,   // bloom, chromaticAberration, glitch, scanline
  postB      : vec4<f32>,   // vignette, hue, resolutionScale, aspect
  audioA     : vec4<f32>,   // sub, kick, snare, vocals
  audioB     : vec4<f32>,   // hats, onsetGlobal, particleCount, shake
  resolution : vec4<f32>,   // w, h, 1/w, 1/h
};

fn hash31(p: f32) -> vec3<f32> {
  var p3 = fract(vec3<f32>(p, p, p) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

fn hash13(p: vec3<f32>) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 = p3 + dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

fn valueNoise(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash13(i + vec3<f32>(0.0, 0.0, 0.0));
  let n100 = hash13(i + vec3<f32>(1.0, 0.0, 0.0));
  let n010 = hash13(i + vec3<f32>(0.0, 1.0, 0.0));
  let n110 = hash13(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = hash13(i + vec3<f32>(0.0, 0.0, 1.0));
  let n101 = hash13(i + vec3<f32>(1.0, 0.0, 1.0));
  let n011 = hash13(i + vec3<f32>(0.0, 1.0, 1.0));
  let n111 = hash13(i + vec3<f32>(1.0, 1.0, 1.0));
  let x00 = mix(n000, n100, u.x);
  let x10 = mix(n010, n110, u.x);
  let x01 = mix(n001, n101, u.x);
  let x11 = mix(n011, n111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

fn noiseField(p: vec3<f32>) -> vec3<f32> {
  let e = 0.35;
  let nx = valueNoise(p + vec3<f32>(0.0, 13.7, 5.1));
  let ny = valueNoise(p + vec3<f32>(7.3, 0.0, 21.9));
  let nz = valueNoise(p + vec3<f32>(3.2, 9.4, 0.0));
  return (vec3<f32>(nx, ny, nz) - 0.5) * 2.0 * e;
}

fn hueRotate(color: vec3<f32>, amount: f32) -> vec3<f32> {
  let k = vec3<f32>(0.57735, 0.57735, 0.57735);
  let c = cos(amount * 3.14159265);
  return color * c + cross(k, color) * sin(amount * 3.14159265) + k * dot(k, color) * (1.0 - c);
}
`;
