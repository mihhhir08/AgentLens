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
    pad("ID", 32) +
      pad("BRANCH", 14) +
      pad("STARTED", 26) +
      pad("DURATION", 12) +
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
        pad(r.id, 32) +
          pad(r.branch || "—", 14) +
          pad(r.startTime, 26) +
          pad(formatDuration(dur), 12) +
          pad(String(r.commands.length), 6) +
          pad(String(r.changedFiles.length), 6) +
          highest(r.risks.map((x) => x.level)),
      );
    } catch {
      console.log(pad(id, 32) + "(unreadable)");
    }
  }
}
