"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ForgePart, ForgeProject, Vec3 } from "@/lib/shapeforge";

interface ForgeCanvasProps {
  project: ForgeProject;
  selectedId: string | null;
  explode: number;
  showLabels: boolean;
  showRelations: boolean;
  resetSignal: number;
  fitSignal: number;
  onSelect: (id: string) => void;
}

interface ViewState {
  yaw: number;
  pitch: number;
  zoom: number;
}

interface ScreenPoint {
  x: number;
  y: number;
  z: number;
  scale: number;
}

interface RenderFace {
  part: ForgePart;
  points: ScreenPoint[];
  depth: number;
  shade: number;
}

interface HitArea {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  depth: number;
}

const DEFAULT_VIEW: ViewState = { yaw: -0.58, pitch: 0.36, zoom: 1.35 };
const BOX_FACES = [
  [0, 1, 2, 3],
  [4, 7, 6, 5],
  [0, 4, 5, 1],
  [3, 2, 6, 7],
  [1, 5, 6, 2],
  [0, 3, 7, 4],
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const multiply = (value: Vec3, scalar: number): Vec3 =>
  [value[0] * scalar, value[1] * scalar, value[2] * scalar];

function rotateLocal(point: Vec3, rotation: Vec3): Vec3 {
  const [rx, ry, rz] = rotation.map((value) => (value * Math.PI) / 180);
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

function shadeColor(hex: string, amount: number) {
  const cleaned = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(value)) return hex;
  const red = clamp((value >> 16) + amount, 0, 255);
  const green = clamp(((value >> 8) & 255) + amount, 0, 255);
  const blue = clamp((value & 255) + amount, 0, 255);
  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
}

function hierarchyDepth(part: ForgePart, byId: Map<string, ForgePart>) {
  let depth = 0;
  let current = part;
  const visited = new Set<string>();
  while (current.parent && byId.has(current.parent) && !visited.has(current.parent)) {
    visited.add(current.parent);
    depth += 1;
    current = byId.get(current.parent)!;
  }
  return depth;
}

function explosionOffset(part: ForgePart, byId: Map<string, ForgePart>, explode: number): Vec3 {
  const major = clamp(explode / 55, 0, 1);
  const detail = clamp((explode - 42) / 58, 0, 1);
  const chain: ForgePart[] = [];
  let current: ForgePart | undefined = part;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    chain.unshift(current);
    visited.add(current.id);
    current = current.parent ? byId.get(current.parent) : undefined;
  }

  let offset: Vec3 = [0, 0, 0];
  chain.forEach((node) => {
    const depth = hierarchyDepth(node, byId);
    const factor = depth <= 1 ? major : detail;
    offset = add(offset, multiply(node.explode, factor));
  });
  if (part.detached) offset = add(offset, [65, -42, 78]);
  return offset;
}

function boxMesh(part: ForgePart, center: Vec3) {
  const [width, height, depth] = part.size.map((value) => value / 2);
  const local: Vec3[] = [
    [-width, -height, -depth],
    [width, -height, -depth],
    [width, height, -depth],
    [-width, height, -depth],
    [-width, -height, depth],
    [width, -height, depth],
    [width, height, depth],
    [-width, height, depth],
  ];
  const points = local.map((point) => add(rotateLocal(point, part.rotation), center));
  return {
    points,
    faces: BOX_FACES.map((indices, index) => ({ indices, shade: [-20, 14, -8, 9, -2, -13][index] })),
  };
}

function cylinderMesh(part: ForgePart, center: Vec3) {
  const segments = 16;
  const axis = part.axis ?? "z";
  const [sx, sy, sz] = part.size;
  const points: Vec3[] = [];

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      let point: Vec3;
      if (axis === "x") point = [side * sx / 2, cosine * sy / 2, sine * sz / 2];
      else if (axis === "y") point = [cosine * sx / 2, side * sy / 2, sine * sz / 2];
      else point = [cosine * sx / 2, sine * sy / 2, side * sz / 2];
      points.push(add(rotateLocal(point, part.rotation), center));
    }
  }

  const faces: Array<{ indices: number[]; shade: number }> = [];
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    faces.push({ indices: [i, next, segments + next, segments + i], shade: -14 + Math.round(Math.cos((i / segments) * Math.PI * 2) * 20) });
  }
  faces.push({ indices: Array.from({ length: segments }, (_, index) => segments - 1 - index), shade: -18 });
  faces.push({ indices: Array.from({ length: segments }, (_, index) => segments + index), shade: 13 });
  return { points, faces };
}

