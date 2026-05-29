import { execFileSync } from "node:child_process";
import type { ChangedFile, ChangedFileStatus, GitSnapshot } from "./core/types.js";
import { DIFF_HEAD_TAIL_BYTES, DIFF_TRUNCATE_THRESHOLD_BYTES } from "./core/types.js";

function tryGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).toString();
  } catch {
    return "";
  }
}

export function isGitRepo(cwd: string): boolean {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
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
  const buf = Buffer.from(fullDiff, "utf8");
  const bytes = buf.length;
  if (bytes > DIFF_TRUNCATE_THRESHOLD_BYTES) {
    return {
      isGitRepo: true,
      statusShort: getStatusShort(cwd),
      diffStat: getDiffStat(cwd),
      diffNameStatus: getDiffNameStatus(cwd),
      fullDiff: "",
      fullDiffTruncated: true,
      fullDiffHead: buf.subarray(0, DIFF_HEAD_TAIL_BYTES).toString("utf8"),
      fullDiffTail: buf.subarray(bytes - DIFF_HEAD_TAIL_BYTES).toString("utf8"),
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

export function parseChangedFilesFromStatus(statusShort: string): ChangedFile[] {
  const out: ChangedFile[] = [];
  for (const raw of statusShort.split("\n")) {
    if (!raw.trim()) continue;
    const xy = raw.slice(0, 2);
    let path = raw.slice(3).trim();
    if (path.includes(" -> ")) {
      const parts = path.split(" -> ");
      path = parts[parts.length - 1]?.trim() ?? path;
    }
    let code: ChangedFileStatus = "M";
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
