import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** GET-only disk cache: one small JSON file per URL, no in-memory map. */

export interface DiskCacheConfig {
  dir: string;
  ttlMs: number;
}

function keyForUrl(href: string): string {
  return createHash("sha256").update(`GET\n${href}`).digest("hex");
}

function entryPath(cacheDir: string, key: string): string {
  return path.join(cacheDir, key.slice(0, 2), `${key.slice(2)}.json`);
}

interface CacheEntry {
  savedAt: number;
  status: number;
  body: string;
  contentType: string | null;
}

export async function diskCacheGet(
  cfg: DiskCacheConfig,
  href: string,
): Promise<Response | null> {
  const p = entryPath(cfg.dir, keyForUrl(href));
  let raw: string;
  try {
    raw = await readFile(p, "utf8");
  } catch {
    return null;
  }
  let entry: CacheEntry;
  try {
    entry = JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
  if (Date.now() - entry.savedAt > cfg.ttlMs) return null;
  const headers = new Headers();
  if (entry.contentType) headers.set("Content-Type", entry.contentType);
  return new Response(entry.body, { status: entry.status, headers });
}

export async function diskCachePut(
  cfg: DiskCacheConfig,
  href: string,
  status: number,
  bodyText: string,
  contentType: string | null,
): Promise<void> {
  const key = keyForUrl(href);
  const p = entryPath(cfg.dir, key);
  await mkdir(path.dirname(p), { recursive: true });
  const entry: CacheEntry = {
    savedAt: Date.now(),
    status,
    body: bodyText,
    contentType,
  };
  await writeFile(p, `${JSON.stringify(entry)}\n`, "utf8");
}

export function diskCacheConfigFromEnv(): DiskCacheConfig | null {
  const dir = process.env.HTTP_CACHE_DIR?.trim();
  if (!dir) return null;
  const ttlRaw = process.env.HTTP_CACHE_TTL_MS?.trim();
  const ttlMs = ttlRaw ? parseInt(ttlRaw, 10) : 86_400_000;
  if (!Number.isFinite(ttlMs) || ttlMs < 0) return null;
  return { dir: path.resolve(dir), ttlMs };
}