export function ForgeCanvas({
  project,
  selectedId,
  explode,
  showLabels,
  showRelations,
  resetSignal,
  fitSignal,
  onSelect,
}: ForgeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<ViewState>({ ...DEFAULT_VIEW });
  const hitsRef = useRef<HitArea[]>([]);
  const drawRef = useRef<() => void>(() => undefined);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef({
    lastX: 0,
    lastY: 0,
    downX: 0,
    downY: 0,
    moved: false,
    pinching: false,
    pinchDistance: 0,
    pinchZoom: 1,
  });

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const extent = project.parts.reduce((maximum, part) => {
      const distance = Math.hypot(...part.position);
      return Math.max(maximum, distance + Math.max(...part.size));
    }, 160);
    viewRef.current.zoom = clamp(Math.min(rect.width, rect.height) / (extent * 1.65), 0.48, 2.05);
    drawRef.current();
  }, [project]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const view = viewRef.current;
    const byId = new Map(project.parts.map((part) => [part.id, part]));

    const projectPoint = (point: Vec3): ScreenPoint => {
      const [x, y, z] = point;
      const cy = Math.cos(view.yaw);
      const sy = Math.sin(view.yaw);
      const cp = Math.cos(view.pitch);
      const sp = Math.sin(view.pitch);
      const rotatedX = x * cy - z * sy;
      const firstZ = x * sy + z * cy;
      const rotatedY = y * cp - firstZ * sp;
      const rotatedZ = y * sp + firstZ * cp;
      const perspective = clamp(1 + rotatedZ / 1450, 0.62, 1.5);
      const scale = view.zoom * perspective;
      return {
        x: width / 2 + rotatedX * scale,
        y: height / 2 - rotatedY * scale,
        z: rotatedZ,
        scale,
      };
    };

    context.clearRect(0, 0, width, height);

    const backdrop = context.createRadialGradient(width * 0.52, height * 0.42, 20, width * 0.52, height * 0.42, Math.max(width, height) * 0.72);
    backdrop.addColorStop(0, "#152536");
    backdrop.addColorStop(0.52, "#0b141e");
    backdrop.addColorStop(1, "#060a0f");
    context.fillStyle = backdrop;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = 0.3;
    context.strokeStyle = "#37506a";
    context.lineWidth = 1;
    for (let index = -7; index <= 7; index += 1) {
      const a = projectPoint([index * 48, 145, -280]);
      const b = projectPoint([index * 48, 145, 280]);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();

      const c = projectPoint([-340, 145, index * 48]);
      const d = projectPoint([340, 145, index * 48]);
      context.beginPath();
      context.moveTo(c.x, c.y);
      context.lineTo(d.x, d.y);
      context.stroke();
    }
    context.restore();

    const faces: RenderFace[] = [];
    const projectedByPart = new Map<string, ScreenPoint[]>();
    const centers = new Map<string, ScreenPoint>();

    project.parts.filter((part) => !part.hidden).forEach((part) => {
      const center = add(part.position, explosionOffset(part, byId, explode));
      const mesh = part.kind === "cylinder" ? cylinderMesh(part, center) : boxMesh(part, center);
      const projected = mesh.points.map(projectPoint);
      projectedByPart.set(part.id, projected);
      centers.set(part.id, projectPoint(center));
      mesh.faces.forEach((face) => {
        const points = face.indices.map((index) => projected[index]);
        faces.push({
          part,
          points,
          depth: points.reduce((sum, point) => sum + point.z, 0) / points.length,
          shade: face.shade,
        });
      });
    });

    faces.sort((a, b) => a.depth - b.depth);
    faces.forEach((face) => {
      if (face.points.length < 3) return;
      context.beginPath();
      context.moveTo(face.points[0].x, face.points[0].y);
      face.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.closePath();
      context.fillStyle = shadeColor(face.part.color, face.shade);
      context.fill();
      const selected = face.part.id === selectedId;
      context.strokeStyle = selected ? "#65c5ff" : "rgba(2, 7, 12, .72)";
      context.lineWidth = selected ? 2.1 : 1;
      context.stroke();
    });

    if (showRelations && selectedId) {
      const selected = byId.get(selectedId);
      const start = centers.get(selectedId);
      if (selected && start) {
        const related = new Set(selected.related);
        project.parts.forEach((part) => {
          if (part.related.includes(selectedId)) related.add(part.id);
        });
        context.save();
        context.setLineDash([7, 6]);
        context.strokeStyle = "rgba(80, 194, 255, .9)";
        context.lineWidth = 1.6;
        related.forEach((id) => {
          const end = centers.get(id);
          if (!end) return;
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        });
        context.restore();
      }
    }

    const hitAreas: HitArea[] = [];
    projectedByPart.forEach((points, id) => {
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      hitAreas.push({
        id,
        minX: Math.min(...xs) - 7,
        maxX: Math.max(...xs) + 7,
        minY: Math.min(...ys) - 7,
        maxY: Math.max(...ys) + 7,
        depth: points.reduce((sum, point) => sum + point.z, 0) / points.length,
      });
    });
    hitsRef.current = hitAreas;

    const labelParts = showLabels
      ? project.parts.filter((part) => !part.hidden)
      : project.parts.filter((part) => part.id === selectedId && !part.hidden);
    context.font = "600 11px ui-sans-serif, system-ui";
    context.textAlign = "center";
    labelParts.forEach((part) => {
      const center = centers.get(part.id);
      if (!center) return;
      const label = part.name;
      const textWidth = context.measureText(label).width;
      const labelY = center.y - Math.max(20, part.size[1] * center.scale * 0.54);
      context.fillStyle = part.id === selectedId ? "rgba(10, 24, 36, .96)" : "rgba(6, 13, 20, .82)";
      context.strokeStyle = part.id === selectedId ? "#59beff" : "rgba(110, 139, 164, .55)";
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(center.x - textWidth / 2 - 7, labelY - 15, textWidth + 14, 21, 4);
      context.fill();
      context.stroke();
      context.fillStyle = "#e9f5ff";
      context.fillText(label, center.x, labelY);
    });

    context.save();
    context.font = "10px ui-monospace, SFMono-Regular, monospace";
    context.fillStyle = "rgba(129, 158, 184, .65)";
    context.textAlign = "left";
    context.fillText("X", width - 58, height - 28);
    context.fillStyle = "#56c7ff";
    context.fillRect(width - 44, height - 32, 28, 2);
    context.fillStyle = "rgba(129, 158, 184, .65)";
    context.fillText("Y", width - 58, height - 49);
    context.fillStyle = "#79da9c";
    context.fillRect(width - 38, height - 62, 2, 24);
    context.restore();
  }, [explode, project, selectedId, showLabels, showRelations]);

  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const context = canvas.getContext("2d");
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    viewRef.current = { ...DEFAULT_VIEW };
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [project.id, project.createdAt, fit]);

  useEffect(() => {
    viewRef.current = { ...DEFAULT_VIEW };
    drawRef.current();
  }, [resetSignal]);

  useEffect(() => {
    fit();
  }, [fitSignal, fit]);

  const canvasPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;
    if (pointersRef.current.size === 1) {
      gesture.lastX = point.x;
      gesture.lastY = point.y;
      gesture.downX = point.x;
      gesture.downY = point.y;
      gesture.moved = false;
      gesture.pinching = false;
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      gesture.pinching = true;
      gesture.pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      gesture.pinchZoom = viewRef.current.zoom;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = canvasPosition(event);
    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;

    if (pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      viewRef.current.zoom = clamp(gesture.pinchZoom * (distance / Math.max(1, gesture.pinchDistance)), 0.32, 3.6);
      gesture.moved = true;
      drawRef.current();
      return;
    }

    const dx = point.x - gesture.lastX;
    const dy = point.y - gesture.lastY;
    if (Math.hypot(point.x - gesture.downX, point.y - gesture.downY) > 3) gesture.moved = true;
    viewRef.current.yaw += dx * 0.009;
    viewRef.current.pitch = clamp(viewRef.current.pitch - dy * 0.007, -1.18, 1.18);
    gesture.lastX = point.x;
    gesture.lastY = point.y;
    drawRef.current();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPosition(event);
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    if (!gesture.moved && !gesture.pinching) {
      const match = hitsRef.current
        .filter((hit) => point.x >= hit.minX && point.x <= hit.maxX && point.y >= hit.minY && point.y <= hit.maxY)
        .sort((a, b) => b.depth - a.depth)[0];
      if (match) onSelect(match.id);
    }
    if (pointersRef.current.size < 2) gesture.pinching = false;
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    viewRef.current.zoom = clamp(viewRef.current.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.32, 3.6);
    drawRef.current();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "Home") viewRef.current = { ...DEFAULT_VIEW };
    else if (event.key === "+" || event.key === "=") viewRef.current.zoom = clamp(viewRef.current.zoom * 1.1, 0.32, 3.6);
    else if (event.key === "-" || event.key === "_") viewRef.current.zoom = clamp(viewRef.current.zoom * 0.9, 0.32, 3.6);
    else if (event.key === "ArrowLeft") viewRef.current.yaw -= 0.1;
    else if (event.key === "ArrowRight") viewRef.current.yaw += 0.1;
    else if (event.key === "ArrowUp") viewRef.current.pitch = clamp(viewRef.current.pitch + 0.1, -1.18, 1.18);
    else if (event.key === "ArrowDown") viewRef.current.pitch = clamp(viewRef.current.pitch - 0.1, -1.18, 1.18);
    else return;
    event.preventDefault();
    drawRef.current();
  };

  return (
    <canvas
      ref={canvasRef}
      className="forge-canvas"
      aria-label={`Interactive 3D exploded view of ${project.name}. Drag to orbit, pinch or scroll to zoom, and tap a component to select it.`}
      role="img"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    />
  );
}
