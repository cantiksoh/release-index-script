export type { VersionEntry, VersionReport, WindowsFamilies } from "./core/types.js";
export { compareDots } from "./core/semver.js";
export { retryNetworkOnce } from "./core/decorators.js";

export type {
  ApiEnvelope,
  ProductRelease,
  ProductResult,
  ReleaseLatest,
} from "./providers/eol.js";
export {
  fetchProduct,
  normalizeProductId,
  parseGo,
  parseLatestAndLts,
  parseWindows,
  productSlugFromUrl,
} from "./providers/eol.js";

export {
  WAKATIME_KNOWN_PLUGINS,
  fetchGithubReleaseReport,
  githubApiUrl,
  parseWakatimeGithubRef,
} from "./providers/wakatime.js";
export { fetchVscodeMarketplaceReport } from "./providers/mpx.js";
export { fetchAntigravityReport, isAntigravitySlug } from "./providers/ag.js";
export { fetchCursorReport, isCursorSlug } from "./providers/cursor.js";
export { fetchVscodeAppReport, isVscodeAppSlug } from "./providers/vscode-app.js";

export {
  DEFAULT_USER_AGENT,
  HttpError,
  httpFetch,
  type HttpFetchOptions,
} from "./http/fetch.js";

export {
  getVersionReport,
  getVersionsForEndOfLifePage,
  Versions,
} from "./router.js";

export { SYNC_TARGETS, type SyncTarget } from "./catalog.js";
export {
  pickReleaseLabel,
  runSync,
  type SyncMeta,
  type SyncMetaResult,
} from "./sync.js";
