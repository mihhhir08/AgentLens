import { writeFileSync } from "node:fs";
import { resolvePaths } from "../config.js";
import { listFinalizedRunIds, readRun, writeRun } from "../core/storage.js";
import { renderReport } from "../core/report.js";
import { renderMarkdown } from "../core/summary.js";

export function report(cwd: string): void {
  const finalized = listFinalizedRunIds(cwd);
  if (finalized.length === 0) {
    console.error("No finalized AgentLens runs found in this directory.");
    process.exit(1);
  }
  const id = finalized.sort().pop()!;
  const run = readRun(cwd, id);
  run.markdownSummary = renderMarkdown(run);
  const p = resolvePaths(cwd);
  run.reportPath = p.reportHtml(id);
  writeRun(cwd, run);
  const html = renderReport(run);
  writeFileSync(p.reportHtml(id), html, "utf8");
  console.log(`Report regenerated: ${p.reportHtml(id)}`);
}
