// Stan appki (2026-11-14, plan "appka ma sobie poradzić sama") — jedno miejsce, które
// mówi, czy wszystko działa i co zrobić. Czysta funkcja (testy __tests__/appHealth.test.ts),
// dane zbiera app/settings.tsx, widok components/settings/AppHealthSheet.tsx.
export type HealthLevel = 'ok' | 'warn' | 'bad';
export interface HealthRow { key: string; label: string; level: HealthLevel; detail: string; fix?: string }

export interface HealthInput {
  sync: { state: 'off' | 'connecting' | 'ok' | 'error'; lastAt: number | null; error: string | null };
  cloudBackup: { auto: boolean; lastAt: string | null };
  fileBackup: { dir: string | null; lastAt: string | null };
  errorTimes: number[];          // ms wpisów z dziennika błędów
  update: { otaReady: boolean; apkBuild: number | null; lastError: string | null };
  bankPending: number;
  web: boolean;
  // Strażnik (2026-11-25, user: "samowystarczalna na długo") — opcjonalne, żeby stare wywołania działały:
  bank?: { enabled: boolean; times: number[] };          // kiedy appka złapała powiadomienia z banku (ms)
  background?: { interval: number; lastRun: number };     // Android: odświeżanie w tle (min, 0 = wył.)
  storage?: { total: number; biggest: { key: string; size: number }[] }; // znaki w pamięci appki
}

