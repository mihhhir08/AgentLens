import { describe, it, expect } from "vitest";
import { detectRisks } from "../core/risks.js";
import type { AgentLensRun, ChangedFile, CommandEvent, GitSnapshot } from "../core/types.js";

function blankSnap(): GitSnapshot {
  return {
    isGitRepo: true,
    statusShort: "",
    diffStat: "",
    diffNameStatus: "",
    fullDiff: "",
    fullDiffTruncated: false,
    fullDiffBytes: 0,
  };
}

function makeRun(over: Partial<AgentLensRun> = {}): AgentLensRun {
  return {
    id: "run_test",
    startTime: "2026-01-01T00:00:00Z",
    endTime: "2026-01-01T00:01:00Z",
    cwd: "/tmp/proj",
    branch: "main",
    commitSha: "abc",
    initialGit: blankSnap(),
    finalGit: blankSnap(),
    commands: [],
    changedFiles: [],
    risks: [],
    schemaVersion: 1,
    ...over,
  };
}

function file(path: string, status: ChangedFile["status"] = "M"): ChangedFile {
  return { path, status };
}

function cmd(over: Partial<CommandEvent>): CommandEvent {
  return {
    command: "echo hi",
    startTime: "2026-01-01T00:00:00Z",
    endTime: "2026-01-01T00:00:01Z",
    durationMs: 1000,
    exitCode: 0,
    stdoutHead: "",
    stdoutTail: "",
    stderrHead: "",
    stderrTail: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    truncated: false,
    ...over,
  };
}

describe("detectRisks", () => {
  it("flags .env files as high", () => {
    const r = detectRisks(makeRun({ changedFiles: [file(".env")] }));
    expect(r.some((x) => x.level === "high")).toBe(true);
  });

  it("flags nested .env.production as high", () => {
    const r = detectRisks(makeRun({ changedFiles: [file("apps/web/.env.production")] }));
    expect(r.some((x) => x.level === "high")).toBe(true);
  });

  it("flags package.json as medium", () => {
    const r = detectRisks(makeRun({ changedFiles: [file("package.json")] }));
    expect(r.some((x) => x.level === "medium" && /package\.json/.test(x.title))).toBe(true);
  });

  it("flags lockfiles as medium", () => {
    for (const lock of ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "go.sum"]) {
      const r = detectRisks(makeRun({ changedFiles: [file(lock)] }));
      expect(r.some((x) => x.level === "medium" && /lock/i.test(x.title))).toBe(true);
    }
  });

  it("flags CI config changes", () => {
    const r = detectRisks(makeRun({ changedFiles: [file(".github/workflows/ci.yml")] }));
    expect(r.some((x) => x.level === "medium" && /CI/i.test(x.title))).toBe(true);
  });

  it("flags migration files", () => {
    const r = detectRisks(makeRun({ changedFiles: [file("db/migrations/0001_init.sql")] }));
    expect(r.some((x) => /migration/i.test(x.title))).toBe(true);
  });

  it("flags deleted files", () => {
    const r = detectRisks(makeRun({ changedFiles: [file("src/old.ts", "D")] }));
    expect(r.some((x) => /delete/i.test(x.title))).toBe(true);
  });

  it("flags large diff by line count", () => {
    const snap: GitSnapshot = { ...blankSnap(), diffStat: ` 5 files changed, 600 insertions(+), 50 deletions(-)\n` };
    const r = detectRisks(makeRun({ finalGit: snap }));
    expect(r.some((x) => /large diff/i.test(x.title))).toBe(true);
  });

  it("flags large diff by file count", () => {
    const many: ChangedFile[] = Array.from({ length: 25 }, (_, i) => file(`src/f${i}.ts`));
    const r = detectRisks(makeRun({ changedFiles: many }));
    expect(r.some((x) => /large diff/i.test(x.title))).toBe(true);
  });

  it("flags single failed command", () => {
    const r = detectRisks(makeRun({ commands: [cmd({ exitCode: 1, command: "npm test" })] }));
    expect(r.some((x) => x.level === "medium" && /failed/i.test(x.title))).toBe(true);
  });

  it("escalates to high when 3+ commands fail", () => {
    const cs = [cmd({ exitCode: 1 }), cmd({ exitCode: 2 }), cmd({ exitCode: 1 })];
    const r = detectRisks(makeRun({ commands: cs }));
    expect(r.some((x) => x.level === "high" && /multiple/i.test(x.title))).toBe(true);
  });

  it("flags .gitignore changes", () => {
    const r = detectRisks(makeRun({ changedFiles: [file(".gitignore")] }));
    expect(r.some((x) => /git config/i.test(x.title))).toBe(true);
  });

  it("returns empty when clean", () => {
    expect(detectRisks(makeRun({ changedFiles: [file("src/util.ts")] }))).toEqual([]);
  });

  it("sorts high before medium before low", () => {
    const r = detectRisks(
      makeRun({
        changedFiles: [file(".env"), file("package.json"), file("src/x.ts")],
      }),
    );
    const levels = r.map((x) => x.level);
    const order = (l: string) => (l === "high" ? 0 : l === "medium" ? 1 : 2);
    expect([...levels].sort((a, b) => order(a) - order(b))).toEqual(levels);
  });
});
