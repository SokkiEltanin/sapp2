import { useEffect, useState } from 'react';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { syncBillReminders } from '@/services/billReminders';
import { useThresholdsStore } from '@/store/thresholdsStore';

// Synchronizuje przypomnienia o Stałych opłatach z listą subskrypcji
// (2026-11-11) — po wczytaniu store'u z AsyncStorage i przy każdej zmianie.
// Czekamy na hydrację: przed nią lista jest pusta, więc sync skasowałby
// wszystkie zaplanowane przypomnienia (i zaplanował je chwilę później od nowa).
// Przy każdym starcie appki dokłada też przypomnienie na KOLEJNY cykl, gdy
// poprzednie już się odpaliło.
export function useBillReminderSync() {
  const subscriptions = useSubscriptionsStore((st) => st.subscriptions);
  const [hydrated, setHydrated] = useState(() => useSubscriptionsStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    return useSubscriptionsStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  // Godzina przypomnień z Ustawień (progi) też przelicza plan.
  const reminderHour = useThresholdsStore((st) => st.t.reminderHour);
  useEffect(() => {
    if (!hydrated) return;
    syncBillReminders(subscriptions);
  }, [hydrated, subscriptions, reminderHour]);
}
