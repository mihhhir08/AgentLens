import { describe, it, expect } from "vitest";
import { renderReport } from "../core/report.js";
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
  id: "run_t",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:00:05Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "deadbeefcafebabe",
  initialGit: blankSnap,
  finalGit: blankSnap,
  commands: [],
  changedFiles: [],
  risks: [],
  schemaVersion: 1,
};

describe("renderReport", () => {
  it("produces a self-contained HTML document", () => {
    const html = renderReport(baseRun);
    expect(html.toLowerCase().startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
  });

  it("renders the AgentLens header and run id", () => {
    const html = renderReport(baseRun);
    expect(html).toContain("AgentLens");
    expect(html).toContain("run_t");
    expect(html).toContain("main");
    expect(html).toContain("deadbee");
  });

  it("renders empty states", () => {
    const html = renderReport(baseRun);
    expect(html).toMatch(/No risks detected/);
    expect(html).toMatch(/No commands recorded/);
    expect(html).toMatch(/No file changes/);
  });

  it("renders Review before commit pills", () => {
    const html = renderReport({
      ...baseRun,
      changedFiles: [
        { path: ".env", status: "M" },
        { path: "src/x.ts", status: "M" },
      ],
      risks: [{ level: "high", title: "Secret-like file touched", detail: "..." }],
      commands: [
        {
          command: "npm test",
          startTime: "",
          endTime: "",
          durationMs: 100,
          exitCode: 1,
          stdoutHead: "",
          stdoutTail: "",
          stderrHead: "",
          stderrTail: "",
          stdoutBytes: 0,
          stderrBytes: 0,
          truncated: false,
        },
      ],
    });
    expect(html).toContain("Review before commit");
    expect(html).toMatch(/Highest risk/);
    expect(html).toMatch(/Changed files/);
    expect(html).toMatch(/Failed commands/);
    expect(html).toMatch(/Dependency.*config.*secret/i);
  });

  it("escapes user-supplied content (XSS smoke test)", () => {
    const html = renderReport({
      ...baseRun,
      commands: [
        {
          command: "<script>alert(1)</script>",
          startTime: "",
          endTime: "",
          durationMs: 1,
          exitCode: 0,
          stdoutHead: "<img src=x onerror=alert(1)>",
          stdoutTail: "",
          stderrHead: "",
          stderrTail: "",
          stdoutBytes: 0,
          stderrBytes: 0,
          truncated: false,
        },
      ],
      changedFiles: [{ path: "<script>x</script>", status: "M" }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders a truncated full diff with head/tail markers", () => {
    const html = renderReport({
      ...baseRun,
      finalGit: {
        isGitRepo: true,
        statusShort: "",
        diffStat: "",
        diffNameStatus: "",
        fullDiff: "",
        fullDiffTruncated: true,
        fullDiffHead: "HEAD_PART",
        fullDiffTail: "TAIL_PART",
        fullDiffBytes: 999_999,
      },
    });
    expect(html).toContain("HEAD_PART");
    expect(html).toContain("TAIL_PART");
    expect(html).toMatch(/truncated/i);
  });
});
