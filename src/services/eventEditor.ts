import { create } from 'zustand';
import type { CalendarEvent } from '@/types/calendar';

// Formularz wydarzenia (2026-11-15, user: "dodajmy możliwość EDYCJI EVENTÓW KALENDARZA
// GOOGLE... formularz super jak na samsungu") — jeden, globalny (app/_layout.tsx),
// otwierany z dowolnego miejsca: szczegóły dnia w Zadaniach, "Najbliższe eventy".
type Req = { event: CalendarEvent } | { newOn: string } | null;
export const useEventEditor = create<{ req: Req }>(() => ({ req: null }));

export const openEventEditor = (event: CalendarEvent) => useEventEditor.setState({ req: { event } });
export const openNewEvent = (date: string) => useEventEditor.setState({ req: { newOn: date } });
export const closeEventEditor = () => useEventEditor.setState({ req: null });
