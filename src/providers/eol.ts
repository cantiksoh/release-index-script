import type { VersionEntry, VersionReport } from "../core/types.js";
import { compareDots } from "../core/semver.js";
import { httpFetch } from "../http/fetch.js";

const API_BASE = "https://endoflife.date/api/v1/products";

export interface ReleaseLatest {
  name: string;
  date: string | null;
  link: string | null;
}

export interface ProductRelease {
  name: string;
  label: string | null;
  releaseDate: string | null;
  isLts: boolean;
  isEol: boolean;
  isMaintained: boolean;
  eolFrom: string | null;
  latest: ReleaseLatest | null;
  isEoas?: boolean;
}

export interface ProductResult {
  name: string;
  label: string | null;
  releases: ProductRelease[];
}

export interface ApiEnvelope {
  result: ProductResult;
}

export function productSlugFromUrl(urlOrSlug: string): string {
  const trimmed = urlOrSlug.trim();
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (!u.hostname.endsWith("endoflife.date")) {
      return trimmed.replace(/^\/+|\/+$/g, "");
    }
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return seg || trimmed;
  } catch {
    return trimmed.replace(/^\/+|\/+$/g, "");
  }
}

export async function fetchProduct(slug: string): Promise<ProductResult> {
  const id = encodeURIComponent(productSlugFromUrl(slug));
  const res = await httpFetch(`${API_BASE}/${id}/`, {
    headers: { Accept: "application/json" },
  });
  const body = (await res.json()) as ApiEnvelope;
  return body.result;
}

function toEntry(
  r: ProductRelease,
  extra?: Partial<VersionEntry>,
): VersionEntry {
  return {
    series: r.name,
    version: r.latest!.name,
    link: r.latest!.link,
    eol: r.eolFrom,
    maintained: r.isMaintained && !r.isEol,
    ...extra,
  };
}

export function parseLatestAndLts(product: ProductResult): VersionReport {
  const active = product.releases.filter((r) => r.isMaintained && !r.isEol);

  const nonLts = active
    .filter((r) => !r.isLts && r.latest?.name)
    .sort((a, b) => compareDots(b.name, a.name));
  const top = nonLts[0];

  const lts = active
    .filter((r) => r.isLts && r.latest?.name)
    .sort((a, b) => compareDots(b.name, a.name))
    .map((r) => toEntry(r));

  return {
    product: product.name,
    latest: top && top.latest ? toEntry(top) : null,
    lts,
    beta: null,
  };
}

function sortByReleaseDateDesc(a: ProductRelease, b: ProductRelease): number {
  const da = a.releaseDate ?? "";
  const db = b.releaseDate ?? "";
  return db.localeCompare(da);
}

function isWin11Consumer(r: ProductRelease): boolean {
  return r.name.startsWith("11-") && !r.name.includes("iot");
}

function isWin10Consumer(r: ProductRelease): boolean {
  return r.name.startsWith("10-") && !r.name.includes("iot");
}

function isWin7(r: ProductRelease): boolean {
  return r.name === "7-sp1" || r.name.startsWith("7-");
}

function pickNewestInFamily(
  releases: ProductRelease[],
  pred: (r: ProductRelease) => boolean,
): VersionEntry | null {
  const rows = releases.filter(pred).filter((r) => r.latest?.name);
  if (!rows.length) return null;
  const maintained = rows.filter((r) => r.isMaintained);
  const pool = maintained.length ? maintained : rows;
  pool.sort(sortByReleaseDateDesc);
  return toEntry(pool[0]);
}

