export interface PrdStory {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: number[];
  status: "pending" | "done";
}

export interface PrdValidation {
  valid: boolean;
  stories: PrdStory[];
  errors: string[];
}

export function validatePrd(raw: unknown): PrdValidation {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, stories: [], errors: ["prd.json must be a JSON object"] };
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.stories)) {
    return { valid: false, stories: [], errors: ["prd.json must have a 'stories' array"] };
  }

  const stories: PrdStory[] = [];
  const ids = new Set<number>();

  for (let i = 0; i < obj.stories.length; i++) {
    const s = obj.stories[i];
    const prefix = `stories[${i}]`;

    if (typeof s.id !== "number") {
      errors.push(`${prefix}: id must be a number`);
      continue;
    }
    if (ids.has(s.id)) {
      errors.push(`${prefix}: duplicate id ${s.id}`);
      continue;
    }
    ids.add(s.id);

    if (typeof s.title !== "string" || !s.title) errors.push(`${prefix}: title is required`);
    if (typeof s.description !== "string") errors.push(`${prefix}: description is required`);
    if (!Array.isArray(s.acceptanceCriteria)) errors.push(`${prefix}: acceptanceCriteria must be an array`);
    if (!Array.isArray(s.dependsOn)) errors.push(`${prefix}: dependsOn must be an array`);
    if (s.status !== "pending" && s.status !== "done") errors.push(`${prefix}: status must be 'pending' or 'done'`);

    stories.push(s as PrdStory);
  }

  // Check dependency references
  for (const s of stories) {
    for (const dep of s.dependsOn) {
      if (!ids.has(dep)) {
        errors.push(`story ${s.id}: depends on non-existent story ${dep}`);
      }
    }
  }

  // Cycle detection (DFS)
  const adj = new Map<number, number[]>();
  for (const s of stories) adj.set(s.id, s.dependsOn);
  const visited = new Set<number>();
  const inStack = new Set<number>();

  function hasCycleDFS(node: number): boolean {
    visited.add(node);
    inStack.add(node);
    for (const dep of adj.get(node) || []) {
      if (inStack.has(dep)) return true;
      if (!visited.has(dep) && hasCycleDFS(dep)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const s of stories) {
    if (!visited.has(s.id) && hasCycleDFS(s.id)) {
      errors.push("dependency cycle detected");
      break;
    }
  }

  return { valid: errors.length === 0, stories, errors };
}
