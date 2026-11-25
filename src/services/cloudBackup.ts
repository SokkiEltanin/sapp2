import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from '@/services/errorLog';
import { readLogical, writeLogical } from '@/services/safeStorage';
import * as FileSystem from 'expo-file-system/legacy';
import { getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { withTimeout } from '@/firebase';
import { userDoc } from '@/utils/userData';
import {
  shouldBackupKey, chunkString, summarizeSnapshot, isBackupDue,
  BACKUP_KEY_PREFIX, type BackupSummary,
} from '@/utils/backupSnapshot';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useHabitsStore } from '@/store/habitsStore';
import { useHealthStore } from '@/store/healthStore';
import { useBankQueue } from '@/store/bankQueueStore';
import { useCountdownStore } from '@/store/countdownStore';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useWorkStore } from '@/store/workStore';
import { useReplacementsStore } from '@/store/replacementsStore';
import { useBalanceStore } from '@/store/balanceStore';
import { useBudgetsStore } from '@/store/budgetsStore';
import { useNotesStore } from '@/store/notesStore';
import { useCategoriesStore } from '@/store/categoriesStore';
import { useCategoryRulesStore } from '@/store/categoryRulesStore';
import { useThresholdsStore } from '@/store/thresholdsStore';
import { useDashboardLayoutStore } from '@/store/dashboardLayoutStore';
import { useWidgetSettingsStore } from '@/store/widgetSettingsStore';
import { useFactsStore } from '@/store/factsStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useProfileStore } from '@/store/profileStore';

// Kopia zapasowa w chmurze (2026-11-11) — patrz utils/backupSnapshot.ts po
// "dlaczego". Firestore, ta sama ścieżka per-user co calendarService
// (`users/{uid}/...`): `backup/meta` + `backup/<backupId>_<i>` (kawałki JSON-a).
// Nowe kawałki zapisywane POD NOWYM id, potem meta przełączana, dopiero potem
// stare kawałki kasowane — przerwany upload nigdy nie zostawia meta wskazującej
// na niekompletną kopię.
const COL = 'backup';
const LAST_AT_KEY = `${BACKUP_KEY_PREFIX}last_at`;
const AUTO_KEY = `${BACKUP_KEY_PREFIX}auto`;
const AUTO_EVERY_HOURS = 6;
const PRE_RESTORE_FILE = `${FileSystem.documentDirectory ?? ''}sapp2-przed-przywroceniem.json`;

export interface BackupMeta {
  backupId: string;
  chunkCount: number;
  createdAt: string;
  chars: number;
  summary: BackupSummary;
}

// Pełne wartości (duże store'y w kawałkach — services/safeStorage.ts, 2026-11-25): kopia
// zawiera sklejone dane, a nie znaczniki kawałków; przywracanie dzieli je z powrotem.
export async function collectEntries(): Promise<Record<string, string>> {
  return readLogical(shouldBackupKey);
}

export async function getLastBackupAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_AT_KEY);
}

export async function isAutoBackupEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(AUTO_KEY)) !== '0';
}

export async function setAutoBackupEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_KEY, on ? '1' : '0');
}

let inFlight: Promise<BackupMeta> | null = null;

export function uploadBackup(auto = false): Promise<BackupMeta> {
  // Ręczny przycisk + automat w tym samym momencie → jedna kopia, nie dwie.
  if (inFlight) return inFlight;
  inFlight = doUpload(auto).finally(() => { inFlight = null; });
  return inFlight;
}

// Dwie wersje w chmurze (2026-11-25, "samowystarczalna na długo"): `meta` = najnowsza, `meta_prev` =
// poprzednia; usuwana jest dopiero ta sprzed dwóch. Automat NIE nadpisuje, gdy dane nagle skurczyły
// się o ponad połowę (np. coś się nie wczytało) — wtedy błąd w dzienniku, dobra kopia zostaje.
async function doUpload(auto: boolean): Promise<BackupMeta> {
  const entries = await collectEntries();
  const json = JSON.stringify({ version: 1, entries });
  const chunks = chunkString(json);
  const backupId = Date.now().toString(36);

  const prevSnap = await withTimeout(getDoc(userDoc(COL, 'meta')));
  const prev = prevSnap.exists() ? (prevSnap.data() as BackupMeta) : null;
  if (auto && prev && prev.chars > 50_000 && json.length < prev.chars * 0.5) {
    throw new Error(`Kopia wstrzymana: dane mają ${Math.round(json.length / 1000)} kB, poprzednia kopia ${Math.round(prev.chars / 1000)} kB — sprawdź, czy wszystko się wczytało`);
  }
  const olderSnap = await withTimeout(getDoc(userDoc(COL, 'meta_prev')));
  const older = olderSnap.exists() ? (olderSnap.data() as BackupMeta) : null;

  for (let i = 0; i < chunks.length; i++) {
    await withTimeout(setDoc(userDoc(COL, `${backupId}_${i}`), { data: chunks[i] }), 30000);
  }
  const meta: BackupMeta = {
    backupId, chunkCount: chunks.length, createdAt: new Date().toISOString(),
    chars: json.length, summary: summarizeSnapshot(entries),
  };
  await withTimeout(setDoc(userDoc(COL, 'meta'), meta));
  await AsyncStorage.setItem(LAST_AT_KEY, meta.createdAt);

  if (prev && prev.backupId !== backupId) {
    await withTimeout(setDoc(userDoc(COL, 'meta_prev'), prev)).catch(() => {});
    if (older && older.backupId !== prev.backupId) {
      for (let i = 0; i < older.chunkCount; i++) {
        await deleteDoc(userDoc(COL, `${older.backupId}_${i}`)).catch(() => {});
      }
    }
  }
  return meta;
}

