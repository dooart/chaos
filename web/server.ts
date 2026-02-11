import { Hono } from "hono";

import { getCookie, setCookie } from "hono/cookie";
import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = dirname(__dirname);
const DATA_DIR = join(SKILL_ROOT, "data");
const NOTES_DIR = join(DATA_DIR, "notes");
const ASSETS_DIR = join(DATA_DIR, "assets");
const SCRIPTS_DIR = join(SKILL_ROOT, "scripts");

const AUTH_USER = process.env.AUTH_USER || "";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";

if (!AUTH_USER || !AUTH_PASSWORD) {
  console.error("Error: AUTH_USER and AUTH_PASSWORD must be set in web/.env");
  console.error("Example:");
  console.error("  AUTH_USER=myusername");
  console.error("  AUTH_PASSWORD=mysecretpassword");
  process.exit(1);
}
const SESSION_COOKIE = "chaos_session";
const SESSION_TOKEN = Buffer.from(`${AUTH_USER}:${AUTH_PASSWORD}`).toString("base64");

const app = new Hono();

// Basic request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

// Auth middleware
app.use("/chaos/api/*", async (c, next) => {
  const session = getCookie(c, SESSION_COOKIE);
  if (session !== SESSION_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Login endpoint
app.post("/chaos/auth/login", async (c) => {
  const body = await c.req.json();
  if (body.username === AUTH_USER && body.password === AUTH_PASSWORD) {
    setCookie(c, SESSION_COOKIE, SESSION_TOKEN, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return c.json({ success: true });
  }
  return c.json({ error: "Invalid credentials" }, 401);
});

// Check auth status
app.get("/chaos/auth/status", (c) => {
  const session = getCookie(c, SESSION_COOKIE);
  return c.json({ authenticated: session === SESSION_TOKEN });
});

// Logout
app.post("/chaos/auth/logout", (c) => {
  setCookie(c, SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return c.json({ success: true });
});

// Manual logout via GET - redirects to login
app.get("/chaos/logout", (c) => {
  setCookie(c, SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return c.redirect("/chaos/");
});

// Helper to run scripts
function runScript(script: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("bash", [join(SCRIPTS_DIR, script), ...args], {
      cwd: SKILL_ROOT,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => (stdout += data));
    proc.stderr.on("data", (data) => (stderr += data));
    proc.on("close", (code) => {
      const result = { stdout, stderr, code: code ?? 1 };
      if (result.code !== 0) {
        console.error(`[script error] ${script} ${args.join(' ')}`);
        console.error(result.stderr || result.stdout);
      }
      resolve(result);
    });
  });
}

// Helper to parse frontmatter
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  
  const frontmatter: Record<string, any> = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      // Parse YAML arrays
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean) as any;
      }
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body: match[2] };
}

// Helper to resolve [[id]] links with titles
async function resolveLinks(content: string, notesCache: Map<string, { id: string; title: string }>): Promise<string> {
  // Match [[id]] or [[id|custom]]
  const linkRegex = /\[\[([a-z0-9]{21})(?:\|([^\]]+))?\]\]/g;
  let result = content;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const [fullMatch, id, customTitle] = match;
    if (customTitle) continue; // Keep custom titles as-is
    
    const note = notesCache.get(id);
    if (note) {
      result = result.replace(fullMatch, `[[${id}|${note.title}]]`);
    }
  }
  return result;
}

// List notes with pagination
app.get("/chaos/api/notes", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const search = c.req.query("search") || "";
  
  try {
    const files = await readdir(NOTES_DIR);
    const noteFiles = files.filter((f) => f.endsWith(".md"));
    
    // Load all notes with metadata
    const notes = await Promise.all(
      noteFiles.map(async (filename) => {
        const filepath = join(NOTES_DIR, filename);
        const content = await readFile(filepath, "utf-8");
        const { frontmatter, body } = parseFrontmatter(content);
        const stats = await stat(filepath);
        return {
          id: frontmatter.id || "",
          title: frontmatter.title || "",
          status: frontmatter.status || null,
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
          filename,
          mtime: stats.mtimeMs,
          body,
        };
      })
    );
    
    // Filter by search
    let filtered = notes;
    if (search) {
      const q = search.toLowerCase();
      filtered = notes.filter((n) => {
        // Priority: title > tags > content
        if (n.title.toLowerCase().includes(q)) return true;
        if (n.tags.some((t: string) => t.toLowerCase().includes(q))) return true;
        if (n.body.toLowerCase().includes(q)) return true;
        return false;
      });
      
      // Sort by relevance (title matches first)
      filtered.sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(q) ? 0 : 1;
        const bTitle = b.title.toLowerCase().includes(q) ? 0 : 1;
        if (aTitle !== bTitle) return aTitle - bTitle;
        return b.mtime - a.mtime;
      });
    } else {
      // Sort by mtime descending
      filtered.sort((a, b) => b.mtime - a.mtime);
    }
    
    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit).map(({ body, ...rest }) => rest);
    
    return c.json({
      notes: paginated,
      total,
      page,
      limit,
      hasMore: start + limit < total,
    });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Get single note
