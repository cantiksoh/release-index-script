import type { VersionEntry, VersionReport } from "../core/types.js";
import { httpFetch } from "../http/fetch.js";

const DOWNLOAD_PAGE = "https://www.sublimetext.com/download";

export function isSublimeTextSlug(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "sublime-text" || t === "sublime" || t === "sublime-text4";
}

function entry(series: string, version: string): VersionEntry {
  return {
    series,
    version,
    link: DOWNLOAD_PAGE,
  };
}

export async function fetchSublimeTextReport(): Promise<VersionReport> {
  const res = await httpFetch(DOWNLOAD_PAGE, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const html = await res.text();

  const majorMatch = html.match(/Sublime Text\s*([0-9]+)/i);
  const buildMatch = html.match(/build\s*([0-9]+)/i);

  const major = majorMatch?.[1] ?? null;
  const build = buildMatch?.[1] ?? null;

  // Sublime publishes a major line (usually "4") plus a build number.
  const version = major && build ? `${major}.${build}` : major ?? build ?? null;
  const series = major ?? (version ? version.split(".")[0] : "unknown");

  const latest = version ? entry(series, version) : null;

  return {
    product: "sublime-text",
    latest,
    lts: [],
    beta: null,
  };
}

