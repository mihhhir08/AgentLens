import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../core/summary.js";
import type { AgentLensRun, GitSnapshot } from "../core/types.js";

const blankSnap: GitSnapshot = {
  isGitRepo: true,
  statusShort: "",
  diffStat: "",
  diffNameStatus: "",
  fullDiff: "",
  fullDiffTruncated: false,
  fullDiffBytes: 0,
};

const baseRun: AgentLensRun = {
  id: "run_1",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:04:12Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "abc1234def5678",
  initialGit: blankSnap,
  finalGit: blankSnap,
  commands: [],
  changedFiles: [],
  risks: [],
  schemaVersion: 1,
};

describe("renderMarkdown", () => {
  it("includes branch, short commit, and human duration", () => {
    const md = renderMarkdown(baseRun);
    expect(md).toMatch(/Branch: main/);
    expect(md).toMatch(/Commit: abc1234/);
    expect(md).toMatch(/Duration: 4m 12s/);
  });

  it("renders empty-state branches", () => {
    const md = renderMarkdown(baseRun);
    expect(md).toMatch(/No risks detected/);
    expect(md).toMatch(/No commands recorded/);
    expect(md).toMatch(/No file changes/);
  });

  it("renders commands and changed files when present", () => {
    const md = renderMarkdown({
      ...baseRun,
      commands: [
        {
          command: "npm test",
          startTime: "x",
          endTime: "y",
          durationMs: 12_000,
          exitCode: 1,
          stdoutHead: "",
          stdoutTail: "",
          stderrHead: "",
          stderrTail: "",
          stdoutBytes: 0,
          stderrBytes: 0,
          truncated: false,
        },
        {
          command: "npm run build",
          startTime: "x",
          endTime: "y",
          durationMs: 31_000,
          exitCode: 0,
          stdoutHead: "",
          stdoutTail: "",
          stderrHead: "",
          stderrTail: "",
          stdoutBytes: 0,
          stderrBytes: 0,
          truncated: false,
        },
      ],
      changedFiles: [
        { path: "src/auth.ts", status: "M" },
        { path: "package.json", status: "M" },
      ],
      risks: [
        { level: "high", title: ".env file touched", detail: "..." },
        { level: "medium", title: "package.json changed", detail: "..." },
      ],
    });
    expect(md).toMatch(/- High: \.env/);
    expect(md).toMatch(/- Medium: package\.json/);
    expect(md).toMatch(/- npm test — failed in 12s/);
    expect(md).toMatch(/- npm run build — passed in 31s/);
    expect(md).toMatch(/- src\/auth\.ts/);
    expect(md).toMatch(/Ran 2 commands/);
    expect(md).toMatch(/Changed 2 files/);
    expect(md).toMatch(/1 command\(s\) failed/);
  });

  it("uses '(none)' when commitSha and branch are empty (non-git)", () => {
    const md = renderMarkdown({ ...baseRun, commitSha: "", branch: "" });
    expect(md).toMatch(/Branch: \(none\)/);
    expect(md).toMatch(/Commit: \(none\)/);
  });
});