app.get("/chaos/api/notes/:id", async (c) => {
  const id = c.req.param("id");
  
  try {
    const files = await readdir(NOTES_DIR);
    const filename = files.find((f) => f.startsWith(`${id}-`) && f.endsWith(".md"));
    
    if (!filename) {
      return c.json({ error: "Note not found" }, 404);
    }
    
    const filepath = join(NOTES_DIR, filename);
    const content = await readFile(filepath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);
    
    // Build notes cache for link resolution
    const notesCache = new Map<string, { id: string; title: string }>();
    for (const f of files) {
      if (f.endsWith(".md")) {
        const c = await readFile(join(NOTES_DIR, f), "utf-8");
        const { frontmatter: fm } = parseFrontmatter(c);
        if (fm.id) notesCache.set(fm.id, { id: fm.id, title: fm.title || "" });
      }
    }
    
    const resolvedBody = await resolveLinks(body, notesCache);
    
    return c.json({
      id: frontmatter.id,
      title: frontmatter.title,
      status: frontmatter.status || null,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      filename,
      content, // raw content for editing
      body,    // body without frontmatter
      resolvedBody, // body with resolved links for preview
    });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Create note
app.post("/chaos/api/notes", async (c) => {
  const body = await c.req.json();
  const { title } = body;
  
  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }
  
  const result = await runScript("new-note.sh", [title]);
  
  if (result.code !== 0) {
    return c.json({ error: result.stderr || "Failed to create note" }, 500);
  }
  
  // Extract ID from filepath
  const filepath = result.stdout.trim();
  const filename = filepath.split("/").pop() || "";
  const id = filename.split("-")[0];
  
  return c.json({ id, filepath });
});

// Update note content
app.put("/chaos/api/notes/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { content } = body;
  
  try {
    const files = await readdir(NOTES_DIR);
    const filename = files.find((f) => f.startsWith(`${id}-`) && f.endsWith(".md"));
    
    if (!filename) {
      return c.json({ error: "Note not found" }, 404);
    }
    
    const filepath = join(NOTES_DIR, filename);
    await writeFile(filepath, content);
    
    const result = await runScript("commit-changes.sh", [filepath]);
    
    if (result.code !== 0) {
      return c.json({ error: result.stderr || "Failed to commit" }, 500);
    }
    
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Rename note
app.post("/chaos/api/notes/:id/rename", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { title } = body;
  
  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }
  
  const result = await runScript("rename-note.sh", [id, title]);
  
  if (result.code !== 0) {
    return c.json({ error: result.stderr || "Failed to rename note" }, 500);
  }
  
  return c.json({ success: true, filepath: result.stdout.trim() });
});

// Delete note
app.delete("/chaos/api/notes/:id", async (c) => {
  const id = c.req.param("id");
  
  const result = await runScript("delete-note.sh", [id]);
  
  if (result.code !== 0) {
    return c.json({ error: result.stderr || "Failed to delete note" }, 500);
  }
  
  return c.json({ success: true });
});

// Serve chaos assets (images) or built web assets
app.get("/chaos/assets/:filename", async (c) => {
  const filename = c.req.param("filename");

  // Prefer user assets (images)
  const userAssetPath = join(ASSETS_DIR, filename);
  const userFile = Bun.file(userAssetPath);
  if (await userFile.exists()) {
    return new Response(userFile, { headers: { "Content-Type": "image/webp" } });
  }

  // Fallback to web build assets
  const filepath = join(__dirname, "dist", "assets", filename);
  const file = Bun.file(filepath);
  if (!(await file.exists())) {
    return c.json({ error: "Not found" }, 404);
  }

  const content = await file.arrayBuffer();
  let contentType = "application/octet-stream";
  if (filename.endsWith(".js")) contentType = "application/javascript";
  else if (filename.endsWith(".css")) contentType = "text/css";
  else if (filename.endsWith(".svg")) contentType = "image/svg+xml";

  return new Response(content, { headers: { "Content-Type": contentType } });
});

app.get("/chaos/logo.webp", async (c) => {
  const file = Bun.file(join(__dirname, "dist", "logo.webp"));
  const content = await file.arrayBuffer();
  return new Response(content, { headers: { "Content-Type": "image/webp" } });
});

// SPA fallback for non-API routes
app.get("/*", async (c) => {
  const path = c.req.path;
  if (path.startsWith("/chaos/api") || path.startsWith("/chaos/auth")) {
    return c.json({ error: "Not found" }, 404);
  }
  const file = Bun.file(join(__dirname, "dist", "index.html"));
  return new Response(file, { headers: { "Content-Type": "text/html" } });
});

const port = process.env.PORT || 24680;
console.log(`Chaos server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
