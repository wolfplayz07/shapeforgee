import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { createForgeProject } from "../../lib/shapeforge.ts";
import { AssemblyError, createSchema, saveSchema, getSchema, listSchema, updateSchema, validate, summary } from "./schema.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export class AssemblyStore {
  constructor(filename) {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    if (filename !== ":memory:") chmodSync(filename, 0o600);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    const version = this.db.prepare("PRAGMA user_version").get().user_version;
    if (version > 1) { this.db.close(); throw new Error("Assembly database was created by a newer ShapeForge version."); }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assemblies (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL,
        document TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS revisions (
        assembly_sequence INTEGER NOT NULL REFERENCES assemblies(sequence),
        revision INTEGER NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL,
        PRIMARY KEY (assembly_sequence, revision)
      );
      CREATE TABLE IF NOT EXISTS requests (
        request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, response TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }
  close() { this.db.close(); }
  mutate(operation, input, action) {
    const fingerprint = createHash("sha256").update(JSON.stringify(canonical({ operation, input }))).digest("hex");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.db.prepare("SELECT fingerprint, response FROM requests WHERE request_id = ?").get(input.request_id);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AssemblyError("REQUEST_ID_REUSED", "This request_id was already used for different input. Use a new UUID for a new action.");
        this.db.exec("COMMIT");
        return JSON.parse(previous.response);
      }
      const result = JSON.parse(JSON.stringify(action()));
      this.db.prepare("INSERT INTO requests VALUES (?, ?, ?)").run(input.request_id, fingerprint, JSON.stringify(result));
      this.db.exec("COMMIT");
      return result;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  insert(project) {
    const updated_at = new Date().toISOString();
    const row = this.db.prepare("INSERT INTO assemblies (name, updated_at, revision, document) VALUES (?, ?, 1, '{}')").run(project.name, updated_at);
    const sequence = Number(row.lastInsertRowid);
    if (sequence > 999999) throw new AssemblyError("CAPACITY", "The prototype's assembly ID capacity has been reached.");
    project.id = `PROJ-${String(sequence).padStart(6, "0")}`;
    validate(project);
    const document = JSON.stringify(project);
    this.db.prepare("UPDATE assemblies SET document = ? WHERE sequence = ?").run(document, sequence);
    this.db.prepare("INSERT INTO revisions VALUES (?, 1, ?, ?)").run(sequence, updated_at, document);
    return { project, revision: 1, updated_at };
  }
  create(raw) {
    const input = createSchema.parse(raw);
    return this.mutate("create", input, () => {
      const project = createForgeProject(input.prompt, { detail: input.detail, scale: input.scale });
      if (input.name) project.name = input.name;
      return this.insert(project);
    });
  }
  save(raw) {
    const input = saveSchema.parse(raw);
    return this.mutate("save", input, () => {
      const project = createForgeProject(input.description);
      project.name = input.name;
      project.parts = structuredClone(input.parts);
      project.source = "imported";
      project.allocator.nextComponent = Math.max(...project.parts.map(part => Number(part.id.slice(5)))) + 1;
      project.history = ["Created custom assembly from supplied components"];
      return this.insert(project);
    });
  }
  get(raw) {
    const { id, revision } = getSchema.parse(raw);
    const sequence = Number(id.slice(5));
    const row = revision
      ? this.db.prepare("SELECT document, revision, updated_at FROM revisions WHERE assembly_sequence = ? AND revision = ?").get(sequence, revision)
      : this.db.prepare("SELECT document, revision, updated_at FROM assemblies WHERE sequence = ?").get(sequence);
    if (!row) throw new AssemblyError("NOT_FOUND", "That assembly or revision does not exist. Use list_assemblies to find saved IDs.");
    const project = JSON.parse(row.document);
    // Never allow a sequence lookup to substitute a document belonging to another
    // project ID. This turns stale/corrupt/mixed stores into an explicit failure
    // instead of opening an unrelated older assembly.
    if (project.id !== id) throw new AssemblyError("PROJECT_ID_MISMATCH", `Stored assembly identity mismatch for ${id}; refusing to substitute ${project.id || "an unidentified project"}.`);
    return { project, revision: row.revision, updated_at: row.updated_at };
  }
  list(raw = {}) {
    const { query, limit, offset } = listSchema.parse(raw);
    const match = `%${query.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    const rows = this.db.prepare("SELECT document, revision, updated_at FROM assemblies WHERE name LIKE ? ESCAPE '\\' ORDER BY updated_at DESC, sequence DESC LIMIT ? OFFSET ?").all(match, limit + 1, offset);
    return {
      assemblies: rows.slice(0, limit).map(row => summary({ ...row, project: JSON.parse(row.document) })),
      next_offset: rows.length > limit ? offset + limit : null,
    };
  }
  update(raw) {
    const input = updateSchema.parse(raw);
    if (!Object.keys(input.changes).length) throw new AssemblyError("NO_CHANGES", "Provide at least one component property to change.");
    return this.mutate("update", input, () => {
      const current = this.get({ id: input.id });
      if (current.revision !== input.expected_revision) throw new AssemblyError("REVISION_CONFLICT", "The assembly changed. Fetch its current revision before applying this edit.");
      const project = current.project;
      const part = project.parts.find(p => p.id === input.component_id);
      if (!part) throw new AssemblyError("COMPONENT_NOT_FOUND", "That component is not in this assembly. Get the assembly to inspect its component IDs.");
      Object.assign(part, input.changes);
      project.history = [...project.history, `Updated ${part.id}`].slice(-32);
      validate(project);
      const revision = current.revision + 1;
      const updated_at = new Date().toISOString();
      const sequence = Number(input.id.slice(5));
      const document = JSON.stringify(project);
      this.db.prepare("UPDATE assemblies SET document = ?, revision = ?, updated_at = ? WHERE sequence = ?").run(document, revision, updated_at, sequence);
      this.db.prepare("INSERT INTO revisions VALUES (?, ?, ?, ?)").run(sequence, revision, updated_at, document);
      return { project, revision, updated_at };
    });
  }
}
