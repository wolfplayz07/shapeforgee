"use client";

import { useMemo, useRef, useState } from "react";
import {
  Box,
  Check,
  ChevronRight,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  Focus,
  GitBranch,
  Hexagon,
  History,
  Maximize2,
  Menu,
  Move3d,
  Plus,
  Redo2,
  RefreshCcw,
  RotateCcw,
  Save,
  Shuffle,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Wrench,
} from "lucide-react";

import { ForgeCanvas } from "@/components/forge-canvas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  createForgeProject,
  importForgeProject,
  nextComponentId,
  samplePrompts,
  validateForgeProject,
  type CylinderAxis,
  type DetailLevel,
  type ForgePart,
  type ForgeProject,
  type PrimitiveKind,
  type ValidationCheck,
  type Vec3,
} from "@/lib/shapeforge";

type InspectorDraft = {
  name: string;
  category: string;
  purpose: string;
  parent: string;
  sizeX: string;
  sizeY: string;
  sizeZ: string;
  color: string;
};

const cloneProject = (project: ForgeProject): ForgeProject =>
  JSON.parse(JSON.stringify(project)) as ForgeProject;

const emptyDraft: InspectorDraft = {
  name: "",
  category: "",
  purpose: "",
  parent: "root",
  sizeX: "",
  sizeY: "",
  sizeZ: "",
  color: "#6f8192",
};

function draftFromPart(part: ForgePart | null): InspectorDraft {
  if (!part) return emptyDraft;
  return {
    name: part.name,
    category: part.category,
    purpose: part.purpose,
    parent: part.parent ?? "root",
    sizeX: String(Math.round(part.size[0] * 10) / 10),
    sizeY: String(Math.round(part.size[1] * 10) / 10),
    sizeZ: String(Math.round(part.size[2] * 10) / 10),
    color: part.color,
  };
}

