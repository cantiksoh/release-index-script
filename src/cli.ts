import path from "node:path";
import { fileURLToPath } from "node:url";

import { getVersionReport } from "./router.js";

export async function runCli(): Promise<void> {
  const arg = process.argv[2] ?? "linux";
  const out = await getVersionReport(arg);
  console.log(JSON.stringify(out, null, 2));
}

function isEntryThisFile(): boolean {
  return Boolean(
    process.argv[1] &&
      path.normalize(path.resolve(process.argv[1])) ===
        path.normalize(fileURLToPath(import.meta.url)),
  );
}

if (isEntryThisFile()) {
  runCli().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
