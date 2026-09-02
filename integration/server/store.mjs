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

const projectIdForSequence = sequence => `PROJ-${String(sequence).padStart(6, "0")}`;

export class AssemblyStore {
  constructor(filename) {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    if (filename !== ":memory:") chmodSync(filename, 0o600);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    const version = this.db.prepare("PRAGMA user_version").get().user_version;
    if (version > 2) { this.db.close(); throw new Error("Assembly database was created by a newer ShapeForge version."); }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assemblies (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT,
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
    `);
    const columns = this.db.prepare("PRAGMA table_info(assemblies)").all();
    if (!columns.some(column => column.name === "project_id")) this.db.exec("ALTER TABLE assemblies ADD COLUMN project_id TEXT");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (version < 2) {
        const assignId = this.db.prepare("UPDATE assemblies SET project_id = ? WHERE sequence = ?");
        for (const row of this.db.prepare("SELECT sequence, document FROM assemblies WHERE project_id IS NULL").all()) {
          const expectedId = projectIdForSequence(Number(row.sequence));
          try {
            const project = JSON.parse(row.document);
            if (project?.id === expectedId) assignId.run(expectedId, row.sequence);
          } catch {
            // Leave malformed or mismatched legacy rows unaddressable instead of binding them to the wrong ID.
          }
        }
      }
      this.db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS assemblies_project_id_idx
        ON assemblies(project_id) WHERE project_id IS NOT NULL;
        PRAGMA user_version = 2;
      `);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); this.db.close(); throw error; }
  }
  close() { this.db.close(); }
  mutate(operation, input, action) {
    const fingerprint = createHash("sha256").update(JSON.stringify(canonical({ operation, input }))).digest("hex");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.db.prepare("SELECT fingerprint, response FROM requests WHERE request_id = ?").get(input.request_id);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AssemblyError("REQUEST_ID_REUSED", "This request_id was already used for different input. Use a new UUID for a new action.");
        const cached = JSON.parse(previous.response);
        if (cached?.project?.id && !this.db.prepare("SELECT 1 FROM assemblies WHERE project_id = ?").get(cached.project.id)) {
          throw new AssemblyError("REQUEST_ORPHANED", "The saved result for this request no longer has a matching assembly. Use a new request_id.");
        }
        this.db.exec("COMMIT");
        return cached;
      }
      // Match the persisted/wire representation, including removal of undefined fields.
      const result = JSON.parse(JSON.stringify(action()));
      if (result?.project?.id && !this.db.prepare("SELECT 1 FROM assemblies WHERE project_id = ?").get(result.project.id)) {
        throw new AssemblyError("PERSISTENCE_FAILURE", "The assembly was not stored under the ID returned by ShapeForge.");
      }
      this.db.prepare("INSERT INTO requests VALUES (?, ?, ?)").run(input.request_id, fingerprint, JSON.stringify(result));
      this.db.exec("COMMIT");
      return result;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  insert(project) {
    const updated_at = new Date().toISOString();
    const row = this.db.prepare("INSERT INTO assemblies (project_id, name, updated_at, revision, document) VALUES (NULL, ?, ?, 1, '{}')").run(project.name, updated_at);
    const sequence = Number(row.lastInsertRowid);
    if (sequence > 999999) throw new AssemblyError("CAPACITY", "The prototype's assembly ID capacity has been reached.");
    project.id = projectIdForSequence(sequence);
    validate(project);
    const document = JSON.stringify(project);
    this.db.prepare("UPDATE assemblies SET project_id = ?, document = ? WHERE sequence = ?").run(project.id, document, sequence);
    this.db.prepare("INSERT INTO revisions VALUES (?, 1, ?, ?)").run(sequence, updated_at, document);
    const persisted = this.db.prepare("SELECT document FROM assemblies WHERE project_id = ?").get(project.id);
    if (!persisted || JSON.parse(persisted.document).id !== project.id) throw new AssemblyError("PERSISTENCE_FAILURE", "The assembly could not be stored under its returned project ID.");
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
    const row = revision
      ? this.db.prepare("SELECT r.document, r.revision, r.updated_at FROM revisions r JOIN assemblies a ON a.sequence = r.assembly_sequence WHERE a.project_id = ? AND r.revision = ?").get(id, revision)
      : this.db.prepare("SELECT document, revision, updated_at FROM assemblies WHERE project_id = ?").get(id);
    if (!row) throw new AssemblyError("NOT_FOUND", "That assembly or revision does not exist. Use list_assemblies to find saved IDs.");
    const project = JSON.parse(row.document);
    if (project.id !== id) throw new AssemblyError("IDENTITY_MISMATCH", "The saved assembly identity is inconsistent. ShapeForge will not substitute a different project for this ID.");
    return { project, revision: row.revision, updated_at: row.updated_at };
  }
  list(raw = {}) {
    const { query, limit, offset } = listSchema.parse(raw);
    const match = `%${query.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    const rows = this.db.prepare("SELECT project_id, document, revision, updated_at FROM assemblies WHERE project_id IS NOT NULL AND name LIKE ? ESCAPE '\\' ORDER BY updated_at DESC, sequence DESC LIMIT ? OFFSET ?").all(match, limit + 1, offset);
    return {
      assemblies: rows.slice(0, limit).map(row => {
        const project = JSON.parse(row.document);
        if (project.id !== row.project_id) throw new AssemblyError("IDENTITY_MISMATCH", "A saved assembly has inconsistent identity data and will not be substituted.");
        return summary({ ...row, project });
      }),
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
      const identity = this.db.prepare("SELECT sequence FROM assemblies WHERE project_id = ?").get(input.id);
      if (!identity) throw new AssemblyError("NOT_FOUND", "That assembly does not exist.");
      const document = JSON.stringify(project);
      this.db.prepare("UPDATE assemblies SET document = ?, revision = ?, updated_at = ? WHERE project_id = ?").run(document, revision, updated_at, input.id);
      this.db.prepare("INSERT INTO revisions VALUES (?, ?, ?, ?)").run(identity.sequence, revision, updated_at, document);
      return { project, revision, updated_at };
    });
  }
}