export function parseWindows(product: ProductResult): VersionReport {
  const rel = product.releases;

  const win7 = pickNewestInFamily(rel, isWin7);
  const win10 = pickNewestInFamily(rel, isWin10Consumer);
  const win11 = pickNewestInFamily(rel, isWin11Consumer);

  const active = rel.filter((r) => r.isMaintained && !r.isEol);
  const lts = active
    .filter((r) => r.isLts && r.latest?.name)
    .sort(sortByReleaseDateDesc)
    .map((r) => toEntry(r));

  const nonLtsMaintained = active
    .filter((r) => !r.isLts && r.latest?.name && isWin11Consumer(r))
    .sort(sortByReleaseDateDesc);
  const latest = nonLtsMaintained[0] ? toEntry(nonLtsMaintained[0]) : win11;

  return {
    product: "windows",
    latest,
    lts,
    beta: null,
    windows: { win7, win10, win11 },
  };
}

interface GoDlRow {
  version: string;
  stable: boolean;
}

function parseGoVersionParts(t: string): number[] {
  const s = t.replace(/^go/i, "");
  const m = s.match(/^(\d+)\.(\d+)(?:\.(\d+))?((?:rc|beta|alpha)(\d+))?$/);
  if (!m) return [0, 0, 0, 0, 0];
  const [, maj, min, patch, preFull] = m;
  const major = parseInt(maj, 10);
  const minor = parseInt(min, 10);
  const patchNum = patch ? parseInt(patch, 10) : 0;
  if (!preFull) {
    return [major, minor, patchNum, 4, 0];
  }
  const preM = preFull.match(/^(rc|beta|alpha)(\d+)$/);
  if (!preM) return [major, minor, patchNum, 0, 0];
  const kind = preM[1] === "rc" ? 3 : preM[1] === "beta" ? 2 : 1;
  const n = parseInt(preM[2], 10);
  return [major, minor, patchNum, kind, n];
}

function compareGoVersionTag(a: string, b: string): number {
  const ra = parseGoVersionParts(a);
  const rb = parseGoVersionParts(b);
  for (let i = 0; i < 5; i++) {
    const d = (ra[i] ?? 0) - (rb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

async function fetchGoBetaFromDl(latestStableTag: string): Promise<VersionEntry | null> {
  const res = await httpFetch("https://go.dev/dl/?mode=json&include=all", {
    headers: { Accept: "application/json" },
    throwOnError: false,
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as GoDlRow[];
  const unstable = [...new Set(rows.filter((r) => !r.stable).map((r) => r.version))];
  const newer = unstable.filter((u) => compareGoVersionTag(u, latestStableTag) > 0);
  if (!newer.length) return null;
  newer.sort((a, b) => compareGoVersionTag(b, a));
  const tag = newer[0];
  const ver = tag.replace(/^go/i, "");
  return {
    series: ver.replace(/(beta|rc|alpha).*/i, "").replace(/\.$/, "") || ver,
    version: ver,
    link: "https://go.dev/dl/#go_dev_version",
  };
}

async function fetchGoStableFromDl(): Promise<{ entry: VersionEntry; tag: string } | null> {
  const res = await httpFetch("https://go.dev/dl/?mode=json", {
    headers: { Accept: "application/json" },
    throwOnError: false,
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as GoDlRow[];
  const stable = rows.find((r) => r.stable);
  if (!stable) return null;
  const ver = stable.version.replace(/^go/i, "");
  return {
    tag: stable.version,
    entry: {
      series: ver.split(".").slice(0, 2).join("."),
      version: ver,
      link: "https://go.dev/dl/",
    },
  };
}

export async function parseGo(product: ProductResult): Promise<VersionReport> {
  const maintained = product.releases
    .filter((r) => r.isMaintained && !r.isEol && r.latest?.name)
    .sort((a, b) => compareDots(b.name, a.name));

  const supported = maintained.map((r) => toEntry(r));

  const dl = await fetchGoStableFromDl();
  const beta = dl ? await fetchGoBetaFromDl(dl.tag) : null;
  const eolLatest = maintained[0] ? toEntry(maintained[0]) : null;
  const latest = dl?.entry ?? eolLatest;

  return {
    product: "go",
    latest,
    lts: [],
    beta,
    supported,
  };
}

export function normalizeProductId(slug: string): string {
  const s = productSlugFromUrl(slug);
  if (s === "golang") return "go";
  return s;
}
