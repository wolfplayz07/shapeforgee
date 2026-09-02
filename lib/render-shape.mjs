import { createPrimitiveMesh } from "./geometry-primitives.mjs";
import { inferPrimitiveKind } from "./shape-fidelity.mjs";

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

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

export function renderPrimitiveKind(part) {
  return inferPrimitiveKind(part);
}

export function buildPartMesh(part, center = part.position ?? [0, 0, 0]) {
  const kind = renderPrimitiveKind(part);
  const size = Array.isArray(part.size) && part.size.length === 3 ? part.size : [1, 1, 1];
  const axis = part.axis ?? "x";
  const local = createPrimitiveMesh(kind, size, axis);
  const rotation = part.rotation ?? [0, 0, 0];

  return {
    kind,
    points: local.points.map((point) => add(rotateLocal(point, rotation), center)),
    faces: local.faces,
  };
}