/** Typowy odstęp między płatnościami z banku (mediana, dni) — z ostatnich 30 wpisów. */
export function usualGapDays(times: number[]): number | null {
  const t = [...times].sort((a, b) => a - b).slice(-31);
  if (t.length < 6) return null;
  const gaps = t.slice(1).map((x, i) => (x - t[i]) / DAY).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

const fmtSize = (chars: number) => chars >= 1_000_000 ? `${(chars / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(chars / 1000))} kB`;
const KEY_LABEL: Record<string, string> = {
  'notes-v1': 'notatki', 'expenses-store-v1': 'wydatki', 'screen-time-v1': 'czas z telefonem', 'device-battery-v1': 'baterie',
  'calendar-store-v1': 'kalendarz', 'collection-v1': 'zdrowie', 'bank-queue-v1': 'bank', 'mood-store-v1': 'humor',
};

const DAY = 86_400_000;
const ago = (ms: number) => {
  const d = Math.floor(ms / DAY);
  if (d >= 1) return d === 1 ? 'wczoraj' : `${d} dni temu`;
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h} h temu` : 'przed chwilą';
};

export function appHealth(i: HealthInput, now: number = Date.now()): HealthRow[] {
  const rows: HealthRow[] = [];

  const s = i.sync;
  rows.push(s.state === 'ok'
    ? { key: 'sync', label: 'Synchronizacja', level: 'ok', detail: s.lastAt ? `działa · ${ago(now - s.lastAt)}` : 'działa' }
    : s.state === 'connecting' ? { key: 'sync', label: 'Synchronizacja', level: 'warn', detail: 'łączę…' }
    : s.state === 'error' ? { key: 'sync', label: 'Synchronizacja', level: 'bad', detail: `błąd: ${(s.error ?? '').slice(0, 80)}`, fix: 'sprawdź internet; szczegóły w Dzienniku błędów' }
    : { key: 'sync', label: 'Synchronizacja', level: 'warn', detail: 'wyłączona', fix: 'zaloguj się kontem Google' });

  const cb = i.cloudBackup;
  const cbAge = cb.lastAt ? now - Date.parse(cb.lastAt) : null;
  rows.push(cbAge == null
    ? { key: 'cloud', label: 'Kopia w chmurze', level: 'bad', detail: 'jeszcze nie było', fix: 'Dane → Zrób kopię teraz' }
    : { key: 'cloud', label: 'Kopia w chmurze', level: !cb.auto || cbAge > 2 * DAY ? 'warn' : 'ok',
        detail: `${ago(cbAge)}${cb.auto ? '' : ' · automat wyłączony'}`, fix: !cb.auto ? 'włącz automat w Dane' : cbAge > 2 * DAY ? 'Dane → Zrób kopię teraz' : undefined });

  if (!i.web) {
    const fb = i.fileBackup;
    const fbAge = fb.lastAt ? now - Date.parse(fb.lastAt) : null;
    rows.push(!fb.dir
      ? { key: 'file', label: 'Kopia do pliku', level: 'warn', detail: 'nie ustawiona', fix: 'Dane → Kopia do pliku (raz wybierz folder)' }
      : { key: 'file', label: 'Kopia do pliku', level: fbAge != null && fbAge > 10 * DAY ? 'warn' : 'ok', detail: fbAge != null ? ago(fbAge) : 'folder wybrany' });
  }

  const errs = i.errorTimes.filter((t) => now - t < DAY).length;
  rows.push({ key: 'errors', label: 'Błędy (24 h)', level: errs === 0 ? 'ok' : errs < 5 ? 'warn' : 'bad',
    detail: errs === 0 ? 'brak' : `${errs}`, fix: errs ? 'Diagnostyka → Dziennik błędów → Kopiuj' : undefined });

  const u = i.update;
  rows.push(u.otaReady ? { key: 'update', label: 'Aktualizacja', level: 'warn', detail: 'pobrana', fix: 'uruchom appkę ponownie' }
    : u.apkBuild ? { key: 'update', label: 'Aktualizacja', level: 'warn', detail: `nowy APK #${u.apkBuild}`, fix: 'Diagnostyka → Sprawdź aktualizacje' }
    : u.lastError ? { key: 'update', label: 'Aktualizacja', level: 'warn', detail: 'nie udało się sprawdzić' }
    : { key: 'update', label: 'Aktualizacja', level: 'ok', detail: 'aktualna' });

  // Bank: dawno nic nie złapał (zmiana formatu powiadomień po aktualizacji appki banku, cofnięta zgoda).
  if (i.bank?.enabled && !i.web) {
    const last = i.bank.times.length ? Math.max(...i.bank.times) : null;
    const gap = usualGapDays(i.bank.times);
    const limit = Math.max(4, gap != null ? gap * 4 : 4) * DAY;
    rows.push(last == null
      ? { key: 'bankCapture', label: 'Bank łapie płatności', level: 'ok', detail: 'czekam na pierwszą' }
      : now - last > limit
        ? { key: 'bankCapture', label: 'Bank łapie płatności', level: 'warn', detail: `nic od ${ago(now - last).replace(' temu', '')}`, fix: 'Ustawienia → Bank → Test; sprawdź dostęp do powiadomień' }
        : { key: 'bankCapture', label: 'Bank łapie płatności', level: 'ok', detail: `ostatnio ${ago(now - last)}` });
  }

  // Odświeżanie w tle (Android): system potrafi je ubić (oszczędzanie baterii).
  if (i.background && !i.web && i.background.interval > 0) {
    const b = i.background;
    const late = b.lastRun ? now - b.lastRun : null;
    const limit = Math.max(DAY, b.interval * 60_000 * 8);
    rows.push(late == null
      ? { key: 'background', label: 'Odświeżanie w tle', level: 'ok', detail: 'jeszcze nie było' }
      : late > limit
        ? { key: 'background', label: 'Odświeżanie w tle', level: 'warn', detail: `stoi od ${ago(late).replace(' temu', '')}`, fix: 'Ustawienia Androida → Bateria → Sapp: bez ograniczeń' }
        : { key: 'background', label: 'Odświeżanie w tle', level: 'ok', detail: ago(late) });
  }

  // Pamięć: komputer (przeglądarka) ma ~5 MB na stronę; telefon po nowym APK 512 MB.
  if (i.storage) {
    const st = i.storage;
    const [warn, bad] = i.web ? [3_500_000, 4_500_000] : [300_000_000, 450_000_000];
    const top = st.biggest[0];
    const detail = `${fmtSize(st.total)}${top ? ` · najwięcej: ${KEY_LABEL[top.key] ?? top.key} ${fmtSize(top.size)}` : ''}`;
    rows.push({ key: 'storage', label: 'Miejsce na dane', level: st.total > bad ? 'bad' : st.total > warn ? 'warn' : 'ok', detail,
      fix: st.total > warn ? 'usuń stare rysunki albo zrób kopię i wyczyść stare dane' : undefined });
  }

  if (i.bankPending > 0) rows.push({ key: 'bank', label: 'Płatności z banku', level: 'warn', detail: `${i.bankPending} czeka`, fix: 'Finanse → Płatności do zatwierdzenia' });

  return rows;
}

export function healthSummary(rows: HealthRow[]): string {
  const bad = rows.filter((r) => r.level === 'bad').length;
  const warn = rows.filter((r) => r.level === 'warn').length;
  if (!bad && !warn) return 'wszystko działa';
  return [bad ? `${bad} do naprawy` : '', warn ? `${warn} do uwagi` : ''].filter(Boolean).join(' · ');
}
