import type { VersionEntry, VersionReport } from "../core/types.js";
import { httpFetch } from "../http/fetch.js";

const GALLERY =
  "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.1-preview.1";
const FLAGS_ALL_VERSIONS = 103;

function hdrs(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json;api-version=7.1-preview.1",
  };
}

interface GalleryVersion {
  version: string;
  properties?: Array<{ key: string; value: string }>;
}

interface GalleryExtension {
  publisher: { publisherName: string };
  extensionName: string;
  versions: GalleryVersion[];
}

interface GalleryResponse {
  results: Array<{ extensions: GalleryExtension[] }>;
}

function isPreReleaseVersion(v: GalleryVersion): boolean {
  const s = v.version;
  if (/(?:beta|alpha|rc|pre)/i.test(s)) return true;
  const prop = v.properties?.find(
    (p) => p.key === "Microsoft.VisualStudio.Code.PreRelease",
  );
  return prop?.value === "true";
}

function cmp(a: string, b: string): number {
  const pa = a.split(/[.+]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.+]/).map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export async function fetchVscodeMarketplaceReport(itemName: string): Promise<VersionReport> {
  const res = await httpFetch(GALLERY, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({
      filters: [
        {
          criteria: [{ filterType: 7, value: itemName }],
          pageNumber: 1,
          pageSize: 1,
        },
      ],
      flags: FLAGS_ALL_VERSIONS,
    }),
  });
  const data = (await res.json()) as GalleryResponse;
  const ext = data.results?.[0]?.extensions?.[0];
  if (!ext?.versions?.length) {
    return {
      product: itemName,
      latest: null,
      lts: [],
      beta: null,
    };
  }

  const publisher = ext.publisher?.publisherName ?? itemName.split(".")[0];
  const extId = ext.extensionName ?? itemName.split(".").slice(1).join(".");
  const pageUrl = `https://marketplace.visualstudio.com/items?itemName=${encodeURIComponent(
    `${publisher}.${extId}`,
  )}`;

  const versions = [...ext.versions];
  versions.sort((a, b) => cmp(b.version, a.version));

  const stable = versions.filter((v) => !isPreReleaseVersion(v));
  const pre = versions.filter((v) => isPreReleaseVersion(v));

  const latestV = stable[0] ?? versions[0];
  const latest: VersionEntry | null = latestV
    ? {
        series: latestV.version.split(/[-+]/)[0] ?? latestV.version,
        version: latestV.version,
        link: pageUrl,
      }
    : null;

  let beta: VersionEntry | null = null;
  if (latestV && pre.length) {
    const topPre = pre.sort((a, b) => cmp(b.version, a.version))[0];
    if (topPre && cmp(topPre.version, latestV.version) > 0) {
      beta = {
        series: topPre.version.split(/[-+]/)[0] ?? topPre.version,
        version: topPre.version,
        link: pageUrl,
      };
    }
  }

  return {
    product: itemName,
    latest,
    lts: [],
    beta,
  };
}
