/** Icosahedron mesh generation (non-indexed, with normals + barycentrics). */

export interface MeshData {
  /** Interleaved: position(3), normal(3), barycentric(3) = 9 floats per vertex. */
  vertices: Float32Array;
  vertexCount: number;
  stride: number;
}

type Vec3 = [number, number, number];

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return normalize([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
}

export function createIcosphere(subdivisions = 2): MeshData {
  const t = (1 + Math.sqrt(5)) / 2;
  const base: Vec3[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map((v) => normalize(v as Vec3));

  const faceIndices: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  let faces: [Vec3, Vec3, Vec3][] = faceIndices.map(([a, b, c]) => [
    base[a] as Vec3,
    base[b] as Vec3,
    base[c] as Vec3,
  ]);

  for (let s = 0; s < subdivisions; s++) {
    const next: [Vec3, Vec3, Vec3][] = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }

  const stride = 9;
  const vertices = new Float32Array(faces.length * 3 * stride);
  const bary: Vec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  let o = 0;
  for (const face of faces) {
    for (let i = 0; i < 3; i++) {
      const v = face[i] as Vec3;
      const b = bary[i] as Vec3;
      vertices[o++] = v[0];
      vertices[o++] = v[1];
      vertices[o++] = v[2];
      // Sphere-projected vertices: the normal is the position.
      vertices[o++] = v[0];
      vertices[o++] = v[1];
      vertices[o++] = v[2];
      vertices[o++] = b[0];
      vertices[o++] = b[1];
      vertices[o++] = b[2];
    }
  }

  return { vertices, vertexCount: faces.length * 3, stride };
}
