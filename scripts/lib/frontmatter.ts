import matter from "gray-matter";
import { readFileSync, writeFileSync } from "fs";

export const NOTE_KINDS = ["core", "project", "research", "thought"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const DEFAULT_NOTE_KIND: NoteKind = "project";

export interface NoteFrontmatter {
  id: string;
  title: string;
  kind?: NoteKind;
  status?: string;
  tags?: string[];
  project?: string;
  [key: string]: unknown;
}

export interface ParsedNote {
  data: NoteFrontmatter;
  body: string;
  raw: string;
}

export function parseNote(filepath: string): ParsedNote {
  const raw = readFileSync(filepath, "utf-8");
  const { data, content } = matter(raw);
  return {
    data: data as NoteFrontmatter,
    body: content.trim(),
    raw,
  };
}

export function writeNote(filepath: string, data: NoteFrontmatter, body: string) {
  // Build frontmatter manually for clean field ordering
  const fm: Record<string, unknown> = { id: data.id, title: data.title };
  if (data.kind) fm.kind = data.kind;
  if (data.status) fm.status = data.status;
  if (data.tags && data.tags.length > 0) fm.tags = data.tags;
  if (data.project) fm.project = data.project;
  // Preserve any extra fields
  for (const [k, v] of Object.entries(data)) {
    if (!(k in fm)) fm[k] = v;
  }
  const content = matter.stringify(body ? `\n${body}` : "", fm);
  writeFileSync(filepath, content);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(21);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function isNoteKind(value: string): value is NoteKind {
  return NOTE_KINDS.includes(value as NoteKind);
}

export function parseNoteKind(value: string | null | undefined): NoteKind | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "clear") return null;
  if (!isNoteKind(value)) {
    throw new Error(`invalid kind '${value}' (must be 'core', 'project', 'research', 'thought', or 'clear')`);
  }
  return value;
}

export function readNoteKind(value: unknown): NoteKind | null {
  if (typeof value !== "string") return null;
  try {
    return parseNoteKind(value) ?? null;
  } catch {
    return null;
  }
}
