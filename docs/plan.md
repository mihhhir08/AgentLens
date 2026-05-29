# AgentLens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete AgentLens v1 CLI per `docs/spec.md` — record AI-agent coding sessions, render a polished local HTML report and markdown summary.

**Architecture:** Modular TypeScript CLI. Pure transformation modules (`risks`, `summary`, `report`, `time`) take an `AgentLensRun` and emit data/markup. I/O modules (`git`, `storage`, `commands/*`) are thin wrappers. Commander wires CLI verbs to commands. Tests cover the pure layer plus a storage round-trip.

**Tech Stack:** Node.js ≥ 18, TypeScript (strict), commander, vitest. Zero runtime deps beyond commander.

---

## File map

```
agentlens/
  package.json
  tsconfig.json
  vitest.config.ts
  .gitignore
  LICENSE
  README.md
  docs/
    spec.md                  (already written)
    plan.md                  (this file)
  src/
    cli.ts                   commander entrypoint, dispatches verbs
    config.ts                resolves .agentlens/ paths
    git.ts                   git command wrappers + takeSnapshot()
    commands/
      init.ts                creates .agentlens/
      start.ts               writes active.json
      run.ts                 spawn shell:true, stream+capture
      stop.ts                finalize, render report, write run.json
      status.ts              show active or "no session"
      report.ts              regenerate report for most recent run
      list.ts                table of finalized runs
      open.ts                cross-platform opener
    core/
      types.ts               AgentLensRun, CommandEvent, GitSnapshot, RiskFlag, ChangedFile
      time.ts                formatDuration, formatRelative
      risks.ts               detectRisks(run): RiskFlag[]
      summary.ts             renderMarkdown(run): string
      report.ts              renderReport(run): string (HTML)
      storage.ts             serialize/deserialize + readRun/writeRun/active helpers
    tests/
      time.test.ts
      risks.test.ts
      summary.test.ts
      report.test.ts
      storage.test.ts
```

Modules under `core/` are pure transformations; only `core/storage.ts` performs I/O (and exposes pure serialize/deserialize helpers separately).

---

## Task 1: Scaffold the project