function getDepth(part: ForgePart, project: ForgeProject) {
  const byId = new Map(project.parts.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let depth = 0;
  let current = part;
  while (current.parent && byId.has(current.parent) && !visited.has(current.parent)) {
    visited.add(current.parent);
    current = byId.get(current.parent)!;
    depth += 1;
  }
  return depth;
}

function categoryColor(category: string) {
  const value = category.toLowerCase();
  if (value.includes("motion") || value.includes("drive")) return "#f3a34b";
  if (value.includes("control") || value.includes("electronic")) return "#4bb4f2";
  if (value.includes("cover") || value.includes("housing")) return "#bec8d0";
  if (value.includes("output") || value.includes("display")) return "#7fd2fb";
  return "#78d19a";
}

interface PartsPanelProps {
  project: ForgeProject;
  selectedId: string | null;
  checks: ValidationCheck[];
  onSelect: (id: string) => void;
  onAdd: (kind: PrimitiveKind, axis?: CylinderAxis) => void;
  onCopy: () => void;
  onUnhide: () => void;
}

function PartsPanel({ project, selectedId, checks, onSelect, onAdd, onCopy, onUnhide }: PartsPanelProps) {
  const passed = checks.filter((check) => check.ok).length;
  const hiddenCount = project.parts.filter((part) => part.hidden).length;
  return (
    <div className="panel-stack">
      <section className="panel-section panel-project">
        <div className="eyebrow">Assembly</div>
        <div className="project-name-row">
          <div>
            <strong>{project.name}</strong>
            <span>{project.id}</span>
          </div>
          <Badge className="health-badge" variant="outline">
            {passed}/{checks.length}
          </Badge>
        </div>
        <div className="source-row">
          <span className={`source-dot ${project.source.startsWith("procedural-") ? "concept" : ""}`} />
          {project.source === "procedural-concept" ? "Procedural concept" : project.source === "procedural-vehicle" ? "Vehicle generator" : project.source === "imported" ? "Recovered import" : "Recovered generator"}
        </div>
      </section>

      <section className="panel-section part-tree-section">
        <div className="section-heading">
          <span>Component tree</span>
          <span>{project.parts.length}</span>
        </div>
        <div className="part-tree" role="tree" aria-label="Assembly components">
          {project.parts.map((part) => {
            const depth = getDepth(part, project);
            return (
              <button
                type="button"
                key={part.id}
                className={`part-tree-row ${part.id === selectedId ? "selected" : ""} ${part.hidden ? "hidden-part" : ""}`}
                style={{ paddingLeft: 10 + Math.min(depth, 3) * 16 }}
                onClick={() => onSelect(part.id)}
                role="treeitem"
                aria-selected={part.id === selectedId}
              >
                {depth > 0 ? <ChevronRight className="tree-chevron" /> : <Box className="tree-root-icon" />}
                <span className="part-dot" style={{ background: categoryColor(part.category) }} />
                <span className="part-tree-copy">
                  <strong>{part.name}</strong>
                  <small>{part.id}</small>
                </span>
                {part.hidden && <EyeOff className="row-state-icon" />}
                {part.detached && <Move3d className="row-state-icon detached" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading"><span>Add component</span></div>
        <div className="button-grid">
          <Button variant="outline" size="sm" onClick={() => onAdd("box")}>
            <Plus /> Box
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAdd("cylinder", "x")}>
            <Plus /> Shaft
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAdd("cylinder", "z")}>
            <Plus /> Bearing
          </Button>
          {hiddenCount > 0 && (
            <Button variant="outline" size="sm" onClick={onUnhide}>
              <Eye /> Show {hiddenCount}
            </Button>
          )}
        </div>
      </section>

      <section className="panel-section validation-section">
        <div className="section-heading">
          <span>Core validation</span>
          <span className={passed === checks.length ? "all-pass" : "has-error"}>{passed}/{checks.length}</span>
        </div>
        <div className="validation-list">
          {checks.map((check) => (
            <div key={check.id} className={check.ok ? "validation-row" : "validation-row failed"}>
              {check.ok ? <Check /> : <CircleDot />}
              <span>{check.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-section history-section">
        <div className="section-heading"><span>History</span><History /></div>
        <ol>
          {project.history.slice(-6).reverse().map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ol>
        <Button variant="ghost" size="sm" className="copy-json-button" onClick={onCopy}>
          <Copy /> Copy project JSON
        </Button>
      </section>
    </div>
  );
}

interface InspectorPanelProps {
  project: ForgeProject;
  part: ForgePart | null;
  draft: InspectorDraft;
  setDraft: (draft: InspectorDraft) => void;
  parentOptions: ForgePart[];
  onApply: () => void;
  onToggleHidden: () => void;
  onToggleDetached: () => void;
  onDelete: () => void;
}

function InspectorPanel({
  project,
  part,
  draft,
  setDraft,
  parentOptions,
  onApply,
  onToggleHidden,
  onToggleDetached,
  onDelete,
}: InspectorPanelProps) {
  if (!part) {
    return (
      <div className="empty-inspector">
        <Focus />
        <strong>Select a component</strong>
        <span>Tap the model or a component in the tree.</span>
      </div>
    );
  }

  const parent = project.parts.find((item) => item.id === part.parent);
  return (
    <div className="inspector-stack">
      <section className="panel-section inspector-identity">
        <div className="eyebrow">Component inspector</div>
        <div className="selected-heading">
          <span className="primitive-icon">{part.kind === "cylinder" ? <CircleDot /> : <Box />}</span>
          <div>
            <strong>{part.name}</strong>
            <span>{part.id} · {part.kind}{part.axis ? `-${part.axis}` : ""}</span>
          </div>
        </div>
        <div className="inspector-tags">
          <Badge variant="outline">{part.category}</Badge>
          <Badge variant="outline">Depth {getDepth(part, project)}</Badge>
          {part.detached && <Badge variant="outline" className="warn-badge">Detached</Badge>}
          {part.hidden && <Badge variant="outline" className="warn-badge">Hidden</Badge>}
        </div>
      </section>

      <section className="panel-section inspector-form">
        <label>
          <span>Name</span>
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          <span>Category</span>
          <Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
        </label>
        <label>
          <span>Parent</span>
          <Select value={draft.parent} onValueChange={(value) => setDraft({ ...draft, parent: value })}>
            <SelectTrigger className="inspector-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Assembly root</SelectItem>
              {parentOptions.map((option) => <SelectItem value={option.id} key={option.id}>{option.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <small>Current: {parent?.name ?? "Assembly root"}</small>
        </label>
        <div className="dimension-grid">
          <label><span>X</span><Input inputMode="decimal" value={draft.sizeX} onChange={(event) => setDraft({ ...draft, sizeX: event.target.value })} /></label>
          <label><span>Y</span><Input inputMode="decimal" value={draft.sizeY} onChange={(event) => setDraft({ ...draft, sizeY: event.target.value })} /></label>
          <label><span>Z</span><Input inputMode="decimal" value={draft.sizeZ} onChange={(event) => setDraft({ ...draft, sizeZ: event.target.value })} /></label>
        </div>
        <label>
          <span>Purpose</span>
          <Textarea value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} />
        </label>
        <label className="color-field">
          <span>Color</span>
          <span className="color-control">
            <input type="color" aria-label="Component color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
            <Input value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
          </span>
        </label>
        <Button onClick={onApply} className="apply-button"><Wrench /> Apply changes</Button>
      </section>

      <section className="panel-section component-actions">
        <div className="section-heading"><span>Assembly actions</span></div>
        <div className="button-grid">
          <Button variant="outline" size="sm" onClick={onToggleDetached}>
            {part.detached ? <RefreshCcw /> : <Move3d />}{part.detached ? "Snap home" : "Detach"}
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleHidden}>
            {part.hidden ? <Eye /> : <EyeOff />}{part.hidden ? "Show" : "Hide"}
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 /> Delete
          </Button>
        </div>
      </section>

      <section className="panel-section relation-card">
        <div className="section-heading"><span>Relationships</span><GitBranch /></div>
        <p>{part.related.length ? `${part.related.length} linked component${part.related.length === 1 ? "" : "s"}` : "No explicit links"}</p>
        {part.related.map((id) => {
          const related = project.parts.find((item) => item.id === id);
          return related ? <span key={id}>{related.name}</span> : null;
        })}
      </section>
    </div>
  );
}

function explosionLabel(value: number) {
  if (value === 0) return "Assembled";
  if (value < 42) return "Opening assembly";
  if (value < 72) return "Subsystems separated";
  if (value < 100) return "Component layer";
  return "Fully exploded";
}

export default function Home() {
  const initial = useMemo(() => createForgeProject("A-72 bowling machine"), []);
  const [project, setProject] = useState<ForgeProject>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.parts[0]?.id ?? null);
  const [prompt, setPrompt] = useState("A-72 bowling machine");
  const [detail, setDetail] = useState<DetailLevel>("detailed");
  const [overallScale, setOverallScale] = useState(100);
  const [explode, setExplode] = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [status, setStatus] = useState("Recovered ShapeForge core loaded. Ready to forge.");
  const [editCommand, setEditCommand] = useState("make this larger");
  const [undoStack, setUndoStack] = useState<ForgeProject[]>([]);
  const [redoStack, setRedoStack] = useState<ForgeProject[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftOverrides, setDraftOverrides] = useState<Record<string, InspectorDraft>>({});
  const [draftRevision, setDraftRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPart = project.parts.find((part) => part.id === selectedId) ?? null;
  const checks = useMemo(() => validateForgeProject(project), [project]);
  const draftKey = `${draftRevision}:${selectedId ?? "none"}`;
  const draft = draftOverrides[draftKey] ?? draftFromPart(selectedPart);
  const setDraft = (value: InspectorDraft) => {
    setDraftOverrides((current) => ({ ...current, [draftKey]: value }));
  };

  const parentOptions = useMemo(() => {
    if (!selectedPart) return [];
    const descendants = new Set<string>();
    const collect = (id: string) => {
      project.parts.filter((part) => part.parent === id).forEach((child) => {
        descendants.add(child.id);
        collect(child.id);
      });
    };
    collect(selectedPart.id);
    return project.parts.filter((part) => part.id !== selectedPart.id && !descendants.has(part.id));
  }, [project, selectedPart]);

  const commit = (next: ForgeProject, event: string, nextSelectedId: string | null = selectedId) => {
    next.history = [...next.history, event].slice(-32);
    setUndoStack((stack) => [...stack.slice(-19), cloneProject(project)]);
    setRedoStack([]);
    setProject(next);
    setDraftRevision((value) => value + 1);
    setSelectedId(nextSelectedId && next.parts.some((part) => part.id === nextSelectedId) ? nextSelectedId : next.parts[0]?.id ?? null);
    setStatus(event);
  };

  const generate = (requestedPrompt = prompt, requestedScale = overallScale) => {
    const value = requestedPrompt.trim() || "A-72 bowling machine";
    const next = createForgeProject(value, { scale: requestedScale / 100, detail });
    setUndoStack((stack) => [...stack.slice(-19), cloneProject(project)]);
    setRedoStack([]);
    setProject(next);
    setDraftRevision((value) => value + 1);
    setSelectedId(next.parts[0]?.id ?? null);
    setPrompt(value);
    setExplode(0);
    setShowRelations(false);
    setStatus(next.source === "procedural-concept" ? `Forged a procedural concept for “${next.name}”.` : next.source === "procedural-vehicle" ? `Forged ${next.name} with the vehicle-specific generator.` : `Generated ${next.name} from the recovered ShapeForge library.`);
    setFitSignal((value) => value + 1);
  };

  const randomize = () => {
    const nextPrompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
    const nextScale = 80 + Math.floor(Math.random() * 51);
    setOverallScale(nextScale);
    generate(nextPrompt, nextScale);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-19), cloneProject(project)]);
    setProject(previous);
    setDraftRevision((value) => value + 1);
    setSelectedId(previous.parts.some((part) => part.id === selectedId) ? selectedId : previous.parts[0]?.id ?? null);
    setStatus("Undid the last ShapeForge change.");
  };

  const redo = () => {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-19), cloneProject(project)]);
    setProject(next);
    setDraftRevision((value) => value + 1);
    setSelectedId(next.parts.some((part) => part.id === selectedId) ? selectedId : next.parts[0]?.id ?? null);
    setStatus("Redid the ShapeForge change.");
  };

  const addPart = (kind: PrimitiveKind, axis?: CylinderAxis) => {
    const next = cloneProject(project);
    const id = nextComponentId(next);
    next.allocator.nextComponent += 1;
    const anchor = next.parts.find((part) => part.id === selectedId);
    const index = next.parts.length;
    const position: Vec3 = anchor ? [anchor.position[0] + 28, anchor.position[1] - 22, anchor.position[2] + 24] : [0, 0, 0];
    const isBearing = kind === "cylinder" && axis === "z";
    next.parts.push({
      id,
      name: kind === "box" ? "New Box Component" : isBearing ? "New Bearing" : "New Shaft",
      kind,
      axis,
      parent: anchor?.id ?? null,
      category: kind === "box" ? "structure" : "motion",
      purpose: "New editable ShapeForge component.",
      position,
      size: kind === "box" ? [54, 42, 38] : isBearing ? [62, 62, 24] : [96, 28, 28],
      rotation: [0, 0, 0],
      explode: [index % 2 ? 110 : -110, index % 3 ? -55 : 75, 45 + (index % 4) * 20],
      related: anchor ? [anchor.id] : [],
      color: kind === "box" ? "#5f809b" : "#d39a4d",
      hidden: false,
      detached: false,
    });
    if (anchor && !anchor.related.includes(id)) anchor.related.push(id);
    commit(next, `Created ${id}`, id);
  };

  const applyInspector = () => {
    if (!selectedPart) return;
    const next = cloneProject(project);
    const part = next.parts.find((item) => item.id === selectedPart.id)!;
    const parsedSize: Vec3 = [draft.sizeX, draft.sizeY, draft.sizeZ].map((value, index) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : part.size[index];
    }) as Vec3;
    part.name = draft.name.trim() || part.name;
    part.category = draft.category.trim() || part.category;
    part.purpose = draft.purpose.trim() || part.purpose;
    part.parent = draft.parent === "root" ? null : draft.parent;
    part.size = parsedSize;
    if (/^#[0-9a-f]{6}$/i.test(draft.color)) part.color = draft.color;
    commit(next, `Updated ${part.id}`);
  };

  const toggleSelected = (field: "hidden" | "detached") => {
    if (!selectedPart) return;
    const next = cloneProject(project);
    const part = next.parts.find((item) => item.id === selectedPart.id)!;
    part[field] = !part[field];
    const verb = field === "hidden" ? (part.hidden ? "Hid" : "Revealed") : (part.detached ? "Detached" : "Snapped home");
    commit(next, `${verb} ${part.name}`);
  };

  const unhideAll = () => {
    const next = cloneProject(project);
    next.parts.forEach((part) => { part.hidden = false; });
    commit(next, "Revealed all hidden components");
  };

  const deleteSelected = () => {
    if (!selectedPart) return;
    const next = cloneProject(project);
    const parent = selectedPart.parent;
    next.parts = next.parts
      .filter((part) => part.id !== selectedPart.id)
      .map((part) => ({
        ...part,
        parent: part.parent === selectedPart.id ? parent : part.parent,
        related: part.related.filter((id) => id !== selectedPart.id),
      }));
    commit(next, `Deleted ${selectedPart.name}`, next.parts[0]?.id ?? null);
    setDeleteOpen(false);
  };

  const applyEditCommand = () => {
    if (!selectedPart) {
      setStatus("Select a component before applying an edit command.");
      return;
    }
    const command = editCommand.trim();
    const value = command.toLowerCase();
    if (value.includes("connect") || value.includes("related") || value.startsWith("what")) {
      setShowRelations(true);
      const children = project.parts.filter((part) => part.parent === selectedPart.id).map((part) => part.name);
      const parent = project.parts.find((part) => part.id === selectedPart.parent)?.name ?? "assembly root";
      setStatus(`${selectedPart.name} → parent: ${parent}; children: ${children.join(", ") || "none"}.`);
      return;
    }

    const next = cloneProject(project);
    const part = next.parts.find((item) => item.id === selectedPart.id)!;
    const rename = command.match(/rename(?:\s+it)?\s+to\s+(.+)/i);
    let event = "";
    if (value.includes("larger") || value.includes("bigger")) {
      part.size = part.size.map((number) => number * 1.18) as Vec3;
      event = `Made ${part.name} larger`;
    } else if (value.includes("smaller")) {
      part.size = part.size.map((number) => Math.max(2, number * 0.84)) as Vec3;
      event = `Made ${part.name} smaller`;
    } else if (rename?.[1]) {
      const oldName = part.name;
      part.name = rename[1].trim();
      event = `Renamed ${oldName} to ${part.name}`;
    } else if (value.includes("move left")) {
      part.position[0] -= 22; event = `Moved ${part.name} left`;
    } else if (value.includes("move right")) {
      part.position[0] += 22; event = `Moved ${part.name} right`;
    } else if (value.includes("move up")) {
      part.position[1] -= 22; event = `Moved ${part.name} up`;
    } else if (value.includes("move down")) {
      part.position[1] += 22; event = `Moved ${part.name} down`;
    } else if (value.includes("detach")) {
      part.detached = true; event = `Detached ${part.name}`;
    } else if (value.includes("snap") || value.includes("attach")) {
      part.detached = false; event = `Snapped ${part.name} home`;
    } else if (value.includes("hide")) {
      part.hidden = true; event = `Hid ${part.name}`;
    } else if (value.includes("show")) {
      part.hidden = false; event = `Revealed ${part.name}`;
    } else {
      setStatus("Try: make this larger, move left, detach, snap home, rename it to…, or what connects this?");
      return;
    }
    commit(next, event);
  };

  const saveProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-shapeforge.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus("Saved the current ShapeForge project.");
  };

  const copyProject = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(project, null, 2));
      setStatus("Copied the complete ShapeForge project JSON.");
    } catch {
      setStatus("Clipboard access was blocked. Use Save Project instead.");
    }
  };

  const loadProject = async (file: File) => {
    try {
      const next = importForgeProject(JSON.parse(await file.text()));
      setUndoStack((stack) => [...stack.slice(-19), cloneProject(project)]);
      setRedoStack([]);
      setProject(next);
      setDraftRevision((value) => value + 1);
      setPrompt(next.prompt);
      setDetail(next.settings.detail);
      setOverallScale(Math.round(next.settings.scale * 100));
      setSelectedId(next.parts[0]?.id ?? null);
      setExplode(0);
      setStatus(`Recovered and loaded ${next.name}.`);
      setFitSignal((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? `Load failed: ${error.message}` : "Load failed: invalid project file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const partsPanel = (
    <PartsPanel
      project={project}
      selectedId={selectedId}
      checks={checks}
      onSelect={setSelectedId}
      onAdd={addPart}
      onCopy={copyProject}
      onUnhide={unhideAll}
    />
  );

  const inspectorPanel = (
    <InspectorPanel
      project={project}
      part={selectedPart}
      draft={draft}
      setDraft={setDraft}
      parentOptions={parentOptions}
      onApply={applyInspector}
      onToggleHidden={() => toggleSelected("hidden")}
      onToggleDetached={() => toggleSelected("detached")}
      onDelete={() => setDeleteOpen(true)}
    />
  );

  return (
    <main className="forge-shell">
      <header className="forge-topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Hexagon /><span /></span>
          <div>
            <strong>SHAPEFORGE</strong>
            <span>Recovered core · next geometry milestone</span>
          </div>
        </div>
        <div className="topbar-center">
          <Badge variant="outline" className="core-badge"><Check /> v10.1 core recovered</Badge>
          <span>{project.name}</span>
        </div>
        <div className="top-actions">
          <Button variant="ghost" size="icon-sm" aria-label="Undo" title="Undo" disabled={!undoStack.length} onClick={undo}><Undo2 /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Redo" title="Redo" disabled={!redoStack.length} onClick={redo}><Redo2 /></Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload /> <span className="action-label">Load</span></Button>
          <Button variant="outline" size="sm" onClick={saveProject}><Save /> <span className="action-label">Save</span></Button>
        </div>
      </header>

      <section className="forge-commandbar" aria-label="Shape generator">
        <div className="command-input-wrap">
          <Sparkles />
          <Input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") generate(); }}
            aria-label="Describe an object to generate"
            placeholder="Describe anything to forge…"
          />
          <Button className="generate-button" onClick={() => generate()}><Hexagon /> Generate</Button>
          <Button variant="ghost" size="icon" aria-label="Generate a random recovered example" title="Surprise me" onClick={randomize}><Shuffle /></Button>
        </div>
        <div className="generator-settings">
          <span className="setting-label">Detail</span>
          <Select value={detail} onValueChange={(value) => setDetail(value as DetailLevel)}>
            <SelectTrigger size="sm" className="detail-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
          <span className="setting-label">Scale</span>
          <Slider min={70} max={140} step={1} value={[overallScale]} onValueChange={(value) => setOverallScale(value[0])} aria-label="Generated object scale" />
          <span className="scale-value">{overallScale}%</span>
        </div>
      </section>

      <div className="forge-layout">
        <aside className="forge-panel left-panel desktop-panel">{partsPanel}</aside>

        <section className="forge-workspace">
          <div className="viewport-toolbar">
            <div className="toolbar-group">
              <Button variant="outline" size="sm" onClick={() => { setResetSignal((value) => value + 1); setStatus("View reset."); }}><RotateCcw /> Reset</Button>
              <Button variant="outline" size="sm" onClick={() => { setFitSignal((value) => value + 1); setStatus("Assembly fitted to the viewport."); }}><Maximize2 /> Fit</Button>
            </div>
            <div className="toolbar-group toolbar-view-toggles">
              <Button variant={showLabels ? "secondary" : "outline"} size="sm" onClick={() => setShowLabels((value) => !value)}><Eye /> Labels</Button>
              <Button variant={showRelations ? "secondary" : "outline"} size="sm" onClick={() => setShowRelations((value) => !value)}><GitBranch /> Relations</Button>
            </div>
          </div>

          <div className="forge-stage">
            <ForgeCanvas
              project={project}
              selectedId={selectedId}
              explode={explode}
              showLabels={showLabels}
              showRelations={showRelations}
              resetSignal={resetSignal}
              fitSignal={fitSignal}
              onSelect={setSelectedId}
            />
            <div className="stage-hint"><Move3d /> Drag to orbit · pinch or wheel to zoom · tap a part</div>
            <div className="stage-readout">
              <span>{project.parts.filter((part) => !part.hidden).length} visible</span>
              <span className="readout-divider" />
              <span>{explosionLabel(explode)}</span>
            </div>
          </div>

          <div className="explode-console">
            <div className="explode-heading">
              <div><strong>Progressive exploded view</strong><span>{explosionLabel(explode)}</span></div>
              <output>{explode}%</output>
            </div>
            <div className="explode-control-row">
              <Button variant="ghost" size="sm" onClick={() => setExplode(0)}>Assemble</Button>
              <Slider min={0} max={100} step={1} value={[explode]} onValueChange={(value) => setExplode(value[0])} aria-label="Exploded view amount" />
              <Button variant="ghost" size="sm" onClick={() => setExplode(100)}>Full explode</Button>
            </div>
            <div className="explode-scale"><span>Assembly</span><span>Subsystems</span><span>Parts</span></div>
          </div>

          <div className="edit-commandbar">
            <div className="edit-label"><Wrench /><span>Edit selected</span></div>
            <Input
              value={editCommand}
              onChange={(event) => setEditCommand(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyEditCommand(); }}
              aria-label="Edit command for selected component"
              placeholder="make this larger, detach, rename it to…"
            />
            <Button variant="outline" onClick={applyEditCommand}>Apply</Button>
          </div>

          <div className="forge-status" role="status" aria-live="polite">
            <span className="status-pulse" />
            <span>{status}</span>
            <span className="status-version">ShapeForge Project v2</span>
          </div>
        </section>

        <aside className="forge-panel right-panel desktop-panel">{inspectorPanel}</aside>
      </div>

      <nav className="mobile-dock" aria-label="ShapeForge panels">
        <Sheet>
          <SheetTrigger asChild><Button variant="ghost"><Menu /> Components</Button></SheetTrigger>
          <SheetContent side="bottom" className="mobile-sheet">
            <SheetHeader><SheetTitle>Assembly</SheetTitle><SheetDescription>{project.name} component tree and validation.</SheetDescription></SheetHeader>
            <div className="mobile-sheet-scroll">{partsPanel}</div>
          </SheetContent>
        </Sheet>
        <Button variant="ghost" onClick={() => { setExplode(explode === 100 ? 0 : 100); }}><Move3d /> {explode === 100 ? "Assemble" : "Explode"}</Button>
        <Sheet>
          <SheetTrigger asChild><Button variant="ghost"><Wrench /> Inspector</Button></SheetTrigger>
          <SheetContent side="bottom" className="mobile-sheet inspector-sheet">
            <SheetHeader><SheetTitle>Component inspector</SheetTitle><SheetDescription>Edit the selected part and its assembly relationship.</SheetDescription></SheetHeader>
            <div className="mobile-sheet-scroll">{inspectorPanel}</div>
          </SheetContent>
        </Sheet>
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => event.target.files?.[0] && loadProject(event.target.files[0])}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPart?.name ?? "this component"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its child components will move to the next valid parent. This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} className="delete-confirm"><Trash2 /> Delete component</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
