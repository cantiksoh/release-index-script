import { diskCacheConfigFromEnv, diskCacheGet, diskCachePut } from "./disk-cache.js";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, init: { status: number; url: string }) {
    super(message);
    this.name = "HttpError";
    this.status = init.status;
    this.url = init.url;
  }
}

export interface HttpFetchOptions extends RequestInit {
  mergeDefaults?: boolean;
  timeoutMs?: number;
  throwOnError?: boolean;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname + u.search;
    const path = p.length > 72 ? `${p.slice(0, 69)}…` : p;
    return `${u.hostname}${path}`;
  } catch {
    return url.length > 72 ? `${url.slice(0, 69)}…` : url;
  }
}

function mergeHeaders(mergeDefaults: boolean, init?: HeadersInit): Headers {
  const h = new Headers();
  if (mergeDefaults) {
    h.set("User-Agent", DEFAULT_USER_AGENT);
    h.set("Accept-Language", "en-US,en;q=0.9");
  }
  if (init) new Headers(init).forEach((v, k) => h.set(k, v));
  return h;
}

function combineSignal(
  timeoutMs: number | undefined,
  user: AbortSignal | null | undefined,
): AbortSignal | undefined {
  const u = user ?? undefined;
  if (timeoutMs != null && u) {
    return AbortSignal.any([AbortSignal.timeout(timeoutMs), u]);
  }
  if (timeoutMs != null) return AbortSignal.timeout(timeoutMs);
  return u;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const MAX_HTTP_RETRIES = 4;

/** Retries on 429 using Retry-After when present (low memory: no buffering). */
async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  href: string,
): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < MAX_HTTP_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(input, init);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`${shortUrl(href)} · ${msg}`);
    }
    last = res;
    if (res.status === 429 && attempt < MAX_HTTP_RETRIES - 1) {
      const ra = res.headers.get("retry-after");
      let waitMs = 2000 * (attempt + 1);
      if (ra) {
        const sec = parseInt(ra, 10);
        if (Number.isFinite(sec)) waitMs = Math.min(sec * 1000, 120_000);
      }
      await sleep(waitMs);
      continue;
    }
    return res;
  }
  return last!;
}

export async function httpFetch(
  input: string | URL,
  init?: HttpFetchOptions,
): Promise<Response> {
  const href = typeof input === "string" ? input : input.href;
  const {
    mergeDefaults = true,
    timeoutMs,
    throwOnError = true,
    ...rest
  } = init ?? {};

  const method = (rest.method ?? "GET").toUpperCase();
  const cacheCfg = method === "GET" ? diskCacheConfigFromEnv() : null;

  if (cacheCfg) {
    const hit = await diskCacheGet(cacheCfg, href);
    if (hit) return hit;
  }

  const headers = mergeHeaders(mergeDefaults, rest.headers);
  const signal = combineSignal(timeoutMs, rest.signal);
  const fetchInit: RequestInit = { ...rest, headers, signal };

  const res = await fetchWithRetry(input, fetchInit, href);

  if (throwOnError && !res.ok) {
    throw new HttpError(`${res.status} ${res.statusText} · ${shortUrl(href)}`, {
      status: res.status,
      url: href,
    });
  }

  if (cacheCfg && method === "GET" && res.ok) {
    const text = await res.text();
    const ct = res.headers.get("content-type");
    await diskCachePut(cacheCfg, href, res.status, text, ct);
    return new Response(text, { status: res.status, headers: res.headers });
  }

  return res;
}