**Files:**
- Create: `agentlens/package.json`
- Create: `agentlens/tsconfig.json`
- Create: `agentlens/vitest.config.ts`
- Create: `agentlens/.gitignore`
- Create: `agentlens/LICENSE`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agentlens",
  "version": "0.1.0",
  "description": "Open-source observability for AI coding agents.",
  "license": "MIT",
  "type": "module",
  "bin": {
    "agentlens": "dist/cli.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "start": "node dist/cli.js"
  },
  "dependencies": {
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["src/tests/**", "dist", "node_modules"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    environment: "node",
    reporters: "default",
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.agentlens/
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 5: Create `LICENSE` (MIT)**

Standard MIT license, copyright "AgentLens contributors" with the current year.

- [ ] **Step 6: Install dependencies**

```bash
cd agentlens && npm install
```

Expected: installs commander, typescript, vitest, @types/node. No errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore LICENSE package-lock.json
git commit -m "chore: scaffold TypeScript CLI with commander and vitest"
```

---

## Task 2: Implement `core/types.ts`

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write the type definitions exactly as in spec §3**

```ts
export interface GitSnapshot {
  isGitRepo: boolean;
  statusShort: string;
  diffStat: string;
  diffNameStatus: string;
  fullDiff: string;
  fullDiffTruncated: boolean;
  fullDiffHead?: string;
  fullDiffTail?: string;
  fullDiffBytes: number;
}

export interface CommandEvent {
  command: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  exitCode: number | null;
  signal?: string;
  stdoutHead: string;
  stdoutTail: string;
  stderrHead: string;
  stderrTail: string;
  stdoutBytes: number;
  stderrBytes: number;
  truncated: boolean;
}

export type RiskLevel = "low" | "medium" | "high";

export interface RiskFlag {
  level: RiskLevel;
  title: string;
  detail: string;
  file?: string;
}

export type ChangedFileStatus = "A" | "M" | "D" | "R" | "C" | "U" | "?";

export interface ChangedFile {
  path: string;
  status: ChangedFileStatus;
}

export interface AgentLensRun {
  id: string;
  startTime: string;
  endTime?: string;
  cwd: string;
  branch: string;
  commitSha: string;
  initialGit: GitSnapshot;
  finalGit?: GitSnapshot;
  commands: CommandEvent[];
  changedFiles: ChangedFile[];
  risks: RiskFlag[];
  markdownSummary?: string;
  reportPath?: string;
  schemaVersion: 1;
}

export const STDIO_HEAD_TAIL_BYTES = 4096;
export const DIFF_HEAD_TAIL_BYTES = 128 * 1024;
export const DIFF_TRUNCATE_THRESHOLD_BYTES = 256 * 1024;
```

- [ ] **Step 2: Build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add AgentLensRun data model types"
```

---

## Task 3: Implement `core/time.ts` (TDD)

**Files:**
- Create: `src/tests/time.test.ts`
- Create: `src/core/time.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { formatDuration, formatRelative } from "../core/time.js";

describe("formatDuration", () => {
  it("formats sub-second", () => {
    expect(formatDuration(450)).toBe("450ms");
  });
  it("formats seconds", () => {
    expect(formatDuration(2500)).toBe("2.5s");
  });
  it("formats minutes and seconds", () => {
    expect(formatDuration(75_000)).toBe("1m 15s");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(3_725_000)).toBe("1h 2m");
  });
  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0ms");
  });
});

describe("formatRelative", () => {
  it("returns 'just now' for very recent", () => {
    const now = new Date();
    expect(formatRelative(now.toISOString(), now)).toBe("just now");
  });
  it("formats minutes ago", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const past = new Date("2026-01-01T11:55:00Z").toISOString();
    expect(formatRelative(past, now)).toBe("5 minutes ago");
  });
  it("formats single minute ago", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const past = new Date("2026-01-01T11:59:00Z").toISOString();
    expect(formatRelative(past, now)).toBe("1 minute ago");
  });
});
```

- [ ] **Step 2: Run tests, expect failures**

```bash
npx vitest run src/tests/time.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `core/time.ts`**

```ts
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) {
    const s = ms / 1000;
    return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const min = Math.round(diffSec / 60);
  if (min === 1) return "1 minute ago";
  if (min < 60) return `${min} minutes ago`;
  const hours = Math.round(min / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/tests/time.test.ts
```

Expected: PASS — all 8 cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/time.ts src/tests/time.test.ts
git commit -m "feat(core): add time formatting helpers"
```

---

## Task 4: Implement `core/risks.ts` (TDD)

**Files:**
- Create: `src/tests/risks.test.ts`
- Create: `src/core/risks.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { detectRisks } from "../core/risks.js";
import type { AgentLensRun, ChangedFile, CommandEvent } from "../core/types.js";

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
function blankSnap() {
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
    expect(r.some((x) => x.level === "high" && /env/i.test(x.title))).toBe(true);
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
    const snap = { ...blankSnap(), diffStat: ` 5 files changed, 600 insertions(+), 50 deletions(-)\n` };
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
    expect(r.some((x) => /git config/i.test(x.title) || /gitignore/i.test(x.title))).toBe(true);
  });

  it("returns empty when clean", () => {
    expect(detectRisks(makeRun({ changedFiles: [file("src/util.ts")] }))).toEqual([]);
  });

  it("sorts high before medium before low", () => {
    const r = detectRisks(makeRun({
      changedFiles: [file(".env"), file("package.json"), file("src/x.ts")],
    }));
    const levels = r.map((x) => x.level);
    const order = (l: string) => (l === "high" ? 0 : l === "medium" ? 1 : 2);
    expect([...levels].sort((a, b) => order(a) - order(b))).toEqual(levels);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npx vitest run src/tests/risks.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `core/risks.ts`**

```ts
import type { AgentLensRun, ChangedFile, CommandEvent, RiskFlag, RiskLevel } from "./types.js";

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "go.sum",
]);

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

function isEnvLike(path: string): boolean {
  const base = basename(path);
  if (/^\.env(\..*)?$/.test(base)) return true;
  if (/credentials/i.test(base)) return true;
  if (/secret/i.test(base)) return true;
  if (/\.pem$/i.test(base)) return true;
  return false;
}

function isCIConfig(path: string): boolean {
  if (path.startsWith(".github/workflows/")) return true;
  if (path === ".gitlab-ci.yml") return true;
  if (path.startsWith(".circleci/")) return true;
  if (path === ".travis.yml") return true;
  if (path === "azure-pipelines.yml") return true;
  return false;
}

function isGitConfig(path: string): boolean {
  const base = basename(path);
  return base === ".gitignore" || base === ".gitattributes" || base === ".gitmodules";
}

function isMigration(path: string): boolean {
  if (path.includes("/migrations/") || path.includes("/migrate/")) return true;
  if (/_migration\.[a-z]+$/i.test(path)) return true;
  return false;
}

function parseDiffStatTotals(diffStat: string): { files: number; lines: number } {
  // Last line typically: " 5 files changed, 600 insertions(+), 50 deletions(-)"
  const last = diffStat.trim().split("\n").pop() ?? "";
  const filesMatch = last.match(/(\d+)\s+files?\s+changed/);
  const insMatch = last.match(/(\d+)\s+insertions?\(\+\)/);
  const delMatch = last.match(/(\d+)\s+deletions?\(-\)/);
  const files = filesMatch ? parseInt(filesMatch[1]!, 10) : 0;
  const ins = insMatch ? parseInt(insMatch[1]!, 10) : 0;
  const del = delMatch ? parseInt(delMatch[1]!, 10) : 0;
  return { files, lines: ins + del };
}

function levelRank(l: RiskLevel): number {
  return l === "high" ? 0 : l === "medium" ? 1 : 2;
}

export function detectRisks(run: AgentLensRun): RiskFlag[] {
  const out: RiskFlag[] = [];
  const seen = new Set<string>();
  const push = (f: RiskFlag) => {
    const key = `${f.level}|${f.title}|${f.file ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };

  for (const cf of run.changedFiles) {
    if (isEnvLike(cf.path)) {
      push({
        level: "high",
        title: "Secret-like file touched",
        detail: "An .env, credentials, or key file was modified. Double-check before committing.",
        file: cf.path,
      });
    }
    if (basename(cf.path) === "package.json") {
      push({
        level: "medium",
        title: "package.json changed",
        detail: "Dependency or script changes can affect builds.",
        file: cf.path,
      });
    }
    if (LOCKFILES.has(basename(cf.path))) {
      push({
        level: "medium",
        title: "Lockfile changed",
        detail: "Dependency versions shifted.",
        file: cf.path,
      });
    }
    if (isCIConfig(cf.path)) {
      push({
        level: "medium",
        title: "CI config changed",
        detail: "Workflow definitions can affect releases.",
        file: cf.path,
      });
    }
    if (isGitConfig(cf.path)) {
      push({
        level: "medium",
        title: "Git config file changed",
        detail: "Changes to .gitignore/.gitattributes can affect what gets tracked.",
        file: cf.path,
      });
    }
    if (isMigration(cf.path)) {
      push({
        level: "medium",
        title: "Migration file changed",
        detail: "Schema migrations affect production data — review carefully.",
        file: cf.path,
      });
    }
    if (cf.status === "D") {
      push({
        level: "medium",
        title: "File deleted",
        detail: "Verify the deletion is intended.",
        file: cf.path,
      });
    }
  }

  const stat = parseDiffStatTotals(run.finalGit?.diffStat ?? "");
  if (stat.lines > 500 || stat.files > 20 || run.changedFiles.length > 20) {
    push({
      level: "medium",
      title: "Large diff",
      detail: `${stat.files || run.changedFiles.length} file(s), ${stat.lines} line(s) changed.`,
    });
  }

  const failed: CommandEvent[] = run.commands.filter((c) => c.exitCode !== 0 && c.exitCode !== null);
  for (const f of failed) {
    push({
      level: "medium",
      title: "Command failed",
      detail: `\`${f.command}\` exited ${f.exitCode}.`,
    });
  }
  if (failed.length >= 3) {
    push({
      level: "high",
      title: "Multiple commands failed",
      detail: `${failed.length} commands failed during this session.`,
    });
  }

  out.sort((a, b) => levelRank(a.level) - levelRank(b.level));
  return out;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/tests/risks.test.ts
```

Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/risks.ts src/tests/risks.test.ts
git commit -m "feat(core): add risk detection rules"
```

---

## Task 5: Implement `core/summary.ts` (TDD)

