import { existsSync, mkdirSync, symlinkSync, readlinkSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";

export interface ChaosEnv {
  dataDir: string;
  notesDir: string;
  assetsDir: string;
  skillRoot: string;
}

export function getEnv(): ChaosEnv {
  const dataDir = process.env.CHAOS_DATA_DIR || join(process.env.HOME!, ".chaos");
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const skillRoot = dirname(dirname(scriptDir));
  const dataLink = join(skillRoot, "data");

  const notesDir = join(dataDir, "notes");
  const assetsDir = join(dataDir, "assets");

  // Create directories
  mkdirSync(notesDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  // Create symlink if missing
  if (!existsSync(dataLink)) {
    try {
      symlinkSync(dataDir, dataLink);
    } catch {
      // symlink may fail if parent doesn't exist, that's ok
    }
  }

  // Pull latest if git repo
  if (existsSync(join(dataDir, ".git"))) {
    spawnSync("git", ["-C", dataDir, "pull", "--rebase", "--quiet"], {
      stdio: "ignore",
    });
  }

  return { dataDir, notesDir, assetsDir, skillRoot };
}
