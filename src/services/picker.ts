import { create } from 'zustand';

// Własny picker daty/godziny (2026-11-15, user: "takie elementy surowe miałeś
// zrobić" — systemowy zegar Androida: szary, "CANCEL"/"OK" po angielsku).
// API celowo jak `DateTimePickerAndroid.open` (te same opcje i `onChange(event,
// date)`), więc wywołania przeszły 1:1. UI: components/design/PickerHost.tsx,
// zamontowany raz w app/_layout.tsx.
export type PickerMode = 'date' | 'time';
export interface PickerEvent { type: 'set' | 'dismissed' }
export interface PickerOptions {
  value: Date;
  mode?: PickerMode;
  is24Hour?: boolean;      // ignorowane — zawsze 24 h
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
  onChange?: (event: PickerEvent, date?: Date) => void;
}
interface Req extends PickerOptions { id: number }

export const usePicker = create<{ req: Req | null }>(() => ({ req: null }));
let seq = 0;

export function openPicker(opts: PickerOptions): void {
  usePicker.setState({ req: { ...opts, mode: opts.mode ?? 'date', id: ++seq } });
}

// Zamknięcie z wynikiem. Najpierw czyści żądanie, potem woła onChange — dzięki temu
// łańcuch "data → godzina" (AddTaskCard) może otworzyć kolejny picker w onChange.
export function resolvePicker(date: Date | null): void {
  const req = usePicker.getState().req;
  if (!req) return;
  usePicker.setState({ req: null });
  req.onChange?.({ type: date ? 'set' : 'dismissed' }, date ?? undefined);
}

// Siatka miesiąca: tygodnie od poniedziałku, null = puste pole przed 1. / po ostatnim dniu.
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const out: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}

const dayKey = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
export function dayAllowed(d: Date, min?: Date, max?: Date): boolean {
  const k = dayKey(d);
  return (!min || k >= dayKey(min)) && (!max || k <= dayKey(max));
}