**Files:**
- Create: `src/tests/summary.test.ts`
- Create: `src/core/summary.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../core/summary.js";
import type { AgentLensRun } from "../core/types.js";

const baseRun: AgentLensRun = {
  id: "run_1",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:04:12Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "abc1234def5678",
  initialGit: { isGitRepo: true, statusShort: "", diffStat: "", diffNameStatus: "", fullDiff: "", fullDiffTruncated: false, fullDiffBytes: 0 },
  finalGit: { isGitRepo: true, statusShort: "", diffStat: "", diffNameStatus: "", fullDiff: "", fullDiffTruncated: false, fullDiffBytes: 0 },
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
        { command: "npm test", startTime: "x", endTime: "y", durationMs: 12_000, exitCode: 1, stdoutHead: "", stdoutTail: "", stderrHead: "", stderrTail: "", stdoutBytes: 0, stderrBytes: 0, truncated: false },
        { command: "npm run build", startTime: "x", endTime: "y", durationMs: 31_000, exitCode: 0, stdoutHead: "", stdoutTail: "", stderrHead: "", stderrTail: "", stdoutBytes: 0, stderrBytes: 0, truncated: false },
      ],
      changedFiles: [{ path: "src/auth.ts", status: "M" }, { path: "package.json", status: "M" }],
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

  it("uses 'no commit' when commitSha is empty (non-git)", () => {
    const md = renderMarkdown({ ...baseRun, commitSha: "", branch: "" });
    expect(md).toMatch(/Branch: \(none\)/);
    expect(md).toMatch(/Commit: \(none\)/);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npx vitest run src/tests/summary.test.ts
```

- [ ] **Step 3: Implement `core/summary.ts`**

```ts
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

export function renderMarkdown(run: AgentLensRun): string {
  const branch = run.branch || "(none)";
  const commit = run.commitSha ? run.commitSha.slice(0, 7) : "(none)";
  const dur = formatDuration(durationMs(run));

  const failedCount = run.commands.filter((c) => c.exitCode !== 0 && c.exitCode !== null).length;

  const risksBlock = run.risks.length === 0
    ? "- No risks detected."
    : run.risks.map((r) => `- ${cap(r.level)}: ${r.title}`).join("\n");

  const cmdsBlock = run.commands.length === 0
    ? "- No commands recorded."
    : run.commands.map(commandLine).join("\n");

  const filesBlock = run.changedFiles.length === 0
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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/tests/summary.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/core/summary.ts src/tests/summary.test.ts
git commit -m "feat(core): add markdown summary renderer"
```

---

## Task 6: Implement `core/report.ts` (TDD)

**Files:**
- Create: `src/tests/report.test.ts`
- Create: `src/core/report.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { renderReport } from "../core/report.js";
import type { AgentLensRun } from "../core/types.js";

const baseRun: AgentLensRun = {
  id: "run_t",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:00:05Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "deadbeefcafebabe",
  initialGit: { isGitRepo: true, statusShort: "", diffStat: "", diffNameStatus: "", fullDiff: "", fullDiffTruncated: false, fullDiffBytes: 0 },
  finalGit: { isGitRepo: true, statusShort: "", diffStat: "", diffNameStatus: "", fullDiff: "", fullDiffTruncated: false, fullDiffBytes: 0 },
  commands: [],
  changedFiles: [],
  risks: [],
  schemaVersion: 1,
};

describe("renderReport", () => {
  it("produces a self-contained HTML document", () => {
    const html = renderReport(baseRun);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("</html>");
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
  });

  it("renders the AgentLens header and run id", () => {
    const html = renderReport(baseRun);
    expect(html).toContain("AgentLens");
    expect(html).toContain("run_t");
    expect(html).toContain("main");
    expect(html).toContain("deadbee"); // short sha
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
      changedFiles: [{ path: ".env", status: "M" }, { path: "src/x.ts", status: "M" }],
      risks: [{ level: "high", title: "Secret-like file touched", detail: "..." }],
      commands: [
        { command: "npm test", startTime: "", endTime: "", durationMs: 100, exitCode: 1, stdoutHead: "", stdoutTail: "", stderrHead: "", stderrTail: "", stdoutBytes: 0, stderrBytes: 0, truncated: false },
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
        { command: "<script>alert(1)</script>", startTime: "", endTime: "", durationMs: 1, exitCode: 0, stdoutHead: "<img src=x onerror=alert(1)>", stdoutTail: "", stderrHead: "", stderrTail: "", stdoutBytes: 0, stderrBytes: 0, truncated: false },
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
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npx vitest run src/tests/report.test.ts
```

- [ ] **Step 3: Implement `core/report.ts`**

The implementation builds a single self-contained HTML document. Structure:

1. `<!doctype html>` + `<html lang="en">` + `<head>` with inline `<style>`.
2. `<body>` with: header, "Review before commit" pill row, summary, risks, commands timeline, changed files, diff stat, full-diff collapsible, markdown-copy block.
3. Inline `<script>` only for the Copy button (`navigator.clipboard.writeText`).

