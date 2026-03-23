import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { WAKATIME_KNOWN_PLUGINS } from "./providers/wakatime.js";

function wakatimeIdeGroup(repo: string): string {
  if (repo === "wakatime-mode") return "emacs";
  const lower = repo.toLowerCase();
  const idx = lower.indexOf("-wakatime");
  if (idx > 0) return lower.slice(0, idx);
  if (lower.endsWith("-wakatime")) return lower.slice(0, -"-wakatime".length);
  return lower.split("-")[0] || "wakatime";
}

function dirExists(p: string): Promise<boolean> {
  return stat(p)
    .then((s) => s.isDirectory())
    .catch(() => false);
}

async function fileExists(p: string): Promise<boolean> {
  return stat(p).then((s) => s.isFile()).catch(() => false);
}

export async function migrateWakatimeLayout(
  repoDir: string,
  opts?: { deleteOld?: boolean },
): Promise<void> {
  const deleteOld = opts?.deleteOld ?? false;

  for (const plugin of WAKATIME_KNOWN_PLUGINS) {
    const srcBase = path.join(repoDir, "plugins", "wakatime", plugin);
    if (!(await dirExists(srcBase))) continue;

    const ideGroup = wakatimeIdeGroup(plugin);
    const destBase = path.join(repoDir, "plugins", ideGroup, plugin);
    await mkdir(path.dirname(destBase), { recursive: true });

    const srcLatest = path.join(srcBase, "latest", "version.json");
    const destLatest = path.join(destBase, "latest", "version.json");
    if ((await fileExists(srcLatest)) && !(await fileExists(destLatest))) {
      await mkdir(path.dirname(destLatest), { recursive: true });
      await cp(srcLatest, destLatest, { recursive: false });
    }

    const srcOld = path.join(srcBase, "old");
    const destOld = path.join(destBase, "old");
    if (await dirExists(srcOld)) {
      await mkdir(destOld, { recursive: true });
      const entries = await readdir(srcOld, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const src = path.join(srcOld, e.name);
        const dst = path.join(destOld, e.name);
        if (!(await dirExists(dst))) {
          await cp(src, dst, { recursive: true });
        }
      }
    }

    // Keep it safe by default; you can opt-in to deletion once you’re happy.
    if (deleteOld) {
      await rm(srcBase, { recursive: true, force: true });
    }
  }

  // Tiny marker so you can tell migration ran at least once.
  // This is optional, but helps when debugging later.
  const marker = path.join(repoDir, ".migrate-wakatime-layout.txt");
  const now = new Date().toISOString();
  await writeFile(marker, `migrated at ${now}\n`, "utf8");
}

function parseArgValue(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (!v) return null;
  return v;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const repoDir = parseArgValue(argv, "--repo") ?? ".";
  const deleteOld = argv.includes("--delete-old");
  await migrateWakatimeLayout(path.resolve(repoDir), { deleteOld });
}

function isEntryThisFile(): boolean {
  return Boolean(
    process.argv[1] &&
      path.normalize(path.resolve(process.argv[1])) ===
        path.normalize(fileURLToPath(import.meta.url)),
  );
}

if (isEntryThisFile()) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

