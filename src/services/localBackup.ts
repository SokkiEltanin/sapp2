import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { collectEntries } from '@/services/cloudBackup';
import {
  BACKUP_KEY_PREFIX, LOCAL_BACKUP_EVERY_DAYS, backupFileName, buildBackupFile, parseBackupFile,
  filesToPrune, isBackupDue, summarizeSnapshot, type BackupSummary,
} from '@/utils/backupSnapshot';

// Kopia do pliku (2026-11-14, plan: "appka ma sobie poradzić sama"). Niezależna od
// konta Google/Firestore — plik JSON w folderze wybranym przez usera (systemowy
// wybór folderu = Storage Access Framework, bez uprawnień w app.json). Folder
// zapamiętany → co 7 dni automatyczna kopia, zostają 4 najnowsze. Web: pobranie
// pliku. Wczytanie: wybór pliku → podsumowanie → potwierdzenie → applyEntries.
// Klucze z prefiksem BACKUP_KEY_PREFIX nie wchodzą do kopii (per urządzenie).
const DIR_KEY = `${BACKUP_KEY_PREFIX}local_dir`;
const LAST_KEY = `${BACKUP_KEY_PREFIX}local_last_at`;
const SAF = FileSystem.StorageAccessFramework;

export async function getLocalBackupInfo(): Promise<{ dir: string | null; lastAt: string | null }> {
  const [dir, lastAt] = await Promise.all([AsyncStorage.getItem(DIR_KEY), AsyncStorage.getItem(LAST_KEY)]);
  return { dir, lastAt };
}

/** Czytelna nazwa folderu z URI SAF (`…tree/primary%3ADownload%2Fsapp2` → `Download/sapp2`). */
export function folderLabel(uri: string | null): string | null {
  if (!uri) return null;
  const m = /tree\/([^/]+)/.exec(uri);
  const raw = decodeURIComponent(m ? m[1] : uri);
  return raw.replace(/^primary:/, '') || 'pamięć telefonu';
}

async function pickDir(): Promise<string | null> {
  const r = await SAF.requestDirectoryPermissionsAsync();
  if (!r.granted) return null;
  await AsyncStorage.setItem(DIR_KEY, r.directoryUri);
  return r.directoryUri;
}

async function writeTo(dir: string, name: string, json: string): Promise<void> {
  const uri = await SAF.createFileAsync(dir, name.replace(/\.json$/, ''), 'application/json');
  await SAF.writeAsStringAsync(uri, json);
}

/**
 * Zapis kopii. `chooseFolder` = pokaż wybór folderu (pierwszy raz albo "zmień folder").
 * Zwraca opis do pokazania albo null, gdy user anulował wybór.
 */
export async function exportBackupFile(chooseFolder = false): Promise<{ name: string; where: string; summary: BackupSummary } | null> {
  const entries = await collectEntries();
  const now = new Date();
  const name = backupFileName(now);
  const json = buildBackupFile(entries, now);
  const summary = summarizeSnapshot(entries);

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return { name, where: 'Pobrane', summary };
  }

  let dir = chooseFolder ? null : await AsyncStorage.getItem(DIR_KEY);
  if (!dir) dir = await pickDir();
  if (!dir) return null;
  try {
    await writeTo(dir, name, json);
  } catch {
    // Folder usunięty / zgoda cofnięta — wybierz ponownie raz.
    dir = await pickDir();
    if (!dir) return null;
    await writeTo(dir, name, json);
  }
  await AsyncStorage.setItem(LAST_KEY, now.toISOString());
  return { name, where: folderLabel(dir) ?? '', summary };
}

/** Co tydzień do zapamiętanego folderu; tylko gdy folder był kiedyś wybrany. Cicho. */
export async function autoLocalBackupIfDue(): Promise<void> {
  if (Platform.OS === 'web') return;
  const { dir, lastAt } = await getLocalBackupInfo();
  if (!dir || !isBackupDue(lastAt, new Date(), LOCAL_BACKUP_EVERY_DAYS * 24)) return;
  const entries = await collectEntries();
  const now = new Date();
  await writeTo(dir, backupFileName(now), buildBackupFile(entries, now));
  await AsyncStorage.setItem(LAST_KEY, now.toISOString());
  const uris = await SAF.readDirectoryAsync(dir);
  const byName = new Map(uris.map((u) => [decodeURIComponent(u).split('/').pop() ?? '', u]));
  for (const n of filesToPrune([...byName.keys()])) {
    const u = byName.get(n);
    if (u) await SAF.deleteAsync(u, { idempotent: true }).catch(() => {});
  }
}

export type PickedBackup = { name: string; createdAt: string | null; entries: Record<string, string>; summary: BackupSummary };

/** Wybór pliku kopii i odczyt (bez zapisu — zapis dopiero po potwierdzeniu, applyEntries). */
export async function pickBackupFile(): Promise<PickedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const text = asset.file ? await asset.file.text() : await FileSystem.readAsStringAsync(asset.uri);
  const { createdAt, entries } = parseBackupFile(text);
  return { name: asset.name || 'kopia.json', createdAt, entries, summary: summarizeSnapshot(entries) };
}
