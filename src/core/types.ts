export interface VersionEntry {
  series: string;
  version: string;
  link: string | null;
  eol?: string | null;
  maintained?: boolean;
  buildId?: string;
}

export interface WindowsFamilies {
  win7: VersionEntry | null;
  win10: VersionEntry | null;
  win11: VersionEntry | null;
}

export interface VersionReport {
  product: string;
  latest: VersionEntry | null;
  lts: VersionEntry[];
  beta: VersionEntry | null;
  supported?: VersionEntry[];
  windows?: WindowsFamilies;
}