```ts
import type { AgentLensRun, ChangedFile, CommandEvent, RiskFlag, RiskLevel } from "./types.js";
import { formatDuration } from "./time.js";
import { renderMarkdown } from "./summary.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highestRisk(risks: RiskFlag[]): RiskLevel | "none" {
  if (risks.some((r) => r.level === "high")) return "high";
  if (risks.some((r) => r.level === "medium")) return "medium";
  if (risks.some((r) => r.level === "low")) return "low";
  return "none";
}

function touchedSensitive(files: ChangedFile[]): boolean {
  return files.some((f) => {
    const base = f.path.split("/").pop() ?? "";
    if (/^\.env(\..*)?$/.test(base)) return true;
    if (base === "package.json") return true;
    if (/(lock|sum)$/i.test(base)) return true;
    if (base === ".gitignore" || base === ".gitattributes") return true;
    return false;
  });
}

function riskPillLabel(level: RiskLevel | "none"): string {
  switch (level) {
    case "high": return "High";
    case "medium": return "Medium";
    case "low": return "Low";
    default: return "Clean";
  }
}

function renderCommand(c: CommandEvent): string {
  const verdictLabel = c.exitCode === 0 ? "pass" : c.exitCode === null ? "interrupted" : "fail";
  const verdictClass = c.exitCode === 0 ? "ok" : "bad";
  const trunc = c.truncated ? `<span class="dim"> (truncated)</span>` : "";
  const stderr = c.stderrHead || c.stderrTail
    ? `<div class="streamlabel">stderr</div><pre class="stream">${esc(c.stderrHead)}${c.stderrTail ? `\n[…tail…]\n${esc(c.stderrTail)}` : ""}</pre>`
    : "";
  const stdout = c.stdoutHead || c.stdoutTail
    ? `<div class="streamlabel">stdout</div><pre class="stream">${esc(c.stdoutHead)}${c.stdoutTail ? `\n[…tail…]\n${esc(c.stdoutTail)}` : ""}</pre>`
    : `<p class="dim">No output captured.</p>`;
  return `<details class="cmd">
    <summary>
      <code>${esc(c.command)}</code>
      <span class="badge ${verdictClass}">${verdictLabel}</span>
      <span class="dim">${formatDuration(c.durationMs)}</span>
      ${trunc}
    </summary>
    ${stdout}
    ${stderr}
  </details>`;
}

function renderRisks(risks: RiskFlag[]): string {
  if (risks.length === 0) {
    return `<p class="empty">No risks detected. Looks clean.</p>`;
  }
  return risks.map((r) => `<div class="risk risk-${r.level}">
    <span class="badge ${r.level}">${r.level}</span>
    <strong>${esc(r.title)}</strong>
    ${r.file ? `<code class="file">${esc(r.file)}</code>` : ""}
    <p>${esc(r.detail)}</p>
  </div>`).join("");
}

function renderFiles(files: ChangedFile[]): string {
  if (files.length === 0) return `<p class="empty">No file changes detected.</p>`;
  const groups: Record<string, ChangedFile[]> = { A: [], M: [], D: [], R: [], C: [], U: [], "?": [] };
  for (const f of files) groups[f.status]!.push(f);
  const names: Record<string, string> = { A: "Added", M: "Modified", D: "Deleted", R: "Renamed", C: "Copied", U: "Unmerged", "?": "Untracked" };
  const order: (keyof typeof names)[] = ["A", "M", "D", "R", "C", "U", "?"];
  return order
    .filter((k) => (groups[k]?.length ?? 0) > 0)
    .map((k) => `<div class="filegroup"><h4>${names[k]}</h4><ul>${
      groups[k]!.map((f) => `<li><code>${esc(f.path)}</code></li>`).join("")
    }</ul></div>`).join("");
}

function renderFullDiff(run: AgentLensRun): string {
  const fg = run.finalGit;
  if (!fg) return "";
  if (fg.fullDiffTruncated) {
    const head = esc(fg.fullDiffHead ?? "");
    const tail = esc(fg.fullDiffTail ?? "");
    return `<details><summary>Full diff <span class="dim">(truncated, ${fg.fullDiffBytes.toLocaleString()} bytes total)</span></summary>
      <pre class="diff">${head}\n\n[…truncated…]\n\n${tail}</pre>
    </details>`;
  }
  if (!fg.fullDiff) return "";
  return `<details><summary>Full diff <span class="dim">(${fg.fullDiffBytes.toLocaleString()} bytes)</span></summary>
    <pre class="diff">${esc(fg.fullDiff)}</pre>
  </details>`;
}

export function renderReport(run: AgentLensRun): string {
  const durMs = run.endTime ? new Date(run.endTime).getTime() - new Date(run.startTime).getTime() : 0;
  const failedCount = run.commands.filter((c) => c.exitCode !== 0 && c.exitCode !== null).length;
  const highest = highestRisk(run.risks);
  const sensitive = touchedSensitive(run.changedFiles);
  const md = renderMarkdown(run);

  const styles = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fafaf9; color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      line-height: 1.5; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 24px 96px; }
    header.runhdr { border-bottom: 1px solid #e7e5e4; padding-bottom: 16px; margin-bottom: 24px; }
    header.runhdr h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.01em; }
    header.runhdr .meta { color: #57534e; font-size: 14px; display: flex; flex-wrap: wrap; gap: 12px; }
    header.runhdr .meta code { background: #f5f5f4; padding: 1px 6px; border-radius: 4px; }
    section { margin-bottom: 28px; }
    section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #57534e; margin: 0 0 12px; }
    .pills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .pill { background: #fff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 16px; }
    .pill .label { font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.04em; }
    .pill .value { font-size: 22px; font-weight: 600; margin-top: 4px; }
    .pill.high .value { color: #dc2626; }
    .pill.medium .value { color: #d97706; }
    .pill.low .value { color: #65a30d; }
    .pill.none .value { color: #16a34a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge.high { background: #fee2e2; color: #b91c1c; }
    .badge.medium { background: #fef3c7; color: #b45309; }
    .badge.low { background: #ecfccb; color: #4d7c0f; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.bad { background: #fee2e2; color: #b91c1c; }
    .risk { background: #fff; border: 1px solid #e7e5e4; border-left: 4px solid #d6d3d1; padding: 12px 14px; border-radius: 8px; margin-bottom: 10px; }
    .risk.risk-high { border-left-color: #dc2626; }
    .risk.risk-medium { border-left-color: #d97706; }
    .risk.risk-low { border-left-color: #65a30d; }
    .risk p { margin: 6px 0 0; color: #44403c; font-size: 14px; }
    .risk code.file { margin-left: 8px; background: #f5f5f4; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
    .cmd { background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 8px 14px; margin-bottom: 8px; }
    .cmd summary { cursor: pointer; display: flex; gap: 10px; align-items: center; }
    .cmd code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .stream { background: #fafaf9; border: 1px solid #e7e5e4; padding: 10px; border-radius: 6px; max-height: 360px; overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
    .streamlabel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #78716c; margin: 10px 0 4px; }
    .filegroup h4 { margin: 8px 0 4px; font-size: 13px; color: #44403c; }
    .filegroup ul { margin: 0 0 8px; padding-left: 18px; }
    .filegroup code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
    .empty { color: #78716c; font-style: italic; }
    .dim { color: #78716c; font-size: 12.5px; }
    pre.diff, pre.stat { background: #1c1917; color: #e7e5e4; padding: 14px; border-radius: 8px; overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
    details summary { font-weight: 600; }
    .copyrow { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    button.copy { background: #1d4ed8; color: #fff; border: 0; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
    button.copy:hover { background: #1e40af; }
    pre.markdown { background: #fff; border: 1px solid #e7e5e4; padding: 14px; border-radius: 8px; overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; white-space: pre-wrap; }
    @media (max-width: 720px) {
      .pills { grid-template-columns: 1fr 1fr; }
    }
  `;

  const shortSha = run.commitSha ? esc(run.commitSha.slice(0, 7)) : "(none)";
  const branchLabel = esc(run.branch || "(none)");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AgentLens — ${esc(run.id)}</title>
