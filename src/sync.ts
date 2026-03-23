import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { VersionReport } from "./core/types.js";
import { SYNC_TARGETS } from "./catalog.js";
import { getVersionReport } from "./router.js";

function parseOutDir(argv: string[]): string {
  const i = argv.indexOf("--out");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  return path.resolve("versions");
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Space out network work (429 / fair use). `SYNC_DELAY_MS` overrides; default 200ms in CI, 0 locally. */
function syncDelayMs(): number {
  const raw = process.env.SYNC_DELAY_MS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return process.env.CI ? 200 : 0;
}

export interface SyncMetaResult {
  slug: string;
  file: string;
  ok: boolean;
  error?: string;
}

export interface SyncMeta {
  generatedAt: string;
  source: string;
  /** UTC prefix for archive dirs: `<product>/old/<stamp>__<release>/` (sibling of stable/latest, not under them). */
  archiveRunStamp?: string;
  results: SyncMetaResult[];
}

function safeIsoStamp(d: Date): string {
  return d.toISOString().replace(/:/g, "-");
}

function sanitizeFileSegment(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 120) || "unknown";
}

/** Best-effort label for archive folder (latest → supported → LTS → beta → Windows families). */
export function pickReleaseLabel(report: VersionReport): string {
  if (report.latest?.version) return report.latest.version;
  if (report.supported?.[0]?.version) return report.supported[0].version;
  if (report.lts[0]?.version) return report.lts[0].version;
  if (report.beta?.version) return report.beta.version;
  const w = report.windows;
  if (w) {
    return (
      w.win11?.version ??
      w.win10?.version ??
      w.win7?.version ??
      "unknown"
    );
  }
  return "unknown";
}

function channelFromTargetFile(tFile: string): string {
  const parts = tFile.split("/").filter(Boolean);
  return parts[parts.length - 2] ?? "";
}

function payloadForChannel(
  report: VersionReport,
  channel: string,
): VersionReport[keyof VersionReport] | VersionReport | null {
  const c = channel.toLowerCase();
  if (c === "latest" || c === "stable") return report.latest;
  if (c === "beta") return report.beta;
  if (c === "lts") return report.lts;
  return report;
}

function pickReleaseLabelForChannel(report: VersionReport, channel: string): string {
  const c = channel.toLowerCase();
  if (c === "latest" || c === "stable") return report.latest?.version ?? "unknown";
  if (c === "beta") return report.beta?.version ?? "unknown";
  if (c === "lts") return report.lts[0]?.version ?? "unknown";
  return pickReleaseLabel(report);
}

function archiveFolderName(runStamp: string, report: VersionReport, channel: string): string {
  return `${runStamp}__${sanitizeFileSegment(pickReleaseLabelForChannel(report, channel))}`;
}

async function readUtf8OrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function runSync(
  outDir: string,
  opts?: { continueOnError?: boolean; archive?: boolean },
): Promise<SyncMeta> {
  const continueOnError = opts?.continueOnError ?? false;
  const archive = opts?.archive ?? true;
  const results: SyncMetaResult[] = [];
  const generatedAt = new Date().toISOString();
  const runStamp = safeIsoStamp(new Date(generatedAt));

  for (const t of SYNC_TARGETS) {
    try {
      const report = await getVersionReport(t.slug);
      const dest = path.join(outDir, t.file);
      const channel = channelFromTargetFile(t.file);
      const payload = payloadForChannel(report, channel);
      const body = `${JSON.stringify(payload, null, 2)}\n`;
      const prev = await readUtf8OrNull(dest);
      const changed = prev !== body;
      const changedFromExisting = prev !== null && changed;
      await mkdir(path.dirname(dest), { recursive: true });
      if (changed) {
        await writeFile(dest, body, "utf8");
      }

      if (archive && changedFromExisting) {
        // .../ide/vscode/stable/version.json → .../ide/vscode/old/<stamp>__<rel>/version.json
        const channelDir = path.dirname(dest);
        const productRoot = path.dirname(channelDir);
        const archDir = path.join(
          productRoot,
          "old",
          archiveFolderName(runStamp, report, channel),
        );
        await mkdir(archDir, { recursive: true });
        await writeFile(path.join(archDir, "version.json"), body, "utf8");
      }

      results.push({ slug: t.slug, file: t.file, ok: true });
      const gap = syncDelayMs();
      if (gap > 0) await sleep(gap);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ slug: t.slug, file: t.file, ok: false, error: msg });
      if (!continueOnError) throw e;
    }
  }

  const meta: SyncMeta = {
    generatedAt,
    archiveRunStamp: archive ? runStamp : undefined,
    source: "versions-getter sync",
    results,
  };
  await mkdir(outDir, { recursive: true });
  await mkdir(path.join(outDir, "meta"), { recursive: true });
  await writeFile(
    path.join(outDir, "meta", "version.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );

  return meta;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const outDir = parseOutDir(argv);
  const continueOnError = hasFlag(argv, "--continue-on-error");
  const archive = !hasFlag(argv, "--no-archive");

  try {
    const meta = await runSync(outDir, { continueOnError, archive });
    const failed = meta.results.filter((r) => !r.ok);
    if (failed.length) {
      for (const f of failed) {
        console.error(`fail ${f.slug} → ${f.file}: ${f.error}`);
      }
      const anyOk = meta.results.some((r) => r.ok);
      process.exitCode = continueOnError ? (anyOk ? 0 : 1) : 1;
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] &&
  path.normalize(path.resolve(process.argv[1])) ===
    path.normalize(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
