import { gcalMirror, GCAL_MIRROR_MAX } from '../src/utils/gcalMirror';
import type { CalendarEvent } from '../src/types/calendar';

const now = new Date('2026-11-14T12:00:00');
const ev = (id: string, date: string, p: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title: id, date, allDay: true, priority: 'normal', createdAt: '2026-01-01', ...p });

describe('gcalMirror', () => {
  it('bierze okno -45..+180 dni, łącznie z wielodniowymi zachodzącymi na okno', () => {
    const out = gcalMirror([
      ev('old', '2026-01-10'),
      ev('multi', '2026-09-20', { endDate: '2026-10-05' }), // kończy się w oknie (od 30.09)
      ev('today', '2026-11-14'),
      ev('far', '2027-08-01'),
    ], now);
    expect(out.map((e) => e.id)).toEqual(['multi', 'today']);
  });
  it('przycina długie opisy i usuwa puste pola (Firestore)', () => {
    const [e] = gcalMirror([ev('a', '2026-11-20', { description: 'x'.repeat(1000), color: undefined })], now);
    expect(e.description!.length).toBe(301);
    expect('color' in e).toBe(false);
  });
  it('ma limit liczby wydarzeń, najwcześniejsze pierwsze', () => {
    const many = Array.from({ length: GCAL_MIRROR_MAX + 50 }, (_, i) => ev(`e${String(i).padStart(4, '0')}`, '2026-11-20'));
    const out = gcalMirror(many, now);
    expect(out).toHaveLength(GCAL_MIRROR_MAX);
    expect(out[0].id).toBe('e0000');
  });
});

describe('gcalMirror — starsze zmiany pracy', () => {
  it('dokłada starsze wydarzenia pracy (bez opisu), inne stare pomija', () => {
    const out = gcalMirror([
      ev('jd-old', '2025-03-10', { allDay: false, title: 'JD 09:00 - 16:00', startTime: '09:00', endTime: '16:00', description: 'długi opis' }),
      ev('urodziny', '2025-03-11'),
      ev('today', '2026-11-14'),
    ], now, (e) => e.title.startsWith('JD'));
    expect(out.map((e) => e.id)).toEqual(['jd-old', 'today']);
    expect(out[0].description).toBeUndefined();
    expect(out[0].startTime).toBe('09:00');
  });
});
