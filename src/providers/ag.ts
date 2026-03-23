import type { VersionEntry, VersionReport } from "../core/types.js";
import { compareDots } from "../core/semver.js";
import { httpFetch } from "../http/fetch.js";

const RELEASES_PAGE = "https://antigravity.google/releases";

export function isAntigravitySlug(input: string): boolean {
  const t = input.trim().toLowerCase();
  if (t === "antigravity" || t === "google-antigravity") return true;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return u.hostname.endsWith("antigravity.google") && u.pathname.includes("release");
  } catch {
    return false;
  }
}

function extractMainBundleSrc(html: string): string | null {
  const m = html.match(/src="(main-[A-Z0-9]+\.js)"/);
  return m ? m[1] : null;
}

function resolveBundleUrl(mainFile: string): string {
  return new URL(mainFile, new URL(RELEASES_PAGE)).href;
}

function parseVersionsFromBundle(js: string): {
  stable: Array<{ version: string; build: string }>;
  beta: Array<{ version: string; build: string }>;
} {
  const stable: Array<{ version: string; build: string }> = [];
  const beta: Array<{ version: string; build: string }> = [];
  const re = /antigravity\/(stable|beta)\/(\d+\.\d+\.\d+)-(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js)) !== null) {
    const row = { version: m[2], build: m[3] };
    if (m[1] === "stable") stable.push(row);
    else beta.push(row);
  }
  return { stable, beta };
}

function pickLatest(
  rows: Array<{ version: string; build: string }>,
): { version: string; build: string } | null {
  if (!rows.length) return null;
  const u = [...rows];
  u.sort((a, b) => {
    const c = compareDots(b.version, a.version);
    if (c !== 0) return c;
    const db = BigInt(b.build) - BigInt(a.build);
    return db > 0n ? 1 : db < 0n ? -1 : 0;
  });
  return u[0];
}

export async function fetchAntigravityReport(): Promise<VersionReport> {
  const pageRes = await httpFetch(RELEASES_PAGE, {
    headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
  });
  const html = await pageRes.text();
  const mainSrc = extractMainBundleSrc(html);
  if (!mainSrc) {
    throw new Error("Antigravity: could not find main-*.js bundle in releases HTML");
  }
  const bundleUrl = resolveBundleUrl(mainSrc);
  const jsRes = await httpFetch(bundleUrl, {
    headers: { Accept: "*/*" },
  });
  const js = await jsRes.text();
  const { stable, beta } = parseVersionsFromBundle(js);

  const topStable = pickLatest(stable);
  const latest: VersionEntry | null = topStable
    ? {
        series: topStable.version.split(".").slice(0, 2).join("."),
        version: topStable.version,
        buildId: topStable.build,
        link: RELEASES_PAGE,
      }
    : null;

  const topBeta = pickLatest(beta);
  let betaEntry: VersionEntry | null = null;
  if (topBeta && topStable && compareDots(topBeta.version, topStable.version) > 0) {
    betaEntry = {
      series: topBeta.version.split(".").slice(0, 2).join("."),
      version: topBeta.version,
      buildId: topBeta.build,
      link: RELEASES_PAGE,
    };
  } else if (topBeta && !topStable) {
    betaEntry = {
      series: topBeta.version.split(".").slice(0, 2).join("."),
      version: topBeta.version,
      buildId: topBeta.build,
      link: RELEASES_PAGE,
    };
  }

  return {
    product: "antigravity",
    latest,
    lts: [],
    beta: betaEntry,
  };
}