<style>${styles}</style>
</head>
<body>
<main>
  <header class="runhdr">
    <h1>AgentLens · <span class="dim">${esc(run.id)}</span></h1>
    <div class="meta">
      <span>Branch <code>${branchLabel}</code></span>
      <span>Commit <code>${shortSha}</code></span>
      <span>Started <time>${esc(run.startTime)}</time></span>
      <span>Duration <strong>${formatDuration(durMs)}</strong></span>
    </div>
  </header>

  <section>
    <h2>Review before commit</h2>
    <div class="pills">
      <div class="pill ${highest}">
        <div class="label">Highest risk</div>
        <div class="value">${riskPillLabel(highest)}</div>
      </div>
      <div class="pill">
        <div class="label">Changed files</div>
        <div class="value">${run.changedFiles.length}</div>
      </div>
      <div class="pill ${failedCount > 0 ? "high" : "none"}">
        <div class="label">Failed commands</div>
        <div class="value">${failedCount}</div>
      </div>
      <div class="pill ${sensitive ? "medium" : "none"}">
        <div class="label">Dependency / config / secret-like files</div>
        <div class="value">${sensitive ? "Yes" : "No"}</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Summary</h2>
    <p>Ran <strong>${run.commands.length}</strong> command(s), changed <strong>${run.changedFiles.length}</strong> file(s), <strong>${failedCount}</strong> failed. Total duration <strong>${formatDuration(durMs)}</strong>.</p>
  </section>

  <section>
    <h2>Risk flags</h2>
    ${renderRisks(run.risks)}
  </section>

  <section>
    <h2>Timeline</h2>
    ${run.commands.length === 0 ? `<p class="empty">No commands recorded.</p>` : run.commands.map(renderCommand).join("")}
  </section>

  <section>
    <h2>Changed files</h2>
    ${renderFiles(run.changedFiles)}
  </section>

  <section>
    <h2>Diff stat</h2>
    ${run.finalGit?.diffStat ? `<pre class="stat">${esc(run.finalGit.diffStat)}</pre>` : `<p class="empty">No diff stat available.</p>`}
  </section>

  <section>
    <h2>Full diff</h2>
    ${renderFullDiff(run) || `<p class="empty">No diff to show.</p>`}
  </section>

  <section>
    <h2>Markdown summary</h2>
    <div class="copyrow">
      <span class="dim">Copy and paste into a PR description.</span>
      <button class="copy" id="copyBtn">Copy</button>
    </div>
    <pre class="markdown" id="md">${esc(md)}</pre>
  </section>
</main>
<script>
  (function () {
    var btn = document.getElementById('copyBtn');
    var md = document.getElementById('md');
    if (btn && md) {
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(md.textContent || '').then(function () {
          var prev = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = prev; }, 1200);
        });
      });
    }
  })();
</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/tests/report.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/core/report.ts src/tests/report.test.ts
git commit -m "feat(core): add standalone HTML report renderer"
```

---

## Task 7: Implement `core/storage.ts` (TDD)

**Files:**
- Create: `src/tests/storage.test.ts`
- Create: `src/core/storage.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serializeRun, deserializeRun, writeRun, readRun, writeActive, readActive, clearActive } from "../core/storage.js";
import type { AgentLensRun } from "../core/types.js";

const sampleRun: AgentLensRun = {
  id: "run_x",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:00:01Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "abc",
  initialGit: { isGitRepo: true, statusShort: "", diffStat: "", diffNameStatus: "", fullDiff: "", fullDiffTruncated: false, fullDiffBytes: 0 },
  finalGit: { isGitRepo: true, statusShort: "", diffStat: "", diffNameStatus: "", fullDiff: "", fullDiffTruncated: false, fullDiffBytes: 0 },
  commands: [],
  changedFiles: [],
  risks: [],
  schemaVersion: 1,
};

describe("serialize/deserialize", () => {
  it("round-trips a run via JSON", () => {
    const json = serializeRun(sampleRun);
    const back = deserializeRun(json);
    expect(back).toEqual(sampleRun);
  });

  it("throws on bad JSON", () => {
    expect(() => deserializeRun("not json")).toThrow();
  });

  it("throws when schemaVersion is missing or wrong", () => {
    const bad = JSON.stringify({ ...sampleRun, schemaVersion: 99 });
    expect(() => deserializeRun(bad)).toThrow(/schema/i);
  });
});

