import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  serializeRun,
  deserializeRun,
  writeRun,
  readRun,
  writeActive,
  readActive,
  clearActive,
} from "../core/storage.js";
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

const sampleRun: AgentLensRun = {
  id: "run_x",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:00:01Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "abc",
  initialGit: blankSnap,
  finalGit: blankSnap,
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

  it("throws when schemaVersion is wrong", () => {
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
