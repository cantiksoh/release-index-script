import type { VersionEntry, VersionReport } from "../core/types.js";
import { httpFetch } from "../http/fetch.js";
import { fetchVscodeMarketplaceReport } from "./mpx.js";

const GH_ACCEPT = "application/vnd.github+json";
const GH_API_VER = "2022-11-28";
const GITHUB_API_ORIGIN = "https://api.github.com";

export function githubApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const direct = `${GITHUB_API_ORIGIN}${p}`;
  const raw = process.env.GITHUB_PROXY ?? process.env.GH_PROXY;
  const proxy = raw?.trim();
  if (!proxy) return direct;
  const base = proxy.replace(/\/+$/, "");
  return `${base}/${direct}`;
}

function ghHeaders(): HeadersInit {
  const h: Record<string, string> = {
    Accept: GH_ACCEPT,
    "X-GitHub-Api-Version": GH_API_VER,
  };
  const t = process.env.GITHUB_TOKEN?.trim();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export const WAKATIME_KNOWN_PLUGINS = [
  "vscode-wakatime",
  "sublime-wakatime",
  "zed-wakatime",
  "jetbrains-wakatime",
  "vim-wakatime",
  "wakatime-mode",
  "atom-wakatime",
  "textmate-wakatime",
  "netbeans-wakatime",
  "eclipse-wakatime",
  "visualstudio-wakatime",
  "xcode-wakatime",
  "notepadpp-wakatime",
  "gedit-wakatime",
  "brackets-wakatime",
  "komodo-wakatime",
  "wing-wakatime",
  "browser-wakatime",
  "godot-wakatime",
  "kakoune-wakatime",
  "kate-wakatime",
  "ssms-wakatime",
  "sketch-wakatime",
  "adobe-xd-wakatime",
  "processing-wakatime",
  "texstudio-wakatime",
  "eric6-wakatime",
  "coda-wakatime",
  "c9-wakatime",
  "camunda-modeler-wakatime-plugin",
] as const;

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

const REPO_ALIASES: Record<string, string> = {
  "emacs-wakatime": "wakatime-mode",
  "emacs": "wakatime-mode",
};

export function parseWakatimeGithubRef(slug: string): GithubRepoRef | null {
  const t = slug.trim();
  const url = t.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#]+)/i);
  if (url) {
    return { owner: url[1], repo: url[2].replace(/\.git$/i, "") };
  }
  const slash = t.match(/^wakatime\/([^/]+)$/i);
  if (slash) {
    return { owner: "wakatime", repo: slash[1] };
  }
  const aliased = REPO_ALIASES[t.toLowerCase()];
  if (aliased) {
    return { owner: "wakatime", repo: aliased };
  }
  if (/^[\w.-]+-wakatime$/i.test(t)) {
    return { owner: "wakatime", repo: t };
  }
  return null;
}

function stripV(tag: string): string {
  return tag.replace(/^v/i, "");
}

interface GhRelease {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  published_at: string | null;
}

interface GhTag {
  name: string;
}

function isPrereleaseTag(tag: string): boolean {
  const s = stripV(tag);
  if (!/[-+]/.test(s)) return false;
  return /(?:beta|alpha|rc|pre|dev)(?:[.\d]|$)/i.test(s);
}

function tagToEntry(tag: string, ref: GithubRepoRef): VersionEntry {
  const v = stripV(tag);
  return {
    series: v.replace(/[-+].*$/, ""),
    version: v,
    link: `https://github.com/${ref.owner}/${ref.repo}/releases/tag/${encodeURIComponent(tag)}`,
  };
}

async function fetchGithubTags(ref: GithubRepoRef): Promise<string[]> {
  const url = githubApiUrl(`/repos/${ref.owner}/${ref.repo}/tags?per_page=100`);
  const res = await httpFetch(url, { headers: ghHeaders() });
  const tags = (await res.json()) as GhTag[];
  return tags.map((t) => t.name);
}

function reportFromTags(ref: GithubRepoRef, tagNames: string[]): VersionReport {
  if (!tagNames.length) {
    return {
      product: `${ref.owner}/${ref.repo}`,
      latest: null,
      lts: [],
      beta: null,
    };
  }
  const stable = tagNames.filter((t) => !isPrereleaseTag(t));
  const pre = tagNames.filter((t) => isPrereleaseTag(t));
  stable.sort((a, b) => cmpTag(stripV(b), stripV(a)));
  pre.sort((a, b) => cmpTag(stripV(b), stripV(a)));

  let latest: VersionEntry | null = null;
  if (stable.length) {
    latest = tagToEntry(stable[0], ref);
  } else if (pre.length) {
    latest = tagToEntry(pre[0], ref);
  }

  let beta: VersionEntry | null = null;
  if (stable.length && pre.length) {
    const sv = stripV(stable[0]);
    const newer = pre.filter((p) => cmpTag(stripV(p), sv) > 0);
    newer.sort((a, b) => cmpTag(stripV(b), stripV(a)));
    if (newer.length) {
      beta = tagToEntry(newer[0], ref);
    }
  }

  return {
    product: `${ref.owner}/${ref.repo}`,
    latest,
    lts: [],
    beta,
  };
}

function ghReleaseToEntry(r: GhRelease): VersionEntry {
  const v = stripV(r.tag_name);
  return {
    series: v.split(/[-+]/)[0] ?? v,
    version: v,
    link: r.html_url,
  };
}

function cmpTag(a: string, b: string): number {
  const core = (s: string) => stripV(s).replace(/[-+].*$/, "");
  const pa = core(a).split(".").map((x) => parseInt(x, 10) || 0);
  const pb = core(b).split(".").map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export async function fetchGithubReleaseReport(ref: GithubRepoRef): Promise<VersionReport> {
  if (ref.owner.toLowerCase() === "wakatime" && ref.repo.toLowerCase() === "vscode-wakatime") {
    const r = await fetchVscodeMarketplaceReport("WakaTime.vscode-wakatime");
    return { ...r, product: `${ref.owner}/${ref.repo}` };
  }

  const url = githubApiUrl(`/repos/${ref.owner}/${ref.repo}/releases?per_page=100`);
  const res = await httpFetch(url, { headers: ghHeaders() });
  const releases = (await res.json()) as GhRelease[];
  const usable = releases.filter((r) => !r.draft);
  if (!usable.length) {
    const tagNames = await fetchGithubTags(ref);
    return reportFromTags(ref, tagNames);
  }

  const stable = usable.filter((r) => !r.prerelease);
  const pre = usable.filter((r) => r.prerelease);

  stable.sort((a, b) => cmpTag(stripV(b.tag_name), stripV(a.tag_name)));
  pre.sort((a, b) => cmpTag(stripV(b.tag_name), stripV(a.tag_name)));

  let latest: VersionEntry | null = null;
  if (stable.length) {
    latest = ghReleaseToEntry(stable[0]);
  } else if (pre.length) {
    latest = ghReleaseToEntry(pre[0]);
  }

  let beta: VersionEntry | null = null;
  if (stable.length && pre.length) {
    const sv = stripV(stable[0].tag_name);
    const newer = pre.filter((p) => cmpTag(stripV(p.tag_name), sv) > 0);
    newer.sort((a, b) => cmpTag(stripV(b.tag_name), stripV(a.tag_name)));
    if (newer.length) {
      beta = ghReleaseToEntry(newer[0]);
    }
  }

  return {
    product: `${ref.owner}/${ref.repo}`,
    latest,
    lts: [],
    beta,
  };
}
