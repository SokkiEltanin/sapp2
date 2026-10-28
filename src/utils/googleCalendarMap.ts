// Port z sapp (src/utils/googleCalendarMap.ts), logika 1:1 — `mapEvent` jest czystą
// funkcją (dane → dane), wydzieloną tam specjalnie pod testy (node-environment nie
// potrafi sparsować natywnego `@react-native-google-signin` bez mocka). Ten sam
// powód dotyczy tutaj: `googleCalendarService.ts` importuje GoogleSignin
// DYNAMICZNIE, ten plik — wcale, więc jest bezpieczny do importu gdziekolwiek
// (Expo Go, testy, store).
import type { CalendarEvent } from '@/types/calendar';
import { ymd } from '@/utils/date';

export interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string;
  status?: string;
}

const GCAL_COLORS: Record<string, string> = {
  '1': '#7986CB', '2': '#33B679', '3': '#8E24AA', '4': '#E67C73',
  '5': '#F6BF26', '6': '#F4511E', '7': '#039BE5', '8': '#616161',
  '9': '#3F51B5', '10': '#0B8043', '11': '#D50000',
};

// Google's `end.date` dla eventów całodniowych jest EXCLUSIVE (1-dniowy event ma
// end=start+1, 3-dniowy 20→23 ma end=24) — nasze `endDate` (CalendarEvent) jest
// INCLUSIVE (ostatni realny dzień), więc trzeba odjąć 1 dzień — dokładnie
// odwrotność tego co `createEvent`/`updateEvent` w googleCalendarService.ts robią w
// drugą stronę (+1 dzień) przy zapisie. Dla eventów z godziną `end.dateTime` jest
// już precyzyjnym momentem, nie exclusive-markerem — bez odejmowania.
export function mapEvent(e: GCalEvent): CalendarEvent {
  const allDay = !e.start.dateTime;
  const startIso = e.start.dateTime ?? (e.start.date! + 'T00:00:00');
  const endIso = e.end.dateTime ?? (e.end.date! + 'T00:00:00');
  const startDay = startIso.slice(0, 10);

  let endDate: string | undefined;
  if (allDay) {
    const d = new Date(`${e.end.date!}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const inclusiveEnd = ymd(d);
    if (inclusiveEnd > startDay) endDate = inclusiveEnd;
  } else {
    const endDay = endIso.slice(0, 10);
    if (endDay > startDay) endDate = endDay;
  }

  return {
    id: `gcal-${e.id}`,
    title: e.summary ?? '(bez tytułu)',
    description: e.description,
    date: startDay,
    endDate,
    startTime: allDay ? undefined : startIso.slice(11, 16),
    endTime: allDay ? undefined : endIso.slice(11, 16),
    allDay,
    priority: 'normal',
    color: e.colorId ? GCAL_COLORS[e.colorId] : '#039BE5',
    createdAt: new Date().toISOString(),
  };
}
