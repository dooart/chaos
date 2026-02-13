import { readdirSync, readFileSync, renameSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { getEnv, type ChaosEnv } from "./env.ts";
import {
  parseNote,
  writeNote,
  slugify,
  generateId,
  type NoteFrontmatter,
} from "./frontmatter.ts";
import { commitAndPush, gitAddAll, gitCommit, gitPush, isGitRepo } from "./git.ts";

function findNoteFile(notesDir: string, id: string): string | null {
  const files = readdirSync(notesDir);
  const match = files.find((f) => f.startsWith(`${id}-`) && f.endsWith(".md"));
  return match ? join(notesDir, match) : null;
}

export function newNote(title: string): string {
  const env = getEnv();
  const id = generateId();
  const slug = slugify(title);
  const filename = `${id}-${slug}.md`;
  const filepath = join(env.notesDir, filename);

  writeNote(filepath, { id, title }, "");
  commitAndPush(env.dataDir, [filepath], `created note ${id}-${slug}`);
  return filepath;
}

export interface UpdateOptions {
  status?: string | null; // null = clear
  tags?: string[] | null; // null = clear
  content?: string;
}

export function updateNote(id: string, opts: UpdateOptions): string {
  const env = getEnv();
  const filepath = findNoteFile(env.notesDir, id);
  if (!filepath) throw new Error(`note with id '${id}' not found`);

  const note = parseNote(filepath);
  const data = { ...note.data };

  if (opts.status !== undefined) {
    if (opts.status === null || opts.status === "clear" || opts.status === "") {
      delete data.status;
    } else {
      if (opts.status !== "building" && opts.status !== "done") {
        throw new Error(`invalid status '${opts.status}' (must be 'building', 'done', or 'clear')`);
      }
      data.status = opts.status;
    }
  }

  if (opts.tags !== undefined) {
    if (opts.tags === null || (Array.isArray(opts.tags) && opts.tags.length === 0)) {
      delete data.tags;
    } else {
      for (const tag of opts.tags!) {
        if (!/^[a-z0-9-]{1,20}$/.test(tag)) {
          throw new Error(`invalid tag '${tag}' (must be lowercase alphanumeric with hyphens, max 20 chars)`);
        }
      }
      data.tags = opts.tags!;
    }
  }

  const body = opts.content !== undefined ? opts.content : note.body;
  writeNote(filepath, data as NoteFrontmatter, body);

  const slug = basename(filepath).replace(/^[^-]+-/, "").replace(/\.md$/, "");
  commitAndPush(env.dataDir, [filepath], `updated note ${id}-${slug}`);
  return filepath;
}

export function renameNote(id: string, newTitle: string): string {
  const env = getEnv();
  const oldPath = findNoteFile(env.notesDir, id);
  if (!oldPath) throw new Error(`note with id '${id}' not found`);

  const note = parseNote(oldPath);
  const data = { ...note.data, title: newTitle };
  writeNote(oldPath, data as NoteFrontmatter, note.body);

  const newSlug = slugify(newTitle);
  const newFilename = `${id}-${newSlug}.md`;
  const newPath = join(env.notesDir, newFilename);

  if (oldPath !== newPath) {
    renameSync(oldPath, newPath);
  }

  if (isGitRepo(env.dataDir)) {
    gitAddAll(env.dataDir);
    gitCommit(env.dataDir, `renamed note ${id} to ${newSlug}`);
    gitPush(env.dataDir);
  }

  return newPath;
}

export function deleteNote(id: string): string {
  const env = getEnv();
  const filepath = findNoteFile(env.notesDir, id);
  if (!filepath) throw new Error(`note with id '${id}' not found`);

  const slug = basename(filepath).replace(/^[^-]+-/, "").replace(/\.md$/, "");
  unlinkSync(filepath);

  if (isGitRepo(env.dataDir)) {
    gitAddAll(env.dataDir);
    gitCommit(env.dataDir, `deleted note ${id}-${slug}`);
    gitPush(env.dataDir);
  }

  return filepath;
}

export interface SearchResult {
  id: string;
  title: string;
  status: string | null;
  tags: string[];
  filename: string;
  path: string;
}

export function searchNotes(query: string): SearchResult[] {
  const env = getEnv();
  const files = readdirSync(env.notesDir).filter((f) => f.endsWith(".md"));
  const results: SearchResult[] = [];
  const q = query.toLowerCase();

  for (const file of files) {
    const filepath = join(env.notesDir, file);
    try {
      const note = parseNote(filepath);
      const searchable = [
        note.data.title,
        note.body,
        ...(note.data.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      if (searchable.includes(q)) {
        results.push({
          id: note.data.id,
          title: note.data.title,
          status: note.data.status || null,
          tags: note.data.tags || [],
          filename: file,
          path: `/chaos/note/${note.data.id}`,
        });
      }
    } catch {
      // Skip files with unparseable frontmatter
      // Fall back to raw text search
      const raw = readFileSync(filepath, "utf-8").toLowerCase();
      if (raw.includes(q)) {
        // Extract ID from filename
        const id = file.split("-")[0];
        results.push({
          id,
          title: file.replace(/^[^-]+-/, "").replace(/\.md$/, "").replace(/-/g, " "),
          status: null,
          tags: [],
          filename: file,
          path: `/chaos/note/${id}`,
        });
      }
    }
  }

  return results;
}
