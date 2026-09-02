const DEFAULT_SEGMENTS = 16;

const finitePositive = (value, fallback) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

function axisPoint(axis, longitudinal, u, v) {
  if (axis === "y") return [u, longitudinal, v];
  if (axis === "z") return [u, v, longitudinal];
  return [longitudinal, u, v];
}

function dimensionsForAxis(size, axis) {
  const [sx, sy, sz] = size.map((value) => finitePositive(value, 1));
  if (axis === "y") return { length: sy, radiusU: sx / 2, radiusV: sz / 2 };
  if (axis === "z") return { length: sz, radiusU: sx / 2, radiusV: sy / 2 };
  return { length: sx, radiusU: sy / 2, radiusV: sz / 2 };
}

function revolveProfile(size, axis, profile, segments = DEFAULT_SEGMENTS) {
  const { length, radiusU, radiusV } = dimensionsForAxis(size, axis);
  const points = [];
  const faces = [];
  const count = Math.max(8, Math.round(segments));

  profile.forEach(({ x, radius }) => {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      points.push(axisPoint(
        axis,
        x * length,
        Math.cos(angle) * radiusU * radius,
        Math.sin(angle) * radiusV * radius,
      ));
    }
  });

  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      const currentStart = ring * count + index;
      const currentNext = ring * count + next;
      const nextStart = (ring + 1) * count + index;
      const nextNext = (ring + 1) * count + next;
      faces.push({
        indices: [currentStart, currentNext, nextNext, nextStart],
        shade: -10 + Math.round(Math.cos((index / count) * Math.PI * 2) * 18),
      });
    }
  }

  if (profile[0].radius > 0.001) {
    faces.push({
      indices: Array.from({ length: count }, (_, index) => count - 1 - index),
      shade: -18,
    });
  }
  const lastOffset = (profile.length - 1) * count;
  if (profile.at(-1).radius > 0.001) {
    faces.push({
      indices: Array.from({ length: count }, (_, index) => lastOffset + index),
      shade: 13,
    });
  }

  return { points, faces };
}

export function createBoxMesh(size) {
  const [sx, sy, sz] = size.map((value) => finitePositive(value, 1));
  const x = sx / 2;
  const y = sy / 2;
  const z = sz / 2;
  const points = [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
  ];
  const faceIndices = [
    [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1],
    [3, 2, 6, 7], [1, 5, 6, 2], [0, 3, 7, 4],
  ];
  return {
    points,
    faces: faceIndices.map((indices, index) => ({
      indices,
      shade: [-20, 14, -8, 9, -2, -13][index],
    })),
  };
}

export function createCylinderMesh(size, axis = "x", segments = DEFAULT_SEGMENTS) {
  return revolveProfile(size, axis, [
    { x: -0.5, radius: 1 },
    { x: 0.5, radius: 1 },
  ], segments);
}

export function createFrustumMesh(size, axis = "x", endScale = 0.58, segments = DEFAULT_SEGMENTS) {
  const scale = Math.max(0.08, Math.min(1, Number.isFinite(endScale) ? endScale : 0.58));
  return revolveProfile(size, axis, [
    { x: -0.5, radius: 1 },
    { x: 0.5, radius: scale },
  ], segments);
}

export function createConeMesh(size, axis = "x", segments = DEFAULT_SEGMENTS) {
  return revolveProfile(size, axis, [
    { x: -0.5, radius: 1 },
    { x: 0.5, radius: 0.04 },
  ], segments);
}

export function createCapsuleMesh(size, axis = "x", segments = DEFAULT_SEGMENTS) {
  const { length, radiusU, radiusV } = dimensionsForAxis(size, axis);
  const endRadius = Math.min(radiusU, radiusV, length / 2);
  const normalizedCap = Math.min(0.48, endRadius / Math.max(length, 1));
  const straightHalf = Math.max(0, 0.5 - normalizedCap);
  const profile = [
    { x: -0.5, radius: 0.08 },
    { x: -0.5 + normalizedCap * 0.3, radius: 0.66 },
    { x: -straightHalf, radius: 1 },
    { x: straightHalf, radius: 1 },
    { x: 0.5 - normalizedCap * 0.3, radius: 0.66 },
    { x: 0.5, radius: 0.08 },
  ];
  return revolveProfile(size, axis, profile, segments);
}

export function createEllipsoidMesh(size, axis = "x", segments = DEFAULT_SEGMENTS) {
  const latitudeBands = Math.max(6, Math.round(segments / 2));
  const profile = [];
  for (let latitude = 0; latitude <= latitudeBands; latitude += 1) {
    const t = latitude / latitudeBands;
    const angle = -Math.PI / 2 + t * Math.PI;
    profile.push({
      x: Math.sin(angle) * 0.5,
      radius: Math.max(0.001, Math.cos(angle)),
    });
  }
  return revolveProfile(size, axis, profile, segments);
}

function canonicalWedgePoint(axis, x, y, z) {
  if (axis === "y") return [y, x, z];
  if (axis === "z") return [y, z, x];
  return [x, y, z];
}

export function createWedgeMesh(size, axis = "x", endScale = 0.55) {
  const { length, radiusU, radiusV } = dimensionsForAxis(size, axis);
  const half = length / 2;
  const scale = Math.max(0.15, Math.min(1, Number.isFinite(endScale) ? endScale : 0.55));
  const points = [
    canonicalWedgePoint(axis, -half, -radiusU, -radiusV),
    canonicalWedgePoint(axis, -half, radiusU, -radiusV),
    canonicalWedgePoint(axis, -half, radiusU, radiusV),
    canonicalWedgePoint(axis, -half, -radiusU, radiusV),
    canonicalWedgePoint(axis, half, -radiusU * scale, -radiusV * scale),
    canonicalWedgePoint(axis, half, radiusU * scale, -radiusV * scale),
    canonicalWedgePoint(axis, half, radiusU * scale, radiusV * scale),
    canonicalWedgePoint(axis, half, -radiusU * scale, radiusV * scale),
  ];
  const faceIndices = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
    [3, 7, 6, 2], [1, 2, 6, 5], [0, 4, 7, 3],
  ];
  return {
    points,
    faces: faceIndices.map((indices, index) => ({
      indices,
      shade: [-18, 13, -9, 8, -2, -12][index],
    })),
  };
}

export function createPrimitiveMesh(kind, size, axis = "x") {
  if (kind === "cylinder") return createCylinderMesh(size, axis);
  if (kind === "capsule") return createCapsuleMesh(size, axis);
  if (kind === "ellipsoid") return createEllipsoidMesh(size, axis);
  if (kind === "frustum") return createFrustumMesh(size, axis);
  if (kind === "cone") return createConeMesh(size, axis);
  if (kind === "wedge") return createWedgeMesh(size, axis);
  return createBoxMesh(size);
}

export const HIGH_FIDELITY_PRIMITIVES = Object.freeze([
  "box",
  "cylinder",
  "capsule",
  "ellipsoid",
  "frustum",
  "cone",
  "wedge",
]);
