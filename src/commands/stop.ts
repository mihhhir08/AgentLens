import { writeFileSync } from "node:fs";
import { resolvePaths } from "../config.js";
import { readActive, writeRun, clearActive } from "../core/storage.js";
import { takeSnapshot, parseChangedFilesFromStatus } from "../git.js";
import { detectRisks } from "../core/risks.js";
import { renderMarkdown } from "../core/summary.js";
import { renderReport } from "../core/report.js";

export function stop(cwd: string): void {
  const active = readActive(cwd);
  if (!active) {
    console.error("No active AgentLens session.");
    process.exit(1);
  }
  const p = resolvePaths(cwd);
  active.endTime = new Date().toISOString();
  active.finalGit = takeSnapshot(cwd);
  active.changedFiles = parseChangedFilesFromStatus(active.finalGit.statusShort);
  active.risks = detectRisks(active);
  active.markdownSummary = renderMarkdown(active);
  active.reportPath = p.reportHtml(active.id);

  writeRun(cwd, active);
  const html = renderReport(active);
  writeFileSync(p.reportHtml(active.id), html, "utf8");
  clearActive(cwd);

  console.log("✓ AgentLens run finalized.");
  console.log(`  Run id: ${active.id}`);
  console.log(`  Report: ${p.reportHtml(active.id)}`);
  console.log(`  Open it: agentlens open ${active.id}`);
}
