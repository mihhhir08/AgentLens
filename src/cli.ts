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
  .description(
    "Open-source observability for AI coding agents. See what your AI coding agent actually did.",
  )
  .version("0.1.0");

program
  .command("init")
  .description("Initialize .agentlens/ in the current directory.")
  .action(() => init(process.cwd()));

program
  .command("start")
  .description("Begin a recording session.")
  .action(() => start(process.cwd()));

program
  .command("run")
  .description("Run a shell command and record it into the active session.")
  .argument("[args...]", "Command to run (use `--` to separate AgentLens args from the command).")
  .allowUnknownOption(true)
  .action(async (args: string[]) => {
    await run(process.cwd(), args ?? []);
  });

program
  .command("stop")
  .description("Finalize the active session and generate the report.")
  .action(() => stop(process.cwd()));

program
  .command("status")
  .description("Show whether a session is active and key live stats.")
  .action(() => status(process.cwd()));

program
  .command("report")
  .description("Regenerate the report for the most recent run.")
  .action(() => report(process.cwd()));

program
  .command("list")
  .description("List finalized runs.")
  .action(() => list(process.cwd()));

program
  .command("open")
  .description("Open a run's report in the default browser.")
  .argument("<run-id>", "Run id from `agentlens list`.")
  .action((id: string) => open(process.cwd(), id));

program.addHelpText(
  "after",
  `
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
`,
);

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
