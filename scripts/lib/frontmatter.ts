import matter from "gray-matter";
import { readFileSync, writeFileSync } from "fs";

export interface NoteFrontmatter {
  id: string;
  title: string;
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
