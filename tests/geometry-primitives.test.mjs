import assert from "node:assert/strict";
import test from "node:test";

import {
  HIGH_FIDELITY_PRIMITIVES,
  createCapsuleMesh,
  createConeMesh,
  createEllipsoidMesh,
  createFrustumMesh,
  createPrimitiveMesh,
  createWedgeMesh,
} from "../lib/geometry-primitives.mjs";

function assertValidMesh(mesh) {
  assert.ok(mesh.points.length >= 8);
  assert.ok(mesh.faces.length >= 6);
  for (const point of mesh.points) {
    assert.equal(point.length, 3);
    assert.ok(point.every(Number.isFinite));
  }
  for (const face of mesh.faces) {
    assert.ok(face.indices.length >= 3);
    assert.ok(face.indices.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.points.length));
    assert.ok(Number.isFinite(face.shade));
  }
}

function extent(points, axis) {
  const values = points.map((point) => point[axis]);
  return Math.max(...values) - Math.min(...values);
}

test("high-fidelity primitive vocabulary remains reusable rather than object-specific", () => {
  assert.deepEqual(HIGH_FIDELITY_PRIMITIVES, [
    "box",
    "cylinder",
    "capsule",
    "ellipsoid",
    "frustum",
    "cone",
    "wedge",
  ]);
});

test("capsule creates a softened elongated silhouette while preserving requested scale", () => {
  const mesh = createCapsuleMesh([120, 48, 40], "x");
  assertValidMesh(mesh);
  assert.ok(mesh.points.length > 32);
  assert.ok(Math.abs(extent(mesh.points, 0) - 120) < 0.001);
  assert.ok(extent(mesh.points, 1) <= 48.001);
  assert.ok(extent(mesh.points, 2) <= 40.001);
});

test("ellipsoid provides reusable rounded volume for knobs, bulbs, globes, balls, and joints", () => {
  const mesh = createEllipsoidMesh([60, 42, 36], "x");
  assertValidMesh(mesh);
  assert.ok(mesh.points.length > 64);
  assert.ok(Math.abs(extent(mesh.points, 0) - 60) < 0.01);
  assert.ok(extent(mesh.points, 1) <= 42.001);
  assert.ok(extent(mesh.points, 2) <= 36.001);
});

test("frustum narrows one end for housings, nozzles, shades, and transition pieces", () => {
  const mesh = createFrustumMesh([80, 50, 50], "x", 0.5);
  assertValidMesh(mesh);
  const firstRingRadius = Math.hypot(mesh.points[0][1], mesh.points[0][2]);
  const secondRingStart = mesh.points.length / 2;
  const secondRingRadius = Math.hypot(mesh.points[secondRingStart][1], mesh.points[secondRingStart][2]);
  assert.ok(secondRingRadius < firstRingRadius * 0.55);
});

test("cone provides a true pointed transition for tips and tapered working ends", () => {
  const mesh = createConeMesh([60, 28, 28], "x");
  assertValidMesh(mesh);
  const last = mesh.points.at(-1);
  assert.ok(Math.hypot(last[1], last[2]) < 2);
});

test("wedge supplies a reusable tapered prism for handles, noses, roofs, and supports", () => {
  const mesh = createWedgeMesh([100, 50, 40], "x", 0.5);
  assertValidMesh(mesh);
  const nearHeight = Math.abs(mesh.points[2][1] - mesh.points[0][1]);
  const farHeight = Math.abs(mesh.points[6][1] - mesh.points[4][1]);
  assert.ok(farHeight < nearHeight);
});

test("dispatcher preserves legacy box/cylinder behavior while exposing richer primitives", () => {
  for (const kind of HIGH_FIDELITY_PRIMITIVES) {
    const mesh = createPrimitiveMesh(kind, [96, 42, 36], "x");
    assertValidMesh(mesh);
  }
});
