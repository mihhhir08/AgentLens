import { spawn } from "node:child_process";
import { readActive, writeActive } from "../core/storage.js";
import type { CommandEvent } from "../core/types.js";
import { STDIO_HEAD_TAIL_BYTES } from "../core/types.js";

function captureHeadTail(
  buf: Buffer,
  cap: number,
): { head: string; tail: string; bytes: number; truncated: boolean } {
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

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.on("close", (code, signal) => resolve({ code, signal }));
    },
  );

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
