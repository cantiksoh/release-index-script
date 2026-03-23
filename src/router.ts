import type { VersionReport } from "./core/types.js";
import { retryNetworkOnce } from "./core/decorators.js";
import { fetchAntigravityReport, isAntigravitySlug } from "./providers/ag.js";
import { fetchCursorReport, isCursorSlug } from "./providers/cursor.js";
import { fetchVscodeAppReport, isVscodeAppSlug } from "./providers/vscode-app.js";
import {
  fetchProduct,
  normalizeProductId,
  parseGo,
  parseLatestAndLts,
  parseWindows,
} from "./providers/eol.js";
import { fetchGithubReleaseReport, parseWakatimeGithubRef } from "./providers/wakatime.js";

async function resolveReport(urlOrSlug: string): Promise<VersionReport> {
  if (isCursorSlug(urlOrSlug)) {
    return fetchCursorReport();
  }
  if (isVscodeAppSlug(urlOrSlug)) {
    return fetchVscodeAppReport();
  }
  if (isAntigravitySlug(urlOrSlug)) {
    return fetchAntigravityReport();
  }
  const wakatimeRef = parseWakatimeGithubRef(urlOrSlug.trim());
  if (wakatimeRef) {
    return fetchGithubReleaseReport(wakatimeRef);
  }
  const id = normalizeProductId(urlOrSlug);
  if (id === "go") {
    const product = await fetchProduct("go");
    return parseGo(product);
  }
  if (id === "windows") {
    const product = await fetchProduct("windows");
    return parseWindows(product);
  }
  const product = await fetchProduct(id);
  return parseLatestAndLts(product);
}

export class Versions {
  @retryNetworkOnce
  async report(urlOrSlug: string): Promise<VersionReport> {
    return resolveReport(urlOrSlug);
  }
}

const versions = new Versions();

export async function getVersionReport(urlOrSlug: string): Promise<VersionReport> {
  return versions.report(urlOrSlug);
}

/** @deprecated use getVersionReport */
export async function getVersionsForEndOfLifePage(
  urlOrSlug: string,
): Promise<VersionReport> {
  return getVersionReport(urlOrSlug);
}
