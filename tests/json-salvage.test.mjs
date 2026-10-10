import assert from "node:assert/strict";
import test from "node:test";

import { salvageTruncatedJson } from "../lib/json-salvage.ts";

test("valid JSON passes through untouched", () => {
  const result = salvageTruncatedJson('{"a":1,"parts":[{"id":"x"}]}');
  assert.deepEqual(result, { value: { a: 1, parts: [{ id: "x" }] }, repaired: false, droppedChars: 0 });
});

test("cut inside a string of the third array element keeps the first two complete parts", () => {
  const result = salvageTruncatedJson('{"schemaVersion":1,"parts":[{"id":"a","size":[1,2,3]},{"id":"b","size":[4,5,6]},{"id":"c","na');
  assert.equal(result.repaired, true);
  assert.equal(result.value.schemaVersion, 1);
  assert.deepEqual(result.value.parts.map((part) => part.id).slice(0, 2), ["a", "b"]);
  assert.ok(result.value.parts.every((part) => typeof part.id === "string"));
});

test("cut right after a key colon drops the dangling key", () => {
  const result = salvageTruncatedJson('{"a":1,"b":');
  assert.deepEqual(result.value, { a: 1 });
});

test("cut inside a nested number array closes the array", () => {
  const result = salvageTruncatedJson('{"parts":[{"id":"a","relativeSize":[0.4,0.2');
  assert.equal(result.repaired, true);
  assert.equal(result.value.parts[0].id, "a");
});

test("escaped quotes inside strings do not confuse the scanner", () => {
  const result = salvageTruncatedJson('{"name":"12\\" rotor","parts":[{"id":"a"},{"id":"b\\"x');
  assert.equal(result.value.name, '12" rotor');
  assert.equal(result.value.parts[0].id, "a");
});

test("code fences and leading prose are stripped", () => {
  const result = salvageTruncatedJson('Here you go:\n```json\n{"a":[1,2,3]}\n```');
  assert.deepEqual(result.value, { a: [1, 2, 3] });
  const truncated = salvageTruncatedJson('```json\n{"a":[1,2,3],"b":{"c":tr');
  assert.deepEqual(truncated.value.a, [1, 2, 3]);
});

test("garbage returns null", () => {
  assert.equal(salvageTruncatedJson("not json at all"), null);
  assert.equal(salvageTruncatedJson(""), null);
});
