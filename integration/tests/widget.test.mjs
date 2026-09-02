import test from "node:test";
import assert from "node:assert/strict";
import { createForgeProject } from "../../lib/shapeforge.ts";
import { readRecord, acceptRecord } from "../web/state.mjs";
import { widgetHtml } from "../server/runtime.mjs";

function envelope(revision = 1) {
  const project = createForgeProject("1969 Mustang");
  return { structuredContent: { id: project.id, revision, warning: "Concept only" }, _meta: { project } };
}
test("widget reads metadata or full data-tool results and surfaces errors", () => {
  const result = envelope();
  assert.equal(readRecord(result).project.id, result.structuredContent.id);
  assert.equal(readRecord({ structuredContent: { ...result.structuredContent, project: result._meta.project } }).revision, 1);
  assert.throws(() => readRecord({ isError: true, content: [{ type: "text", text: "REVISION_CONFLICT" }] }), /REVISION_CONFLICT/);
  assert.throws(() => readRecord({}), /incomplete/);
});
test("widget rejects stale revisions and late responses from another project", () => {
  const current = readRecord(envelope(3));
  assert.equal(acceptRecord(current, readRecord(envelope(2))), current);
  const other = readRecord(envelope(4)); other.project.id = "PROJ-000002";
  assert.equal(acceptRecord(current, other), current);
  assert.equal(acceptRecord(current, other, true), other);
  assert.equal(acceptRecord(current, readRecord(envelope(4))).revision, 4);
});
test("viewer build is a self-contained HTML resource", () => {
  const html = widgetHtml();
  assert.match(html, /<!doctype html>/);
  assert.match(html, /SHAPEFORGE/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+href=/);
});
