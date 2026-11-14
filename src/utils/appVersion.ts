// Czyste porównanie wersji (bez modułów natywnych — testowalne). Używa
// services/appUpdate.ts.

export type ApkInfo = { build: number; url: string };

/** Numer builda z tagu release'u (`build-123` → 123). */
export function buildFromTag(tag: unknown): number | null {
  const m = typeof tag === 'string' ? /^build-(\d+)$/.exec(tag.trim()) : null;
  return m ? Number(m[1]) : null;
}

/** Czy release jest nowszy niż zainstalowany build. Dev (brak numeru) = nigdy. */
export function apkFromRelease(json: any, mine: number | null): ApkInfo | null {
  const build = buildFromTag(json?.tag_name);
  if (build == null || mine == null || build <= mine) return null;
  const asset = Array.isArray(json?.assets) ? json.assets.find((a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk')) : null;
  const url = asset?.browser_download_url || json?.html_url;
  return typeof url === 'string' ? { build, url } : null;
}