export async function fetchBackupMeta(): Promise<BackupMeta | null> {
  const snap = await withTimeout(getDoc(userDoc(COL, 'meta')));
  return snap.exists() ? (snap.data() as BackupMeta) : null;
}

// Automat: przy starcie i przy zejściu appki w tło, jeśli od ostatniej kopii
// minęło ≥6h i user nie wyłączył. Cicho — błąd (brak sieci) = spróbuje
// następnym razem.
export async function autoBackupIfDue(): Promise<void> {
  if (!(await isAutoBackupEnabled())) return;
  if (!isBackupDue(await getLastBackupAt(), new Date(), AUTO_EVERY_HOURS)) return;
  await uploadBackup(true).catch((e) => { if (String(e?.message ?? '').startsWith('Kopia wstrzymana')) logError('kopia w chmurze', e); });
  await verifyBackupIfDue().catch((e) => logError('sprawdzenie kopii', e));
}

// Nadpisuje lokalne dane kopią z chmury. Przed tym zapisuje BIEŻĄCE dane do
// pliku w pamięci appki — pomyłkowe przywrócenie starszej kopii nie gubi
// nowszych danych bez śladu. Klucze, których kopia nie ma, zostają nietknięte.
// Po zapisie store'y przeładowują się z AsyncStorage (`persist.rehydrate`) —
// bez restartu appki.
async function downloadEntries(meta: BackupMeta): Promise<Record<string, string>> {
  const parts: string[] = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const snap = await withTimeout(getDoc(userDoc(COL, `${meta.backupId}_${i}`)), 30000);
    if (!snap.exists()) throw new Error('Kopia niekompletna (brak części) — nic nie zmieniono.');
    parts.push((snap.data() as { data: string }).data);
  }
  const parsed = JSON.parse(parts.join('')) as { version: number; entries: Record<string, string> };
  if (!parsed?.entries || typeof parsed.entries !== 'object') throw new Error('Nieprawidłowa kopia — nic nie zmieniono.');
  return parsed.entries;
}

// Raz w miesiącu próbne pobranie najnowszej kopii (czy da się ją odczytać w całości) — błąd
// trafia do Dziennika błędów i Stanu appki.
const VERIFY_KEY = `${BACKUP_KEY_PREFIX}verified_at`;
async function verifyBackupIfDue(): Promise<void> {
  if (!isBackupDue(await AsyncStorage.getItem(VERIFY_KEY), new Date(), 30 * 24)) return;
  const meta = await fetchBackupMeta();
  if (!meta) return;
  const entries = await downloadEntries(meta);
  if (!Object.keys(entries).length) throw new Error('Najnowsza kopia jest pusta');
  await AsyncStorage.setItem(VERIFY_KEY, new Date().toISOString());
}

export async function restoreBackup(): Promise<BackupMeta> {
  const latest = await fetchBackupMeta();
  if (!latest) throw new Error('Brak kopii w chmurze.');
  // Najnowsza uszkodzona → poprzednia wersja.
  let meta = latest;
  let entries: Record<string, string>;
  try {
    entries = await downloadEntries(latest);
  } catch (e) {
    const prevSnap = await withTimeout(getDoc(userDoc(COL, 'meta_prev')));
    if (!prevSnap.exists()) throw e;
    meta = prevSnap.data() as BackupMeta;
    entries = await downloadEntries(meta);
  }
  const parsed = { entries };

  await applyEntries(parsed.entries);
  return meta;
}

// Wspólne dla chmury i pliku: zapis bieżących danych "na wszelki wypadek",
// nadpisanie kluczy z kopii (reszta nietknięta), przeładowanie store'ów.
export async function applyEntries(entries: Record<string, string>): Promise<void> {
  const current = await collectEntries();
  if (FileSystem.documentDirectory) {
    await FileSystem.writeAsStringAsync(PRE_RESTORE_FILE, JSON.stringify({ version: 1, entries: current })).catch(() => {});
  }
  const pairs = Object.entries(entries).filter(([k]) => shouldBackupKey(k));
  await writeLogical(pairs);
  await Promise.all([
    useExpensesStore, useMoodStore, useCalendarStore, useHabitsStore, useHealthStore,
    useBankQueue, useCountdownStore, useSubscriptionsStore, useVehiclesStore, useWorkStore,
    useReplacementsStore, useBalanceStore, useBudgetsStore, useNotesStore, useCategoriesStore,
    useWidgetSettingsStore, useCategoryRulesStore, useThresholdsStore, useDashboardLayoutStore, useFactsStore, useCollectionStore, useProfileStore,
  ].map((store) => store.persist.rehydrate()));
}
