import sharp from "sharp";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { getEnv } from "./env.ts";
import { commitAndPush } from "./git.ts";

export async function addImageToNote(
  noteId: string,
  imagePath: string,
  description: string
): Promise<string> {
  const env = getEnv();

  // Find the note
  const { readdirSync } = await import("fs");
  const files = readdirSync(env.notesDir);
  const noteFile = files.find((f) => f.startsWith(`${noteId}-`) && f.endsWith(".md"));
  if (!noteFile) throw new Error(`note with id '${noteId}' not found`);
  const notePath = join(env.notesDir, noteFile);

  mkdirSync(env.assetsDir, { recursive: true });

  const stamp = Math.floor(Date.now() / 1000);
  const baseName = `${noteId}-${stamp}`;
  const outWebp = join(env.assetsDir, `${baseName}.webp`);
  const outMeta = join(env.assetsDir, `${baseName}.md`);

  // Convert with sharp: auto-orient, strip exif, resize, webp
  await sharp(imagePath)
    .rotate() // auto-orient
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 95 })
    .toFile(outWebp);

  // Write metadata
  writeFileSync(
    outMeta,
    `---\nimage: ${baseName}.webp\ndescription: |\n  ${description}\n---\n`
  );

  // Append to note
  appendFileSync(notePath, `\n![${description}](/chaos/assets/${baseName}.webp)\n`);

  // Commit
  const slug = noteFile.replace(/^[^-]+-/, "").replace(/\.md$/, "");
  commitAndPush(
    env.dataDir,
    [notePath, outWebp, outMeta],
    `updated note ${noteId}-${slug} with image`
  );

  return `added image ${baseName}.webp to ${notePath}`;
}
