import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssemblyStore } from "../server/store.mjs";
import { summary } from "../server/schema.mjs";
import { createForgeProject } from "../../lib/shapeforge.ts";

function memory(t) { const store = new AssemblyStore(":memory:"); t.after(() => store.close()); return store; }
const create = (store, prompt = "1969 Mustang", extra = {}) => store.create({ request_id: randomUUID(), prompt, ...extra });
test("separate saved projects have unique stable IDs and distinct vehicle recipes", t => {
  const store = memory(t);
  const first = create(store);
  const second = create(store, "1969 SS Chevelle");
  assert.notEqual(first.project.id, second.project.id);
  assert.notDeepEqual(first.project.parts, second.project.parts);
  assert.deepEqual(store.get({ id: first.project.id }), first);
  assert.equal(store.list().assemblies.length, 2);
});
test("new flatscreen TV remains bound to its returned project ID", t => {
  const store = memory(t);
  create(store, "1969 Mustang", { name: "Older Mustang" });
  create(store, "1969 SS Chevelle", { name: "Older Chevelle" });
  const tv = create(store, "flatscreen TV", { name: "Persistence Regression TV" });
  const retrieved = store.get({ id: tv.project.id });
  assert.equal(retrieved.project.id, tv.project.id);
  assert.equal(retrieved.project.name, "Persistence Regression TV");
  assert.deepEqual(retrieved.project.parts, tv.project.parts);
  assert.notEqual(retrieved.project.name, "Older Mustang");
  assert.notEqual(retrieved.project.name, "Older Chevelle");
});
test("flatscreen TV identity survives a persistent-store restart", t => {
  const folder = mkdtempSync(join(tmpdir(), "shapeforge-tv-persistence-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, "assemblies.sqlite");
  const first = new AssemblyStore(file);
  create(first, "1969 Mustang", { name: "Old vehicle" });
  const tv = create(first, "flatscreen TV", { name: "Restart-safe TV" });
  first.close();
  const reopened = new AssemblyStore(file);
  try {
    const retrieved = reopened.get({ id: tv.project.id });
    assert.equal(retrieved.project.id, tv.project.id);
    assert.equal(retrieved.project.name, "Restart-safe TV");
    assert.deepEqual(retrieved.project.parts, tv.project.parts);
  } finally { reopened.close(); }
});
test("retrieval refuses a stored document whose embedded project ID does not match the requested ID", t => {
  const store = memory(t);
  const first = create(store, "1969 Mustang");
  const second = create(store, "flatscreen TV");
  const firstSequence = Number(first.project.id.slice(5));
  store.db.prepare("UPDATE assemblies SET document = ? WHERE sequence = ?").run(JSON.stringify(second.project), firstSequence);
  assert.throws(() => store.get({ id: first.project.id }), { code: "IDENTITY_MISMATCH" });
});
test("create stores flatscreen TV under the exact returned ID", t => {
  const store = memory(t);
  const created = create(store, "flatscreen TV");
  const fetched = store.get({ id: created.project.id });
  assert.equal(created.project.name, "Television");
  assert.equal(created.project.prompt, "flatscreen TV");
  assert.equal(fetched.project.id, created.project.id);
  assert.equal(fetched.project.name, "Television");
  assert.equal(fetched.project.prompt, "flatscreen TV");
  assert.deepEqual(fetched.project, created.project);
});
test("get refuses a persisted document whose identity does not match the requested project ID", t => {
  const store = memory(t);
  const tv = create(store, "flatscreen TV");
  const wrong = createForgeProject("1969 Mustang");
  wrong.id = "PROJ-999999";
  store.db.prepare("UPDATE assemblies SET document = ? WHERE project_id = ?").run(JSON.stringify(wrong), tv.project.id);
  assert.throws(() => store.get({ id: tv.project.id }), { code: "IDENTITY_MISMATCH" });
});
test("request retries reject cached projects that no longer match persisted identity", t => {
  const store = memory(t);
  const request = { request_id: randomUUID(), prompt: "flatscreen TV" };
  const tv = store.create(request);
  const substituted = createForgeProject("1969 SS Chevelle");
  substituted.id = tv.project.id;
  store.db.prepare("UPDATE assemblies SET name = ?, document = ? WHERE project_id = ?").run(substituted.name, JSON.stringify(substituted), tv.project.id);
  assert.throws(() => store.create(request), { code: "IDENTITY_MISMATCH" });
});
test("SQLite survives restart, including request retry records", t => {
  const folder = mkdtempSync(join(tmpdir(), "shapeforge-store-test-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, "assemblies.sqlite");
  const request = { request_id: randomUUID(), prompt: "desk" };
  const first = new AssemblyStore(file);
  const saved = first.create(request);
  first.close();
  const reopened = new AssemblyStore(file);
  try { assert.deepEqual(reopened.get({ id: saved.project.id }), saved); assert.deepEqual(reopened.create(request), saved); assert.equal(reopened.list().assemblies.length, 1); }
  finally { reopened.close(); }
});
test("create idempotence rejects changed input with a reused UUID", t => {
  const store = memory(t);
  const input = { request_id: randomUUID(), prompt: "fan" };
  assert.deepEqual(store.create(input), store.create(input));
  assert.throws(() => store.create({ ...input, prompt: "chair" }), { code: "REQUEST_ID_REUSED" });
  assert.equal(store.list().assemblies.length, 1);
});
test("edits are revision-checked, idempotent, and preserve historical geometry", t => {
  const store = memory(t), original = create(store);
  const input = { request_id: randomUUID(), id: original.project.id, expected_revision: 1, component_id: original.project.parts[0].id, changes: { color: "#123456", size: [100, 50, 30] } };
  const edited = store.update(input);
  assert.equal(edited.revision, 2);
  assert.equal(edited.project.parts[0].color, "#123456");
  assert.deepEqual(store.update(input), edited);
  assert.deepEqual(store.get({ id: input.id, revision: 1 }), original);
  assert.throws(() => store.update({ ...input, request_id: randomUUID() }), { code: "REVISION_CONFLICT" });
  assert.equal(store.get({ id: input.id }).revision, 2);
});
test("list supports literal wildcard searches and pagination", t => {
  const store = memory(t);
  create(store, "chair", { name: "100%_wood" }); create(store, "chair", { name: "Other" });
  assert.equal(store.list({ query: "%_" }).assemblies.length, 1);
  const page = store.list({ limit: 1 });
  assert.equal(page.next_offset, 1);
  assert.equal(store.list({ offset: page.next_offset, limit: 1 }).next_offset, null);
  assert.equal(store.list({ query: "' OR 1=1 --" }).assemblies.length, 0);
});
test("custom assembly stores supplied parts without substituting a recipe", t => {
  const store = memory(t), parts = createForgeProject("desk").parts.slice(0, 1);
  parts[0].parent = null; parts[0].related = []; parts[0].name = "Custom workbench top";
  const result = store.save({ request_id: randomUUID(), name: "Other project", description: "A custom fixture", parts });
  assert.deepEqual(result.project.parts, JSON.parse(JSON.stringify(parts)));
  assert.equal(result.project.source, "imported");
});
test("invalid custom geometry and links roll back without saving", t => {
  const store = memory(t);
  for (const change of [{ size: [-1, 1, 1] }, { rotation: [NaN, 0, 0] }, { parent: "COMP-999999" }, { related: ["COMP-999999"] }, { parent: "COMP-000001" }]) {
    const part = { ...createForgeProject("desk").parts[0], parent: null, related: [], ...change };
    assert.throws(() => store.save({ request_id: randomUUID(), name: "Invalid", description: "Fixture", parts: [part] }));
  }
  assert.equal(store.list().assemblies.length, 0);
});
test("missing IDs, empty patches, unsafe fields, and out-of-bounds inputs fail", t => {
  const store = memory(t), saved = create(store);
  assert.throws(() => store.get({ id: "../../other" }));
  assert.throws(() => store.get({ id: "PROJ-999999" }), { code: "NOT_FOUND" });
  const base = { request_id: randomUUID(), id: saved.project.id, expected_revision: 1, component_id: saved.project.parts[0].id };
  assert.throws(() => store.update({ ...base, changes: {} }), { code: "NO_CHANGES" });
  assert.throws(() => store.update({ ...base, changes: { id: "COMP-999999" } }));
  assert.throws(() => store.update({ ...base, changes: { size: [0, 1, 1] } }));
  assert.throws(() => create(store, "desk", { scale: 100 }));
});
test("unknown prompts are explicitly labeled inferred semantic concepts", t => {
  const saved = create(memory(t), "a quantum banana observatory");
  assert.equal(saved.project.source, "procedural-concept");
  assert.match(summary(saved).warning, /semantic concept/);
});
