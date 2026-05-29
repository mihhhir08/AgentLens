import { listFinalizedRunIds, readRun } from "../core/storage.js";
import { formatDuration } from "../core/time.js";

function pad(s: string, n: number): string {
  return (s + " ".repeat(n)).slice(0, n);
}

function highest(levels: string[]): string {
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  if (levels.includes("low")) return "low";
  return "—";
}

export function list(cwd: string): void {
  const ids = listFinalizedRunIds(cwd).sort().reverse();
  if (ids.length === 0) {
    console.log("No AgentLens runs yet.");
    return;
  }
  console.log(
    pad("ID", 36) +
      pad("BRANCH", 16) +
      pad("STARTED", 22) +
      pad("DURATION", 10) +
      pad("CMDS", 6) +
      pad("FILES", 6) +
      "RISK",
  );
  for (const id of ids) {
    try {
      const r = readRun(cwd, id);
      const dur = r.endTime
        ? new Date(r.endTime).getTime() - new Date(r.startTime).getTime()
        : 0;
      console.log(
        pad(r.id, 36) +
          pad(r.branch || "—", 16) +
          pad(r.startTime, 22) +
          pad(formatDuration(dur), 10) +
          pad(String(r.commands.length), 6) +
          pad(String(r.changedFiles.length), 6) +
          highest(r.risks.map((x) => x.level)),
      );
    } catch {
      console.log(pad(id, 36) + "(unreadable)");
    }
  }
}
