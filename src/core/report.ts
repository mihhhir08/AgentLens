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
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Clean";
  }
}

function renderCommand(c: CommandEvent): string {
  const verdictLabel = c.exitCode === 0 ? "pass" : c.exitCode === null ? "interrupted" : "fail";
  const verdictClass = c.exitCode === 0 ? "ok" : "bad";
  const trunc = c.truncated ? `<span class="dim"> (truncated)</span>` : "";
  const stderrBlock =
    c.stderrHead || c.stderrTail
      ? `<div class="streamlabel">stderr</div><pre class="stream">${esc(c.stderrHead)}${c.stderrTail ? `\n[…tail…]\n${esc(c.stderrTail)}` : ""}</pre>`
      : "";
  const stdoutBlock =
    c.stdoutHead || c.stdoutTail
      ? `<div class="streamlabel">stdout</div><pre class="stream">${esc(c.stdoutHead)}${c.stdoutTail ? `\n[…tail…]\n${esc(c.stdoutTail)}` : ""}</pre>`
      : `<p class="dim">No output captured.</p>`;
  return `<details class="cmd">
      <summary>
        <code>${esc(c.command)}</code>
        <span class="badge ${verdictClass}">${verdictLabel}</span>
        <span class="dim">${formatDuration(c.durationMs)}</span>
        ${trunc}
      </summary>
      ${stdoutBlock}
      ${stderrBlock}
    </details>`;
}

function renderRisks(risks: RiskFlag[]): string {
  if (risks.length === 0) {
    return `<p class="empty">No risks detected. Looks clean.</p>`;
  }
  return risks
    .map(
      (r) => `<div class="risk risk-${r.level}">
        <span class="badge ${r.level}">${r.level}</span>
        <strong>${esc(r.title)}</strong>
        ${r.file ? `<code class="file">${esc(r.file)}</code>` : ""}
        <p>${esc(r.detail)}</p>
      </div>`,
    )
    .join("");
}

function renderFiles(files: ChangedFile[]): string {
  if (files.length === 0) return `<p class="empty">No file changes detected.</p>`;
  const groups: Record<string, ChangedFile[]> = { A: [], M: [], D: [], R: [], C: [], U: [], "?": [] };
  for (const f of files) groups[f.status]!.push(f);
  const names: Record<string, string> = {
    A: "Added",
    M: "Modified",
    D: "Deleted",
    R: "Renamed",
    C: "Copied",
    U: "Unmerged",
    "?": "Untracked",
  };
  const order: Array<keyof typeof names> = ["A", "M", "D", "R", "C", "U", "?"];
  return order
    .filter((k) => (groups[k]?.length ?? 0) > 0)
    .map(
      (k) =>
        `<div class="filegroup"><h4>${names[k]}</h4><ul>${groups[k]!
          .map((f) => `<li><code>${esc(f.path)}</code></li>`)
          .join("")}</ul></div>`,
    )
    .join("");
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

const STYLES = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #fafaf9; color: #18181b;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
  line-height: 1.5; }
main { max-width: 960px; margin: 0 auto; padding: 32px 24px 96px; }
header.runhdr { border-bottom: 1px solid #e7e5e4; padding-bottom: 16px; margin-bottom: 24px; }
header.runhdr h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.01em; }
header.runhdr .meta { color: #57534e; font-size: 14px; display: flex; flex-wrap: wrap; gap: 12px; }
header.runhdr .meta code { background: #f5f5f4; padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
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
.risk code.file { margin-left: 8px; background: #f5f5f4; padding: 1px 6px; border-radius: 4px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.cmd { background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 8px 14px; margin-bottom: 8px; }
.cmd summary { cursor: pointer; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.cmd code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.stream { background: #fafaf9; border: 1px solid #e7e5e4; padding: 10px; border-radius: 6px; max-height: 360px; overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
.streamlabel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #78716c; margin: 10px 0 4px; }
.filegroup h4 { margin: 8px 0 4px; font-size: 13px; color: #44403c; }
.filegroup ul { margin: 0 0 8px; padding-left: 18px; }
.filegroup code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.empty { color: #78716c; font-style: italic; }
.dim { color: #78716c; font-size: 12.5px; }
pre.diff, pre.stat { background: #1c1917; color: #e7e5e4; padding: 14px; border-radius: 8px; overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; white-space: pre; }
details summary { font-weight: 600; }
.copyrow { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 12px; }
button.copy { background: #1d4ed8; color: #fff; border: 0; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
button.copy:hover { background: #1e40af; }
pre.markdown { background: #fff; border: 1px solid #e7e5e4; padding: 14px; border-radius: 8px; overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; white-space: pre-wrap; }
@media (max-width: 720px) {
  .pills { grid-template-columns: 1fr 1fr; }
}
`;

export function renderReport(run: AgentLensRun): string {
  const durMs = run.endTime
    ? new Date(run.endTime).getTime() - new Date(run.startTime).getTime()
    : 0;
  const failedCount = run.commands.filter((c) => c.exitCode !== 0 && c.exitCode !== null).length;
  const highest = highestRisk(run.risks);
  const sensitive = touchedSensitive(run.changedFiles);
  const md = renderMarkdown(run);

  const shortSha = run.commitSha ? esc(run.commitSha.slice(0, 7)) : "(none)";
  const branchLabel = esc(run.branch || "(none)");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AgentLens — ${esc(run.id)}</title>
<style>${STYLES}</style>
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