describe("storage I/O", () => {
  it("writes and reads a run from .agentlens", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentlens-"));
    try {
      writeRun(dir, sampleRun);
      const back = readRun(dir, sampleRun.id);
      expect(back).toEqual(sampleRun);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes/reads/clears active session", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentlens-"));
    try {
      expect(readActive(dir)).toBeNull();
      writeActive(dir, sampleRun);
      expect(readActive(dir)?.id).toBe(sampleRun.id);
      clearActive(dir);
      expect(readActive(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npx vitest run src/tests/storage.test.ts
```

- [ ] **Step 3: Implement `core/storage.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AgentLensRun } from "./types.js";

export function serializeRun(run: AgentLensRun): string {
  return JSON.stringify(run, null, 2);
}

export function deserializeRun(json: string): AgentLensRun {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || (parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new Error("Unsupported AgentLens schema version (expected 1).");
  }
  return parsed as AgentLensRun;
}

function ensureDir(d: string) {
  mkdirSync(d, { recursive: true });
}

function atomicWrite(path: string, contents: string) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}

export function agentlensRoot(cwd: string): string {
  return join(cwd, ".agentlens");
}

export function runDir(cwd: string, id: string): string {
  return join(agentlensRoot(cwd), "runs", id);
}

export function writeRun(cwd: string, run: AgentLensRun): void {
  const dir = runDir(cwd, run.id);
  ensureDir(dir);
  atomicWrite(join(dir, "run.json"), serializeRun(run));
}

export function readRun(cwd: string, id: string): AgentLensRun {
  const file = join(runDir(cwd, id), "run.json");
  return deserializeRun(readFileSync(file, "utf8"));
}

export function writeActive(cwd: string, run: AgentLensRun): void {
  ensureDir(agentlensRoot(cwd));
  atomicWrite(join(agentlensRoot(cwd), "active.json"), serializeRun(run));
}

export function readActive(cwd: string): AgentLensRun | null {
  const file = join(agentlensRoot(cwd), "active.json");
  if (!existsSync(file)) return null;
  return deserializeRun(readFileSync(file, "utf8"));
}

export function clearActive(cwd: string): void {
  const file = join(agentlensRoot(cwd), "active.json");
  if (existsSync(file)) rmSync(file);
}

export function listFinalizedRunIds(cwd: string): string[] {
  const runs = join(agentlensRoot(cwd), "runs");
  if (!existsSync(runs)) return [];
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  return readdirSync(runs)
    .filter((name) => {
      try {
        return statSync(join(runs, name)).isDirectory() && existsSync(join(runs, name, "run.json"));
      } catch { return false; }
    });
}
```

Note: the `require()` inside `listFinalizedRunIds` is fine under TypeScript's CommonJS interop in Node, but since we set `"module": "ES2022"`, replace it with proper imports at the top:

```ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
```

And drop the `require` call. Use the imported `readdirSync` / `statSync` instead.

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/tests/storage.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.ts src/tests/storage.test.ts
git commit -m "feat(core): add atomic JSON storage for runs and active session"
```

---

## Task 8: Implement `src/git.ts`

**Files:**
- Create: `src/git.ts`

- [ ] **Step 1: Implement the git helpers**

```ts
import { execFileSync } from "node:child_process";
import type { GitSnapshot } from "./core/types.js";
import { DIFF_HEAD_TAIL_BYTES, DIFF_TRUNCATE_THRESHOLD_BYTES } from "./core/types.js";

function tryGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).toString();
  } catch {
    return "";
  }
}

export function isGitRepo(cwd: string): boolean {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return out === "true";
  } catch {
    return false;
  }
}

export function getBranch(cwd: string): string {
  return tryGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
}
export function getCommitSha(cwd: string): string {
  return tryGit(cwd, ["rev-parse", "HEAD"]).trim();
}
export function getStatusShort(cwd: string): string {
  return tryGit(cwd, ["status", "--short"]);
}
export function getDiffStat(cwd: string): string {
  return tryGit(cwd, ["diff", "--stat"]);
}
export function getDiffNameStatus(cwd: string): string {
  return tryGit(cwd, ["diff", "--name-status"]);
}
export function getFullDiff(cwd: string): string {
  return tryGit(cwd, ["diff"]);
}

export function takeSnapshot(cwd: string): GitSnapshot {
  if (!isGitRepo(cwd)) {
    return {
      isGitRepo: false,
      statusShort: "",
      diffStat: "",
      diffNameStatus: "",
      fullDiff: "",
      fullDiffTruncated: false,
      fullDiffBytes: 0,
    };
  }
  const fullDiff = getFullDiff(cwd);
  const bytes = Buffer.byteLength(fullDiff, "utf8");
  if (bytes > DIFF_TRUNCATE_THRESHOLD_BYTES) {
    return {
      isGitRepo: true,
      statusShort: getStatusShort(cwd),
      diffStat: getDiffStat(cwd),
      diffNameStatus: getDiffNameStatus(cwd),
      fullDiff: "",
      fullDiffTruncated: true,
      fullDiffHead: Buffer.from(fullDiff, "utf8").subarray(0, DIFF_HEAD_TAIL_BYTES).toString("utf8"),
      fullDiffTail: Buffer.from(fullDiff, "utf8").subarray(bytes - DIFF_HEAD_TAIL_BYTES).toString("utf8"),
      fullDiffBytes: bytes,
    };
  }
  return {
    isGitRepo: true,
    statusShort: getStatusShort(cwd),
    diffStat: getDiffStat(cwd),
    diffNameStatus: getDiffNameStatus(cwd),
    fullDiff,
    fullDiffTruncated: false,
    fullDiffBytes: bytes,
  };
}

export function parseChangedFilesFromStatus(statusShort: string): Array<{ path: string; status: "A" | "M" | "D" | "R" | "C" | "U" | "?" }> {
  const out: Array<{ path: string; status: "A" | "M" | "D" | "R" | "C" | "U" | "?" }> = [];
  for (const raw of statusShort.split("\n")) {
    if (!raw.trim()) continue;
    // `XY path` (XY are status codes per `git status --short`)
    const xy = raw.slice(0, 2);
    let path = raw.slice(3).trim();
    if (path.includes(" -> ")) path = path.split(" -> ").pop()!.trim();
    let code: "A" | "M" | "D" | "R" | "C" | "U" | "?" = "M";
    const s = xy.replace(" ", "");
    if (s.includes("?")) code = "?";
    else if (s.includes("A")) code = "A";
    else if (s.includes("D")) code = "D";
    else if (s.includes("R")) code = "R";
    else if (s.includes("C")) code = "C";
    else if (s.includes("U")) code = "U";
    else if (s.includes("M")) code = "M";
    out.push({ path, status: code });
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/git.ts
git commit -m "feat(git): add snapshot helpers and changed-file parser"
```

---

## Task 9: Implement `src/config.ts`

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Implement**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): add path resolver and run id generator"
```

---

## Task 10: Implement `commands/init.ts`

**Files:**
- Create: `src/commands/init.ts`

- [ ] **Step 1: Implement**

```ts
import { mkdirSync, existsSync } from "node:fs";
import { resolvePaths } from "../config.js";

export function init(cwd: string): void {
  const p = resolvePaths(cwd);
  const existed = existsSync(p.root);
  mkdirSync(p.runsDir, { recursive: true });
  if (existed) {
    console.log(`AgentLens already initialized at ${p.root}`);
  } else {
    console.log(`AgentLens initialized at ${p.root}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat(cmd): implement init"
```

---

## Task 11: Implement `commands/start.ts`

**Files:**
- Create: `src/commands/start.ts`

- [ ] **Step 1: Implement**

```ts
import { existsSync, mkdirSync } from "node:fs";
import { resolvePaths, generateRunId } from "../config.js";
import { takeSnapshot } from "../git.js";
import { writeActive } from "../core/storage.js";
import { getBranch, getCommitSha } from "../git.js";
import type { AgentLensRun } from "../core/types.js";

export function start(cwd: string): void {
  const p = resolvePaths(cwd);
  if (existsSync(p.activePath)) {
    console.error(`An AgentLens session is already active.`);
    console.error(`Run \`agentlens stop\` to finalize it, or remove ${p.activePath} to discard it.`);
    process.exit(1);
  }
  mkdirSync(p.runsDir, { recursive: true });

  const id = generateRunId();
  const run: AgentLensRun = {
    id,
    startTime: new Date().toISOString(),
    cwd,
    branch: getBranch(cwd),
    commitSha: getCommitSha(cwd),
    initialGit: takeSnapshot(cwd),
    commands: [],
    changedFiles: [],
    risks: [],
    schemaVersion: 1,
  };
  writeActive(cwd, run);
  console.log(`▸ AgentLens session started.`);
  console.log(`  Run id: ${id}`);
  console.log(`  Branch: ${run.branch || "(none)"}`);
  console.log(`  Run \`agentlens run -- <command>\` to record commands.`);
  console.log(`  Run \`agentlens stop\` when finished.`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/start.ts
git commit -m "feat(cmd): implement start with active-session guard"
```

---

## Task 12: Implement `commands/run.ts`

**Files:**
- Create: `src/commands/run.ts`

- [ ] **Step 1: Implement**

```ts
import { spawn } from "node:child_process";
import { readActive, writeActive } from "../core/storage.js";
import type { CommandEvent } from "../core/types.js";
import { STDIO_HEAD_TAIL_BYTES } from "../core/types.js";

function captureHeadTail(buf: Buffer, cap: number): { head: string; tail: string; bytes: number; truncated: boolean } {
  const bytes = buf.length;
  if (bytes <= cap) {
    return { head: buf.toString("utf8"), tail: "", bytes, truncated: false };
  }
  return {
    head: buf.subarray(0, cap).toString("utf8"),
    tail: buf.subarray(bytes - cap).toString("utf8"),
    bytes,
    truncated: true,
  };
}

export async function run(cwd: string, commandArgs: string[]): Promise<void> {
  const active = readActive(cwd);
  if (!active) {
    console.error("No active AgentLens session. Run `agentlens start` first.");
    process.exit(1);
  }
  if (commandArgs.length === 0) {
    console.error("Usage: agentlens run -- <command>");
    process.exit(1);
  }
  const cmdString = commandArgs.join(" ");
  const startIso = new Date().toISOString();
  const startMs = Date.now();

  const child = spawn(cmdString, { cwd, shell: true });

  const outChunks: Buffer[] = [];
  const errChunks: Buffer[] = [];

  child.stdout.on("data", (c: Buffer) => {
    outChunks.push(c);
    process.stdout.write(c);
  });
  child.stderr.on("data", (c: Buffer) => {
    errChunks.push(c);
    process.stderr.write(c);
  });

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal }));
  });

  const endIso = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  const out = captureHeadTail(Buffer.concat(outChunks), STDIO_HEAD_TAIL_BYTES);
  const err = captureHeadTail(Buffer.concat(errChunks), STDIO_HEAD_TAIL_BYTES);

  const event: CommandEvent = {
    command: cmdString,
    startTime: startIso,
    endTime: endIso,
    durationMs,
    exitCode: result.code,
    signal: result.signal ?? undefined,
    stdoutHead: out.head,
    stdoutTail: out.tail,
    stderrHead: err.head,
    stderrTail: err.tail,
    stdoutBytes: out.bytes,
    stderrBytes: err.bytes,
    truncated: out.truncated || err.truncated,
  };

  active.commands.push(event);
  writeActive(cwd, active);

  process.exit(result.code ?? 1);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/run.ts
