import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarEvent } from '@/types/calendar';
import { mapEvent, type GCalEvent } from '@/utils/googleCalendarMap';

// Port z sapp (src/services/googleCalendarService.ts), logika 1:1 — JEDNA świadoma
// różnica: sapp importuje `GoogleSignin` STATYCZNIE na górze pliku, co jest u NAS
// zabronione (zasada z app/_layout.tsx: natywny moduł, którego nie ma w Expo Go —
// statyczny import na poziomie modułu wywaliłby appkę, jeśli cokolwiek, co importuje
// ten serwis, zdąży się zamontować tam). Tu więc DYNAMICZNIE, w jedynym miejscu
// gdzie jest potrzebny (`refreshToken`).
const TOKEN_KEY = 'gcal_access_token';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function realId(appId: string): string {
  return appId.startsWith('gcal-') ? appId.slice(5) : appId;
}

async function doFetch(token: string, params: URLSearchParams): Promise<Response> {
  return fetch(`${BASE}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function apiFetch(token: string, path: string, method: string, body?: object): Promise<Response> {
  return fetch(`${BASE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export const googleCalendarService = {
  async storeToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  async refreshToken(): Promise<string | null> {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      const tokens = await GoogleSignin.getTokens();
      await AsyncStorage.setItem(TOKEN_KEY, tokens.accessToken);
      return tokens.accessToken;
    } catch {
      return null;
    }
  },

  async getToken(): Promise<string | null> {
    let token = await this.getStoredToken();
    if (!token) token = await this.refreshToken();
    return token;
  },

  async createEvent(opts: {
    title: string;
    description?: string;
    date: string;       // YYYY-MM-DD
    startTime?: string; // HH:mm
    endTime?: string;   // HH:mm
    allDay?: boolean;
  }): Promise<string | null> {
    let token = await this.getToken();
    if (!token) return null;

    const isAllDay = opts.allDay || !opts.startTime;
    const tz = 'Europe/Warsaw';
    const body: Record<string, any> = {
      summary: opts.title,
      description: opts.description ?? '',
    };

    if (isAllDay) {
      const nextDay = new Date(opts.date + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      body.start = { date: opts.date };
      body.end = { date: `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}` }; // LOCAL (toISOString=UTC → off by a day)
    } else {
      body.start = { dateTime: `${opts.date}T${opts.startTime}:00`, timeZone: tz };
      body.end = { dateTime: `${opts.date}T${opts.endTime || opts.startTime}:00`, timeZone: tz };
    }

    let resp = await fetch(BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (resp.status === 401) {
      const fresh = await this.refreshToken();
      if (!fresh) return null;
      resp = await fetch(BASE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${fresh}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.id ?? null;
  },

  async updateEvent(appId: string, updates: {
    title?: string;
    description?: string;
    date?: string;       // YYYY-MM-DD
    startTime?: string;  // HH:mm or ''
    endTime?: string;    // HH:mm or ''
    allDay?: boolean;
  }): Promise<boolean> {
    let token = await this.getToken();
    if (!token) return false;

    const id = realId(appId);
    const isAllDay = updates.allDay || !updates.startTime;
    const body: Record<string, any> = {};

    if (updates.title !== undefined) body.summary = updates.title;
    if (updates.description !== undefined) body.description = updates.description ?? '';

    if (updates.date) {
      if (isAllDay) {
        const nextDay = new Date(updates.date + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        body.start = { date: updates.date };
        body.end = { date: `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}` }; // LOCAL (toISOString=UTC → off by a day)
      } else {
        const tz = 'Europe/Warsaw';
        body.start = { dateTime: `${updates.date}T${updates.startTime}:00`, timeZone: tz };
        body.end = { dateTime: `${updates.date}T${updates.endTime || updates.startTime}:00`, timeZone: tz };
      }
    }

    let resp = await apiFetch(token, id, 'PATCH', body);
    if (resp.status === 401) {
      const fresh = await this.refreshToken();
      if (!fresh) return false;
      resp = await apiFetch(fresh, id, 'PATCH', body);
    }
    return resp.ok;
  },

  async deleteEvent(appId: string): Promise<boolean> {
    let token = await this.getToken();
    if (!token) return false;

    const id = realId(appId);
    let resp = await apiFetch(token, id, 'DELETE');
    if (resp.status === 401) {
      const fresh = await this.refreshToken();
      if (!fresh) return false;
      resp = await apiFetch(fresh, id, 'DELETE');
    }
    return resp.ok || resp.status === 204;
  },

  // Domyślnie ~2 lata wstecz + 1 rok w przód, z paginacją (identycznie jak w sapp —
  // user tam złapał bug "nie ładują mi się eventy z grudnia" przy węższym oknie:
  // `timeMax` obcinał eventy server-side, Google API ich wtedy wogóle nie wraca —
  // nie bug cache'u/UI, samo okno pobierania było za wąskie).
  async fetchEvents(daysBack = 730, daysForward = 365): Promise<CalendarEvent[]> {
    let token = await this.getStoredToken();
    if (!token) {
      token = await this.refreshToken();
      if (!token) return [];
    }

    const past = new Date(); past.setDate(past.getDate() - daysBack);
    const future = new Date(); future.setDate(future.getDate() + daysForward);

    const out: CalendarEvent[] = [];
    let pageToken: string | undefined;
    let guard = 0; // safety: never loop more than ~10 pages (25k events)
    do {
      const params = new URLSearchParams({
        timeMin: past.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '2500',
      });
      if (pageToken) params.set('pageToken', pageToken);

      let resp = await doFetch(token, params);
      if (resp.status === 401) {
        const fresh = await this.refreshToken();
        if (!fresh) { await this.clearToken(); return out; }
        token = fresh;
        resp = await doFetch(fresh, params);
      }
      if (!resp.ok) return out;

      const data = await resp.json();
      for (const e of ((data.items ?? []) as GCalEvent[])) {
        if (e.status !== 'cancelled') out.push(mapEvent(e));
      }
      pageToken = data.nextPageToken;
    } while (pageToken && ++guard < 10);

    return out;
  },
};
