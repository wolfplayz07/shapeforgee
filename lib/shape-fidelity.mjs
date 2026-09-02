const normalize = (value) => String(value ?? "").toLowerCase();

const hasAny = (text, words) => words.some((word) => text.includes(word));

export function inferPrimitiveKind(part) {
  const text = `${normalize(part.name)} ${normalize(part.category)} ${normalize(part.purpose)}`;
  const size = Array.isArray(part.size) && part.size.length === 3 ? part.size.map(Number) : [1, 1, 1];
  const sorted = [...size].sort((a, b) => b - a);
  const elongation = sorted[0] / Math.max(sorted[1], 0.001);
  const thinness = sorted[1] / Math.max(sorted[2], 0.001);

  if (hasAny(text, ["tip", "point", "needle", "spike", "bit", "nose cone"])) return "cone";
  if (hasAny(text, ["nozzle", "funnel", "chuck", "bell", "taper", "adapter"])) return "frustum";
  if (hasAny(text, ["grip", "handle", "housing", "body", "shell", "barrel", "tube"]) && elongation > 1.35) return "capsule";
  if (hasAny(text, ["blade", "fin", "bracket", "wedge", "ramp", "support arm"]) && elongation > 1.2) return "wedge";
  if (hasAny(text, ["wheel", "roller", "shaft", "axle", "hub", "rod", "pipe", "bottle", "cup", "can", "motor"])) return "cylinder";
  if (thinness > 3.2 && hasAny(text, ["panel", "plate", "screen", "door", "drawer", "shelf", "top", "surface"])) return "box";
  return part.kind === "cylinder" ? "cylinder" : "box";
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