git commit -m "feat(cmd): implement run with shell-true stream+capture"
```

---

## Task 13: Implement `commands/stop.ts`

**Files:**
- Create: `src/commands/stop.ts`

- [ ] **Step 1: Implement**

```ts
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
  const html = renderReport(active);
  active.reportPath = p.reportHtml(active.id);

  writeRun(cwd, active);
  writeFileSync(p.reportHtml(active.id), html, "utf8");
  clearActive(cwd);

  console.log("✓ AgentLens run finalized.");
  console.log(`  Run id: ${active.id}`);
  console.log(`  Report: ${p.reportHtml(active.id)}`);
  console.log(`  Open it: agentlens open ${active.id}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/stop.ts
git commit -m "feat(cmd): implement stop with risks + report generation"
```

---

## Task 14: Implement `commands/status.ts`

**Files:**
- Create: `src/commands/status.ts`

- [ ] **Step 1: Implement**

```ts
import { readActive, listFinalizedRunIds } from "../core/storage.js";
import { resolvePaths } from "../config.js";
import { formatRelative } from "../core/time.js";
import { isGitRepo, getStatusShort } from "../git.js";
import { parseChangedFilesFromStatus } from "../git.js";

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
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/status.ts
git commit -m "feat(cmd): implement status with live changed-file count"
```

---

## Task 15: Implement `commands/report.ts`

**Files:**
- Create: `src/commands/report.ts`

- [ ] **Step 1: Implement**

```ts
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
  const html = renderReport(run);
  const p = resolvePaths(cwd);
  writeFileSync(p.reportHtml(id), html, "utf8");
  run.reportPath = p.reportHtml(id);
  writeRun(cwd, run);
  console.log(`Report regenerated: ${p.reportHtml(id)}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/report.ts
git commit -m "feat(cmd): implement report regeneration"
```

---

## Task 16: Implement `commands/list.ts`

**Files:**
- Create: `src/commands/list.ts`

- [ ] **Step 1: Implement**

```ts
import { listFinalizedRunIds, readRun } from "../core/storage.js";
import { formatDuration } from "../core/time.js";

function pad(s: string, n: number) { return (s + " ".repeat(n)).slice(0, n); }
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
  console.log(pad("ID", 36) + pad("BRANCH", 16) + pad("STARTED", 22) + pad("DURATION", 10) + pad("CMDS", 6) + pad("FILES", 6) + "RISK");
  for (const id of ids) {
    try {
      const r = readRun(cwd, id);
      const dur = r.endTime ? new Date(r.endTime).getTime() - new Date(r.startTime).getTime() : 0;
      console.log(
        pad(r.id, 36) +
        pad(r.branch || "—", 16) +
        pad(r.startTime, 22) +
        pad(formatDuration(dur), 10) +
        pad(String(r.commands.length), 6) +
        pad(String(r.changedFiles.length), 6) +
        highest(r.risks.map((x) => x.level))
      );
    } catch {
      console.log(pad(id, 36) + "(unreadable)");
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat(cmd): implement list of finalized runs"
```

---

## Task 17: Implement `commands/open.ts`

**Files:**
- Create: `src/commands/open.ts`

- [ ] **Step 1: Implement**

```ts
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolvePaths } from "../config.js";
import { listFinalizedRunIds } from "../core/storage.js";

export function open(cwd: string, id: string): void {
  const p = resolvePaths(cwd);
  const path = p.reportHtml(id);
  if (!existsSync(path)) {
    console.error(`No report at ${path}.`);
    const ids = listFinalizedRunIds(cwd);
    if (ids.length > 0) {
      console.error(`Available run ids: ${ids.sort().reverse().slice(0, 10).join(", ")}`);
    }
    process.exit(1);
  }
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === "darwin") {
    cmd = "open"; args = [path];
  } else if (platform === "win32") {
    cmd = "cmd"; args = ["/c", "start", "", path];
  } else {
    cmd = "xdg-open"; args = [path];
  }
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", (e) => {
    console.error(`Failed to open browser: ${e.message}`);
    console.error(`Path: ${path}`);
    process.exit(1);
  });
  child.unref();
  console.log(`Opened ${path}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/open.ts
git commit -m "feat(cmd): implement cross-platform open"
```

---

## Task 18: Implement `src/cli.ts`

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: Implement**

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./commands/init.js";
import { start } from "./commands/start.js";
import { run } from "./commands/run.js";
import { stop } from "./commands/stop.js";
import { status } from "./commands/status.js";
import { report } from "./commands/report.js";
import { list } from "./commands/list.js";
import { open } from "./commands/open.js";

const program = new Command();

program
  .name("agentlens")
  .description("Open-source observability for AI coding agents. See what your AI coding agent actually did.")
  .version("0.1.0");

program.command("init")
  .description("Initialize .agentlens/ in the current directory.")
  .action(() => init(process.cwd()));

program.command("start")
  .description("Begin a recording session.")
  .action(() => start(process.cwd()));

program.command("run")
  .description("Run a shell command and record it into the active session.")
  .argument("[args...]", "Command to run (use `--` to separate AgentLens args from the command).")
  .allowUnknownOption(true)
  .action(async (args: string[]) => {
    await run(process.cwd(), args ?? []);
  });

program.command("stop")
  .description("Finalize the active session and generate the report.")
  .action(() => stop(process.cwd()));

program.command("status")
  .description("Show whether a session is active and key live stats.")
  .action(() => status(process.cwd()));

program.command("report")
  .description("Regenerate the report for the most recent run.")
  .action(() => report(process.cwd()));

program.command("list")
  .description("List finalized runs.")
  .action(() => list(process.cwd()));

program.command("open")
  .description("Open a run's report in the default browser.")
  .argument("<run-id>", "Run id from `agentlens list`.")
  .action((id: string) => open(process.cwd(), id));

program.addHelpText("after", `
Notes:
  agentlens run -- <command>  executes through your shell
                              (\`/bin/sh -c "..."\` on Unix, \`cmd.exe /d /s /c\` on Windows).
                              Quote and escape per your shell's rules.

Examples:
  $ agentlens init
  $ agentlens start
  $ agentlens run -- npm test
  $ agentlens run -- npm run build
  $ agentlens stop
  $ agentlens open run_20260529T144700Z_a1b2c3
`);

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Build the project**

```bash
npx tsc
```

Expected: builds `dist/cli.js` without errors.

- [ ] **Step 3: Smoke test the CLI**

```bash
node dist/cli.js --help
node dist/cli.js init
node dist/cli.js status
```

Expected:
- `--help` shows all commands including `status`.
- `init` creates `.agentlens/`.
- `status` reports "No active AgentLens session."

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): wire commander entrypoint for all commands"
```

---

## Task 19: README and final polish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Sections:
1. **Headline**: "AgentLens — open-source observability for AI coding agents."
2. **Tagline**: "See what your AI coding agent actually did."
3. **Why**: short paragraph on the problem (agents change many files quickly; reviewing is hard).
4. **Install**: `npm install -g agentlens` (with note that it's pre-publish — for now use `npm link` from the repo).
5. **Quickstart**: 5 commands.
6. **Commands**: brief table of all 8 commands.
7. **Sample report**: placeholder note pointing to `.agentlens/runs/<id>/report.html`.
8. **Storage**: short description of `.agentlens/` layout.
9. **Roadmap**: dark theme, agent attribution, server sync, search/filter.
10. **Contributing**: clone, install, test, build.
11. **License**: MIT.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with positioning, quickstart, and roadmap"
```

