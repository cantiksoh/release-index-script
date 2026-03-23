import { WAKATIME_KNOWN_PLUGINS } from "./providers/wakatime.js";

/** Maps each fetch slug → path under the published `versions/` root. */

export interface SyncTarget {
  slug: string;
  file: string;
}

/** Channel folder before `version.json` (stable / latest / beta / lts later if we split). */
const wakatimePlugin = (repo: string): SyncTarget => ({
  slug: repo,
  file: `plugins/wakatime/${repo}/latest/version.json`,
});

export const SYNC_TARGETS: SyncTarget[] = [
  { slug: "vscode", file: "ide/vscode/stable/version.json" },
  { slug: "cursor", file: "ide/cursor/latest/version.json" },
  { slug: "antigravity", file: "ide/antigravity/latest/version.json" },

  ...WAKATIME_KNOWN_PLUGINS.map((repo) => wakatimePlugin(repo)),

  { slug: "linux", file: "platforms/linux/latest/version.json" },
  { slug: "windows", file: "platforms/windows/latest/version.json" },
  { slug: "ubuntu", file: "platforms/ubuntu/latest/version.json" },

  { slug: "go", file: "runtimes/go/latest/version.json" },
  { slug: "nodejs", file: "runtimes/nodejs/latest/version.json" },
  { slug: "python", file: "runtimes/python/latest/version.json" },
  { slug: "ruby", file: "runtimes/ruby/latest/version.json" },
  { slug: "php", file: "runtimes/php/latest/version.json" },
  { slug: "dotnet", file: "runtimes/dotnet/latest/version.json" },
  { slug: "eclipse-temurin", file: "runtimes/eclipse-temurin/latest/version.json" },

  { slug: "docker", file: "tools/docker/latest/version.json" },
  { slug: "kubernetes", file: "tools/kubernetes/latest/version.json" },
  { slug: "openssl", file: "tools/openssl/latest/version.json" },
  { slug: "postgresql", file: "tools/postgresql/latest/version.json" },
  { slug: "nginx", file: "tools/nginx/latest/version.json" },
];
