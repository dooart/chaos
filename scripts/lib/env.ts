import { existsSync, mkdirSync, symlinkSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";

export interface ChaosEnv {
  dataDir: string;
  notesDir: string;
  assetsDir: string;
  skillRoot: string;
}

let cachedEnv: ChaosEnv | null = null;

function pullGitRepo(repoDir: string) {
  if (!existsSync(join(repoDir, ".git"))) return;
  spawnSync("git", ["-C", repoDir, "pull", "--rebase", "--quiet"], {
    stdio: "ignore",
  });
}

export function getEnv(): ChaosEnv {
  if (cachedEnv) return cachedEnv;

  const dataDir = process.env.CHAOS_DATA_DIR || join(process.env.HOME!, ".chaos");
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const skillRoot = dirname(dirname(scriptDir));
  const dataLink = join(skillRoot, "data");

  // Always sync both repos first (best effort).
  pullGitRepo(skillRoot);
  pullGitRepo(dataDir);

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

  cachedEnv = { dataDir, notesDir, assetsDir, skillRoot };
  return cachedEnv;
}