---

## Task 20: End-to-end verification

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Build**

```bash
npx tsc
```

Expected: no errors.

- [ ] **Step 3: End-to-end smoke test in a tmp git repo**

```bash
TMP=$(mktemp -d)
( cd "$TMP" && git init -q && echo "hello" > a.txt && git add a.txt && git commit -q -m init )
node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js init        # in $TMP
( cd "$TMP" && node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js init )
( cd "$TMP" && node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js start )
( cd "$TMP" && node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js run -- bash -c "echo hello > b.txt" )
( cd "$TMP" && node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js run -- bash -c "false" || true )
( cd "$TMP" && node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js status )
( cd "$TMP" && node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js stop )
( cd "$TMP" && node /Users/mihirsinhchavda/Applications/OpenSaurce/agentlens/dist/cli.js list )
```

Expected:
- `start` succeeds, `run` records, `status` shows active.
- `stop` produces `.agentlens/runs/<id>/report.html`.
- The report contains "Review before commit", risk section with at least the failed-command flag, and a non-empty changed-files section.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final polish + verification"
```

---

## Self-review note (writer to executor)

- All 8 CLI verbs from spec §1 are covered (Tasks 10–17 plus 18 for wiring).
- All risk rules from spec §5 covered by tests in Task 4.
- Stdout/stderr head/tail + truncated boolean covered by Task 12's `captureHeadTail`.
- Diff head/tail truncation (no gzip) covered in Task 8's `takeSnapshot`.
- "Review before commit" pills covered in Task 6 tests and renderer.
- README positioning covered in Task 19.
- Storage purity split into `serialize`/`deserialize` + I/O wrappers, per spec §11.
