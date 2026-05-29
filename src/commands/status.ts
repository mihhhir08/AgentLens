import { readActive, listFinalizedRunIds } from "../core/storage.js";
import { resolvePaths } from "../config.js";
import { formatRelative } from "../core/time.js";
import { isGitRepo, getStatusShort, parseChangedFilesFromStatus } from "../git.js";

export function status(cwd: string): void {
  const p = resolvePaths(cwd);
  const active = readActive(cwd);
  if (active) {
    console.log("● AgentLens session active");
    console.log(`  Run id: ${active.id}`);
    console.log(`  Started: ${active.startTime}  (${formatRelative(active.startTime)})`);
    console.log(`  cwd: ${active.cwd}`);
    console.log(`  Branch: ${active.branch || "(none)"}`);
    console.log(`  Commands recorded: ${active.commands.length}`);
    if (isGitRepo(cwd)) {
      const live = parseChangedFilesFromStatus(getStatusShort(cwd));
      console.log(`  Changed files (live): ${live.length}`);
    }
    return;
  }
  console.log("○ No active AgentLens session.");
  const finalized = listFinalizedRunIds(cwd);
  if (finalized.length > 0) {
    const last = finalized.sort().pop()!;
    console.log(`  Most recent run: ${last}`);
    console.log(`  Report: ${p.reportHtml(last)}`);
  } else {
    console.log("  No finalized runs yet. Run `agentlens start` to begin.");
  }
}
