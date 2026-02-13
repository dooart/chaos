import { existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

function run(dataDir: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync("git", args, { cwd: dataDir, encoding: "utf-8" });
  return { ok: result.status === 0, output: (result.stdout || "").trim() };
}

export function isGitRepo(dataDir: string): boolean {
  return existsSync(join(dataDir, ".git"));
}

export function gitAdd(dataDir: string, files: string[]) {
  if (!isGitRepo(dataDir)) return;
  run(dataDir, ["add", ...files]);
}

export function gitAddAll(dataDir: string) {
  if (!isGitRepo(dataDir)) return;
  // Use -A with explicit path to notes/assets
  run(dataDir, ["add", "-A", "notes/", "assets/"]);
}

export function gitCommit(dataDir: string, message: string): boolean {
  if (!isGitRepo(dataDir)) return false;
  const result = run(dataDir, ["commit", "-m", message]);
  return result.ok;
}

export function gitPush(dataDir: string) {
  if (!isGitRepo(dataDir)) return;
  const hasRemote = run(dataDir, ["remote"]);
  if (hasRemote.ok && hasRemote.output.length > 0) {
    run(dataDir, ["push"]);
  }
}

export function commitAndPush(dataDir: string, files: string[], message: string): boolean {
  if (!isGitRepo(dataDir)) return false;
  gitAdd(dataDir, files);
  const committed = gitCommit(dataDir, message);
  if (committed) gitPush(dataDir);
  return committed;
}
