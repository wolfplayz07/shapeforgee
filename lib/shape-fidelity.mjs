const normalize = (value) => String(value ?? "").toLowerCase();

const hasAny = (text, words) => words.some((word) => text.includes(word));
const KNOWN_PRIMITIVES = new Set(["box", "cylinder", "capsule", "frustum", "cone", "wedge"]);

function proportions(size) {
  const values = Array.isArray(size) && size.length === 3
    ? size.map((value) => Math.max(0.001, Number(value) || 0.001))
    : [1, 1, 1];
  const sorted = [...values].sort((a, b) => b - a);
  return {
    elongation: sorted[0] / sorted[1],
    crossSectionRatio: sorted[1] / sorted[2],
    flatness: sorted[0] / sorted[2],
  };
}

export function inferPrimitiveKind(part) {
  const text = `${normalize(part.name)} ${normalize(part.category)} ${normalize(part.purpose)}`;
  const { elongation, crossSectionRatio, flatness } = proportions(part.size);

  // Strong functional shape cues come first because they are reliable across object families.
  if (hasAny(text, ["tip", "point", "needle", "spike", "bit", "nose cone"])) return "cone";
  if (hasAny(text, ["nozzle", "funnel", "chuck", "bell", "taper", "adapter"])) return "frustum";

  // Round mechanical/container vocabulary should stay round rather than becoming a generic rounded box.
  if (hasAny(text, ["wheel", "roller", "shaft", "axle", "hub", "rod", "pipe", "tube", "barrel", "bottle", "cup", "can", "motor", "stem"])) {
    return "cylinder";
  }

  // Ergonomic parts benefit from rounded silhouettes only when their proportions actually support one.
  if (hasAny(text, ["grip", "handle"]) && elongation > 1.4 && crossSectionRatio < 2.25) return "capsule";
  if (hasAny(text, ["housing", "body", "shell", "casing"]) && elongation > 1.65 && crossSectionRatio < 1.9) return "capsule";

  // Tapered structural members are useful broadly, but very slab-like parts should remain panels/boxes.
  if (hasAny(text, ["blade", "fin", "bracket", "wedge", "ramp", "support arm"]) && elongation > 1.2 && flatness < 18) return "wedge";

  if (hasAny(text, ["panel", "plate", "screen", "door", "drawer", "shelf", "top", "surface"])) return "box";

  // Preserve an explicitly assigned higher-fidelity primitive when semantic inference has no stronger cue.
  return KNOWN_PRIMITIVES.has(part.kind) ? part.kind : "box";
}

export function applyShapeFidelity(project) {
  return {
    ...project,
    parts: project.parts.map((part) => ({
      ...part,
      kind: inferPrimitiveKind(part),
    })),
    history: [...(project.history ?? []), "Applied generalized shape-fidelity primitive selection"].slice(-32),
  };
}

export function fidelityProfile(project) {
  const counts = {};
  for (const part of project.parts) {
    const kind = inferPrimitiveKind(part);
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}
