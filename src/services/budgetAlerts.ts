import { Platform } from 'react-native';
import { useBudgetsStore } from '@/store/budgetsStore';
import { useExpensesStore } from '@/store/expensesStore';
import { budgetStatuses, newBudgetAlerts } from '@/utils/budgets';

// Ostrzeżenia budżetowe (2026-11-13): po każdej zmianie wydatków (np. nowy
// paragon albo płatność z banku) sprawdzamy progi 80% i 100% — każdy zgłaszany
// raz w miesiącu (budgetsStore.notified). Natychmiastowe powiadomienie notifee.
const CHANNEL_ID = 'budget-alerts-v1';
let timer: ReturnType<typeof setTimeout> | null = null;

export function startBudgetAlerts(): () => void {
  const check = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { run().catch(() => {}); }, 1500);
  };
  const u1 = useExpensesStore.subscribe((s, p) => { if (s.expenses !== p.expenses) check(); });
  const u2 = useBudgetsStore.subscribe((s, p) => { if (s.budgets !== p.budgets) check(); });
  check();
  return () => { u1(); u2(); if (timer) clearTimeout(timer); };
}

async function run(): Promise<void> {
  const { budgets, notified, markNotified } = useBudgetsStore.getState();
  if (!budgets.length) return;
  const alerts = newBudgetAlerts(budgetStatuses(budgets, useExpensesStore.getState().expenses), notified);
  if (!alerts.length) return;
  // Zaznacz od razu (także na web/bez zgody) — żeby nie powtarzać przy każdej zmianie.
  for (const a of alerts) markNotified(a.budgetId, a.month, a.level);
  if (Platform.OS !== 'android') return;
  let mod: typeof import('@notifee/react-native');
  try { mod = await import('@notifee/react-native'); } catch { return; }
  const notifee = mod.default;
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < mod.AuthorizationStatus.AUTHORIZED) return;
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Budżety — ostrzeżenia', importance: mod.AndroidImportance.DEFAULT });
  for (const a of alerts) {
    await notifee.displayNotification({
      id: `budget_${a.budgetId}`, title: a.title, body: a.body,
      data: { route: 'finances' },
      android: { channelId: CHANNEL_ID, pressAction: { id: 'default', launchActivity: 'default' } },
    });
  }
}
