import { rewriteDeepLink } from '@/utils/deepLink';

// Przepisanie linków z widgetów/powiadomień przed nawigacją (utils/deepLink.ts) —
// bez pustych ekranów-przekierowań w historii.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return rewriteDeepLink(path);
  } catch {
    return path;
  }
}
