import * as FileSystem from 'expo-file-system/legacy';
import { ingestBankNotification } from './bankIngest';
import { useBankQueue } from '@/store/bankQueueStore';

// Port z sapp 1:1. Natywny `NotificationListenerService`
// (plugins/withBankNotificationListener.js) dopisuje przechwycone powiadomienia z banku
// do tego pliku w `filesDir` appki — czyli dokładnie tam gdzie expo-file-system's
// `documentDirectory`. Osuszamy go przy każdym wejściu appki na pierwszy plan: czytamy
// wszystko, czyścimy, i przepuszczamy przez normalny pipeline ingest → kolejka →
// auto-akceptacja.
const FILE = `${FileSystem.documentDirectory ?? ''}bank_notifications.json`;

let _running = false;

export async function drainBankNotifications(): Promise<number> {
  if (_running || !FileSystem.documentDirectory) return 0;
  // Funkcja wyłączona → NIE dotykaj pliku. Natywny nasłuch dalej dopisuje cały dzień
  // powiadomień; gdy user włączy funkcję, backlog zostanie przetworzony zamiast
  // cicho odrzucony.
  if (!useBankQueue.getState().enabled) return 0;
  _running = true;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return 0;
    const raw = await FileSystem.readAsStringAsync(FILE);
    // Czyścimy od razu, żeby nie przetworzyć drugi raz (ingest i tak dodatkowo dedupuje).
    await FileSystem.writeAsStringAsync(FILE, '[]').catch(() => {});
    let arr: any[] = [];
    try { arr = JSON.parse(raw); } catch { return 0; }
    if (!Array.isArray(arr)) return 0;
    let n = 0;
    for (const it of arr) {
      try {
        // `pkg:postTime` — Android's `n.postTime`, stabilne między wielokrotnymi
        // dostawami TEGO SAMEGO eventu (SappNotificationListener.kt's `append()`),
        // w przeciwieństwie do naszego własnego czasu ingestu — patrz długi komentarz
        // przy `bankQueueStore.seenNotifications`.
        const notifKey = it?.pkg && it?.time ? `${it.pkg}:${it.time}` : undefined;
        if (await ingestBankNotification(String(it?.title ?? ''), String(it?.text ?? ''), notifKey)) n++;
      } catch {}
    }
    return n;
  } catch {
    return 0;
  } finally {
    _running = false;
  }
}

const SEEN = `${FileSystem.documentDirectory ?? ''}seen_packages.json`;

// Diagnostyka: podgląd surowego pliku przechwytu BEZ czyszczenia go, żeby user mógł
// sprawdzić czy natywny nasłuch w ogóle coś łapie (pusty plik = powiadomienia nigdy nie
// docierają do appki → problem z uprawnieniem/OEM; niepusty ale nic w kolejce = problem
// po stronie JS/parsera). `seen` wylicza każdy pakiet, z którego nasłuch odebrał
// powiadomienie — pusty = usługa w ogóle nie jest podpięta/uruchomiona.
export async function peekBankCapture(): Promise<{ count: number; samples: string[]; fileExists: boolean; seen: string[] }> {
  let seen: string[] = [];
  try {
    const si = await FileSystem.getInfoAsync(SEEN);
    if (si.exists) { const s = JSON.parse(await FileSystem.readAsStringAsync(SEEN)); if (Array.isArray(s)) seen = s.map(String); }
  } catch {}
  try {
    if (!FileSystem.documentDirectory) return { count: 0, samples: [], fileExists: false, seen };
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return { count: 0, samples: [], fileExists: false, seen };
    const raw = await FileSystem.readAsStringAsync(FILE);
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return { count: 0, samples: [], fileExists: true, seen };
    const samples = arr.slice(-3).map((it: any) => `${it?.title ?? ''} ${it?.text ?? ''}`.trim().slice(0, 90));
    return { count: arr.length, samples, fileExists: true, seen };
  } catch {
    return { count: 0, samples: [], fileExists: false, seen };
  }
}
