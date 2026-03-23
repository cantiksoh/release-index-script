import type { VersionReport } from "../core/types.js";
import { httpFetch } from "../http/fetch.js";

/** Same channel as https://code.visualstudio.com/updates — stable release list. */
const RELEASES_STABLE =
  "https://update.code.visualstudio.com/api/releases/stable";

export function isVscodeAppSlug(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return (
    t === "vscode" ||
    t === "visual-studio-code" ||
    t === "vscode-app" ||
    t === "code"
  );
}

export async function fetchVscodeAppReport(): Promise<VersionReport> {
  const res = await httpFetch(RELEASES_STABLE, {
    headers: { Accept: "application/json" },
  });
  const versions = (await res.json()) as string[];
  const v = versions[0];
  if (!v) {
    return { product: "vscode", latest: null, lts: [], beta: null };
  }
  const parts = v.split(".");
  const series =
    parts.length >= 2 ? `${parts[0]}.${parts[1]}` : v;
  const major = parts[0] ?? "1";
  const minor = parts[1] ?? "0";
  const link = `https://code.visualstudio.com/updates/v${major}_${minor}`;

  return {
    product: "vscode",
    latest: { series, version: v, link },
    lts: [],
    beta: null,
  };
}
