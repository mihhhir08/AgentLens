import type { AgentLensRun, CommandEvent, RiskFlag, RiskLevel } from "./types.js";

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
  const last = diffStat.trim().split("\n").pop() ?? "";
  const filesMatch = last.match(/(\d+)\s+files?\s+changed/);
  const insMatch = last.match(/(\d+)\s+insertions?\(\+\)/);
  const delMatch = last.match(/(\d+)\s+deletions?\(-\)/);
  const files = filesMatch && filesMatch[1] ? parseInt(filesMatch[1], 10) : 0;
  const ins = insMatch && insMatch[1] ? parseInt(insMatch[1], 10) : 0;
  const del = delMatch && delMatch[1] ? parseInt(delMatch[1], 10) : 0;
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
