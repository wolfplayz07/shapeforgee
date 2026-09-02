import { validateForgeProject } from "../../lib/shapeforge.ts";

export function readRecord(result) {
  if (result?.isError) throw new Error(result.content?.filter(item => item.type === "text").map(item => item.text).join(" ") || "ShapeForge could not complete the action.");
  const data = result?.structuredContent;
  const project = result?._meta?.project || data?.project;
  if (!data || !project || !Number.isInteger(data.revision) || data.revision < 1 || project.id !== data.id || !Array.isArray(project.parts) || project.parts.length > 200) throw new Error("The host returned an incomplete assembly.");
  if (validateForgeProject(project).some(check => !check.ok)) throw new Error("The host returned an invalid assembly.");
  return { project, revision: data.revision, warning: data.warning || "Concept geometry; not engineering-validated." };
}

export function acceptRecord(current, incoming, allowSwitch = false) {
  if (!current) return incoming;
  if (current.project.id !== incoming.project.id) return allowSwitch ? incoming : current;
  return incoming.revision >= current.revision ? incoming : current;
}
