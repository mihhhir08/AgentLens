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
