import type { VersionEntry, VersionReport } from "../core/types.js";
import { compareDots } from "../core/semver.js";
import { httpFetch } from "../http/fetch.js";

const DOWNLOAD_PAGE = "https://cursor.com/download";

export function isCursorSlug(input: string): boolean {
  const t = input.trim().toLowerCase();
  if (t === "cursor" || t === "cursor-editor" || t === "cursor-ide") return true;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return u.hostname === "cursor.com" && u.pathname.includes("download");
  } catch {
    return false;
  }
}

function parseLatestMarkedVersion(html: string): string | null {
  const re = />(\d+\.\d+(?:\.\d+)?)<\/span>[\s\S]{0,200}?Latest/gi;
  const m = re.exec(html);
  return m ? m[1] : null;
}

function parseVersionsFromSpans(html: string): string[] {
  const raw = [...html.matchAll(/>(\d+\.\d+(?:\.\d+)?)<\/span>/g)].map((m) => m[1]);
  const set = new Set<string>();
  for (const v of raw) {
    const parts = v.split(".");
    if (parts.length < 2 || parts.length > 3) continue;
    const major = parseInt(parts[0], 10);
    if (major >= 0 && major < 100) set.add(v);
  }
  return [...set].sort((a, b) => compareDots(b, a));
}

function entry(version: string): VersionEntry {
  const parts = version.split(".");
  return {
    series: parts.slice(0, 2).join("."),
    version,
    link: DOWNLOAD_PAGE,
  };
}

export async function fetchCursorReport(): Promise<VersionReport> {
  const res = await httpFetch(DOWNLOAD_PAGE, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const html = await res.text();

  const marked = parseLatestMarkedVersion(html);
  const fromSpans = parseVersionsFromSpans(html);
  const latestVer = marked ?? fromSpans[0] ?? null;

  const latest = latestVer ? entry(latestVer) : null;
  const supported = fromSpans.map(entry);

  return {
    product: "cursor",
    latest,
    lts: [],
    beta: null,
    supported: supported.length ? supported : undefined,
  };
}
