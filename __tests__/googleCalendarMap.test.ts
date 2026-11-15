
import { buildEventBody, eventRangeOk, mapEvent as mapBack } from '@/utils/googleCalendarMap';
describe('buildEventBody — zapis z formularza', () => {
  it('cały dzień, wielodniowy: koniec exclusive (+1), w obie strony zgodny z mapEvent', () => {
    const body: any = buildEventBody({ title: 'Urlop', date: '2026-11-20', endDate: '2026-11-23', allDay: true });
    expect(body.start).toEqual({ date: '2026-11-20' });
    expect(body.end).toEqual({ date: '2026-11-24' });
    const back = mapBack({ id: 'x', summary: 'Urlop', ...body });
    expect(back.date).toBe('2026-11-20');
    expect(back.endDate).toBe('2026-11-23');
  });
  it('z godziną: strefa Warszawa, koniec tego samego dnia, kolor Google', () => {
    const body: any = buildEventBody({ title: ' Dentysta ', date: '2026-11-18', startTime: '09:30', endTime: '10:15', allDay: false, color: '#E67C73' });
    expect(body.summary).toBe('Dentysta');
    expect(body.start).toEqual({ dateTime: '2026-11-18T09:30:00', timeZone: 'Europe/Warsaw' });
    expect(body.end).toEqual({ dateTime: '2026-11-18T10:15:00', timeZone: 'Europe/Warsaw' });
    expect(body.colorId).toBe('4');
  });
  it('walidacja: koniec przed początkiem = błąd', () => {
    expect(eventRangeOk({ date: '2026-11-18', startTime: '10:00', endTime: '09:00', allDay: false })).toBe(false);
    expect(eventRangeOk({ date: '2026-11-18', endDate: '2026-11-19', startTime: '22:00', endTime: '02:00', allDay: false })).toBe(true);
    expect(eventRangeOk({ date: '2026-11-18', endDate: '2026-11-17', allDay: true })).toBe(false);
  });
});
