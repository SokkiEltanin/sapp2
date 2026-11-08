import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Port z sapp (src/services/shareTextDrain.ts) 1:1 — ten sam plik-jako-most wzorzec co
// bankNotificationDrain.ts. Natywny `ShareReceiverActivity.kt`
// (plugins/withReceiptShareIntent.js) zapisuje udostępniony tekst (Android Share Sheet →
// "Udostępnij" na paragon/SMS/screenshot-OCR) tutaj i przekierowuje przez
// `sapp2://finances` deep link. W przeciwieństwie do sapp (osobny ekran `scan.tsx`,
// zawsze świeżo montowany) sapp2's `AddExpenseModal` żyje w `(tabs)/finances.tsx` —
// ten ekran MOŻE już być zamontowany (user był na innej zakładce), więc odczyt samego
// mount-u nie wystarcza; `useShareReceiptLaunch.ts` woła to też na `AppState` 'active'
// ORAZ na każdym evencie `Linking` 'url' (ten drugi łapie właśnie przypadek "appka już
// na pierwszym planie, inna zakładka").
const FILE = `${FileSystem.documentDirectory ?? ''}shared_receipt_text.json`;

export async function drainSharedReceiptText(): Promise<string | null> {
  if (Platform.OS !== 'android' || !FileSystem.documentDirectory) return null;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(FILE);
    await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => {});
    const obj = JSON.parse(raw);
    const text = typeof obj?.text === 'string' ? obj.text.trim() : '';
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
