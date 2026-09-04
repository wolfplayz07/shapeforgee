import { createPrimitiveMesh } from "./geometry-primitives.mjs";
import { inferPrimitiveKind } from "./shape-fidelity.mjs";

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const AXES = ["x", "y", "z"];

function rotateLocal(point, rotation = [0, 0, 0]) {
  const [rx, ry, rz] = rotation.map((value) => (Number(value || 0) * Math.PI) / 180);
  let [x, y, z] = point;

  let c = Math.cos(rx);
  let s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];

  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];

  c = Math.cos(rz);
  s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

function safeSize(part) {
  return Array.isArray(part.size) && part.size.length === 3
    ? part.size.map((value) => Math.max(0.001, Number(value) || 0.001))
    : [1, 1, 1];
}

export function renderPrimitiveKind(part) {
  return inferPrimitiveKind(part);
}

export function renderPrimitiveAxis(part, kind = renderPrimitiveKind(part)) {
  const declared = AXES.includes(part.axis) ? part.axis : null;
  if (kind === "box") return declared ?? "x";

  // Explicit round/high-fidelity geometry keeps its authored axis.
  if (declared && part.kind === kind && kind !== "box") return declared;

  const size = safeSize(part);
  const dominantIndex = size.indexOf(Math.max(...size));
  const dominant = AXES[dominantIndex];
  if (!declared) return dominant;

  // For inferred tapers/rounded parts, trust the authored axis when it is plausibly longitudinal;
  // otherwise align the primitive to the longest dimension to avoid sideways capsules/nozzles.
  const declaredIndex = AXES.indexOf(declared);
  const longest = size[dominantIndex];
  return size[declaredIndex] >= longest * 0.82 ? declared : dominant;
}

export function buildPartMesh(part, center = part.position ?? [0, 0, 0]) {
  const kind = renderPrimitiveKind(part);
  const size = safeSize(part);
  const axis = renderPrimitiveAxis(part, kind);
  const local = createPrimitiveMesh(kind, size, axis);
  const rotation = part.rotation ?? [0, 0, 0];

  return {
    kind,
    axis,
    points: local.points.map((point) => add(rotateLocal(point, rotation), center)),
    faces: local.faces,
  };
}
