import type { AgentLensRun, CommandEvent } from "./types.js";
import { formatDuration } from "./time.js";

function durationMs(run: AgentLensRun): number {
  if (!run.endTime) return 0;
  return new Date(run.endTime).getTime() - new Date(run.startTime).getTime();
}

function commandLine(c: CommandEvent): string {
  const verdict = c.exitCode === 0 ? "passed" : c.exitCode === null ? "interrupted" : "failed";
  return `- ${c.command} — ${verdict} in ${formatDuration(c.durationMs)}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function renderMarkdown(run: AgentLensRun): string {
  const branch = run.branch || "(none)";
  const commit = run.commitSha ? run.commitSha.slice(0, 7) : "(none)";
  const dur = formatDuration(durationMs(run));

  const failedCount = run.commands.filter((c) => c.exitCode !== 0 && c.exitCode !== null).length;

  const risksBlock =
    run.risks.length === 0
      ? "- No risks detected."
      : run.risks.map((r) => `- ${cap(r.level)}: ${r.title}`).join("\n");

  const cmdsBlock =
    run.commands.length === 0 ? "- No commands recorded." : run.commands.map(commandLine).join("\n");

  const filesBlock =
    run.changedFiles.length === 0
      ? "- No file changes."
      : run.changedFiles.map((f) => `- ${f.path}`).join("\n");

  return [
    `# AgentLens Run Summary`,
    ``,
    `Branch: ${branch}`,
    `Commit: ${commit}`,
    `Duration: ${dur}`,
    ``,
    `## What Happened`,
    `- Ran ${run.commands.length} commands`,
    `- Changed ${run.changedFiles.length} files`,
    `- ${failedCount} command(s) failed`,
    ``,
    `## Risk Flags`,
    risksBlock,
    ``,
    `## Commands`,
    cmdsBlock,
    ``,
    `## Changed Files`,
    filesBlock,
    ``,
  ].join("\n");
}
