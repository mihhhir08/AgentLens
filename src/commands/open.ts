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
      console.error(
        `Available run ids: ${ids.sort().reverse().slice(0, 10).join(", ")}`,
      );
    }
    process.exit(1);
  }
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === "darwin") {
    cmd = "open";
    args = [path];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", path];
  } else {
    cmd = "xdg-open";
    args = [path];
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
