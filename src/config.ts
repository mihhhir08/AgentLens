import { join } from "node:path";

export function resolvePaths(cwd: string) {
  const root = join(cwd, ".agentlens");
  return {
    root,
    runsDir: join(root, "runs"),
    activePath: join(root, "active.json"),
    runDir: (id: string) => join(root, "runs", id),
    runJson: (id: string) => join(root, "runs", id, "run.json"),
    reportHtml: (id: string) => join(root, "runs", id, "report.html"),
  };
}

export function generateRunId(now: Date = new Date()): string {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${iso}_${rand}`;
}
