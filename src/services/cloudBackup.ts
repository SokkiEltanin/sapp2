import AsyncStorage from '@react-native-async-storage/async-storage';
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

async function collectEntries(): Promise<Record<string, string>> {
  const keys = (await AsyncStorage.getAllKeys()).filter(shouldBackupKey);
  const pairs = await AsyncStorage.multiGet(keys);
  const out: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) out[k] = v;
  return out;
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

export function uploadBackup(): Promise<BackupMeta> {
  // Ręczny przycisk + automat w tym samym momencie → jedna kopia, nie dwie.
  if (inFlight) return inFlight;
  inFlight = doUpload().finally(() => { inFlight = null; });
  return inFlight;
}

async function doUpload(): Promise<BackupMeta> {
  const entries = await collectEntries();
  const json = JSON.stringify({ version: 1, entries });
  const chunks = chunkString(json);
  const backupId = Date.now().toString(36);

  const prevSnap = await withTimeout(getDoc(userDoc(COL, 'meta')));
  const prev = prevSnap.exists() ? (prevSnap.data() as BackupMeta) : null;

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
    for (let i = 0; i < prev.chunkCount; i++) {
      await deleteDoc(userDoc(COL, `${prev.backupId}_${i}`)).catch(() => {});
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
  await uploadBackup().catch(() => {});
}

// Nadpisuje lokalne dane kopią z chmury. Przed tym zapisuje BIEŻĄCE dane do
// pliku w pamięci appki — pomyłkowe przywrócenie starszej kopii nie gubi
// nowszych danych bez śladu. Klucze, których kopia nie ma, zostają nietknięte.
// Po zapisie store'y przeładowują się z AsyncStorage (`persist.rehydrate`) —
// bez restartu appki.
export async function restoreBackup(): Promise<BackupMeta> {
  const meta = await fetchBackupMeta();
  if (!meta) throw new Error('Brak kopii w chmurze.');
  const parts: string[] = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const snap = await withTimeout(getDoc(userDoc(COL, `${meta.backupId}_${i}`)), 30000);
    if (!snap.exists()) throw new Error('Kopia niekompletna (brak części) — nic nie zmieniono.');
    parts.push((snap.data() as { data: string }).data);
  }
  const parsed = JSON.parse(parts.join('')) as { version: number; entries: Record<string, string> };
  if (!parsed?.entries || typeof parsed.entries !== 'object') throw new Error('Nieprawidłowa kopia — nic nie zmieniono.');

  const current = await collectEntries();
  await FileSystem.writeAsStringAsync(PRE_RESTORE_FILE, JSON.stringify({ version: 1, entries: current })).catch(() => {});

  const pairs = Object.entries(parsed.entries).filter(([k]) => shouldBackupKey(k));
  await AsyncStorage.multiSet(pairs);
  await Promise.all([
    useExpensesStore, useMoodStore, useCalendarStore, useHabitsStore, useHealthStore,
    useBankQueue, useCountdownStore, useSubscriptionsStore, useVehiclesStore, useWorkStore,
  ].map((store) => store.persist.rehydrate()));
  return meta;
}
