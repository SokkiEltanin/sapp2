import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { MapPin, Navigation, RefreshCw, Search } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useWeatherStore } from '@/store/weatherStore';
import { refreshWeather } from '@/hooks/useWeather';
import { searchCity, type CityHit } from '@/services/weather';
import { weatherCodeInfo, aqiInfo, rainSummary, weatherTip, fmtTemp } from '@/utils/weather';
import { haptic } from '@/utils/haptics';

// Szczegóły pogody (2026-11-13): teraz (odczuwalna/wilgotność/wiatr/ciśnienie/
// UV/wschód-zachód), 24 h godzina po godzinie (temp + szansa opadów), 7 dni,
// jakość powietrza z normami WHO, a na dole lokalizacja: GPS albo wyszukane
// miasto (config na samym dole — CLAUDE.md zasada 10).
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const Icon = ({ name, size = 16, color = colors.text.primary }: { name: string; size?: number; color?: string }) => {
  const C = (LucideIcons as any)[name] ?? LucideIcons.Cloud;
  return <C size={size} color={color} />;
};
const hm = (t: string) => t.slice(11, 16);
const dayName = (iso: string, i: number) => {
  if (i === 0) return 'dziś';
  if (i === 1) return 'jutro';
  const [y, m, d] = iso.split('-').map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
};

export default function WeatherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const data = useWeatherStore((st) => st.data);
  const location = useWeatherStore((st) => st.location);
  const loading = useWeatherStore((st) => st.loading);
  const error = useWeatherStore((st) => st.error);
  const gpsDenied = useWeatherStore((st) => st.gpsDenied);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CityHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => { if (visible) { setQuery(''); setHits([]); setPickOpen(!location); } }, [visible]);

  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchCity(query).then((r) => { if (alive) setHits(r); }).catch(() => { if (alive) setHits([]); }).finally(() => { if (alive) setSearching(false); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const pickCity = (h: CityHit) => {
    haptic.success();
    useWeatherStore.getState().setLocation({ mode: 'city', name: h.name, lat: h.lat, lon: h.lon });
    setPickOpen(false);
    refreshWeather(true);
  };
  const useGps = () => {
    haptic.tap();
    useWeatherStore.setState({ location: null, gpsDenied: false, data: null });
    setPickOpen(false);
    refreshWeather(true);
  };

  const cur = data?.current;
  const info = cur ? weatherCodeInfo(cur.code, cur.isDay) : null;
  const today = data?.daily[0];
  const tip = data ? weatherTip(data) : null;
  // Dzień/noc dla ikon godzinowych z prawdziwego wschodu/zachodu tego dnia.
  const isDayAt = (t: string) => {
    const d = data?.daily.find((x) => x.date === t.slice(0, 10));
    return d ? t >= d.sunrise && t < d.sunset : true;
  };
  const maxPop = Math.max(1, ...(data?.hourly.map((h) => h.pop) ?? [1]));
  const weekMin = data ? Math.min(...data.daily.map((d) => d.min)) : 0;
  const weekMax = data ? Math.max(...data.daily.map((d) => d.max)) : 1;

  const header = (
    <View style={s.head}>
      <MapPin size={14} color={colors.text.secondary} />
      <Text style={s.place} numberOfLines={1}>{data?.place ?? location?.name ?? 'Pogoda'}</Text>
      {location?.mode === 'gps' && <Navigation size={11} color={colors.text.muted} />}
      <TouchableOpacity onPress={() => { haptic.tap(); refreshWeather(true); }} hitSlop={8} style={s.headBtn} accessibilityLabel="Odśwież">
        {loading ? <ActivityIndicator size="small" color={colors.text.muted} /> : <RefreshCw size={14} color={colors.text.secondary} />}
      </TouchableOpacity>
    </View>
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose} header={header} maxHeightRatio={0.9}>
      {error && <Text style={s.error}>{error}</Text>}
      {gpsDenied && !location && <Text style={s.error}>Brak zgody na lokalizację — wpisz miasto poniżej.</Text>}

      {cur && info && (
        <>
          <View style={s.nowRow}>
            <Icon name={info.icon} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={s.nowTemp}>{fmtTemp(cur.temp)}</Text>
              <Text style={s.nowLabel}>{info.label} · odczuwalna {fmtTemp(cur.feels)}</Text>
            </View>
            {today && <Text style={s.nowRange}>{fmtTemp(today.max)} / {fmtTemp(today.min)}</Text>}
          </View>
          <Text style={s.rain}>{rainSummary(data!.hourly)}{today && today.precipSum > 0 ? ` · dziś ${today.precipSum.toFixed(1).replace('.', ',')} mm` : ''}</Text>
          {tip && <Text style={s.tip}>{tip}</Text>}

          <View style={s.grid}>
            {[
              ['Wilgotność', `${Math.round(cur.humidity)}%`],
              ['Wiatr', `${Math.round(cur.wind)} km/h`],
              ['Porywy', `${Math.round(cur.gusts)} km/h`],
              ['Ciśnienie', `${Math.round(cur.pressure)} hPa`],
              ['UV max', today ? today.uvMax.toFixed(0) : '—'],
              ['Słońce', today ? `${hm(today.sunrise)}–${hm(today.sunset)}` : '—'],
            ].map(([k, v]) => (
              <View key={k} style={s.gridCell}>
                <Text style={s.gridVal}>{v}</Text>
                <Text style={s.gridKey}>{k}</Text>
              </View>
            ))}
          </View>

          <Text style={s.section}>Najbliższe 24 h</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hours}>
            {data!.hourly.map((h) => (
              <View key={h.time} style={s.hour}>
                <Text style={s.hourT}>{hm(h.time)}</Text>
                <Icon name={weatherCodeInfo(h.code, isDayAt(h.time)).icon} size={15} color={colors.text.secondary} />
                <Text style={s.hourTemp}>{fmtTemp(h.temp)}</Text>
                <View style={s.popBox}>
                  <View style={[s.popBar, { height: `${(h.pop / maxPop) * 100}%`, opacity: h.pop >= 50 ? 1 : 0.5 }]} />
                </View>
                <Text style={s.hourPop}>{h.pop > 0 ? `${h.pop}%` : ''}</Text>
              </View>
            ))}
          </ScrollView>

          <Text style={s.section}>7 dni</Text>
          {data!.daily.map((d, i) => {
            const span = Math.max(1, weekMax - weekMin);
            return (
              <View key={d.date} style={s.dayRow}>
                <Text style={s.dayName}>{dayName(d.date, i)}</Text>
                <Icon name={weatherCodeInfo(d.code).icon} size={15} color={colors.text.secondary} />
                <Text style={s.dayPop}>{d.pop >= 20 ? `${d.pop}%` : ''}</Text>
                <Text style={s.dayMin}>{fmtTemp(d.min)}</Text>
                <View style={s.rangeTrack}>
                  <View style={[s.rangeFill, { left: `${((d.min - weekMin) / span) * 100}%`, right: `${((weekMax - d.max) / span) * 100}%` }]} />
                </View>
                <Text style={s.dayMax}>{fmtTemp(d.max)}</Text>
              </View>
            );
          })}

          {data!.air && (() => {
            const a = aqiInfo(data!.air!.aqi);
            return (
              <>
                <Text style={s.section}>Powietrze</Text>
                <View style={s.airHead}>
                  <View style={[s.airDot, { backgroundColor: a.color }]} />
                  <Text style={[s.airLabel, { color: a.color }]}>{a.label}</Text>
                  <Text style={s.airIdx}>indeks {data!.air!.aqi}</Text>
                </View>
                <View style={s.grid}>
                  {[
                    ['PM2,5', data!.air!.pm25, 15],
                    ['PM10', data!.air!.pm10, 45],
                    ['NO₂', data!.air!.no2, 25],
                    ['O₃', data!.air!.o3, 100],
                  ].filter(([, v]) => v != null).map(([k, v, norm]) => (
                    <View key={k as string} style={s.gridCell}>
                      <Text style={[s.gridVal, (v as number) > (norm as number) && { color: colors.accent.red }]}>{Math.round(v as number)}</Text>
                      <Text style={s.gridKey}>{k} · norma {norm}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.note}>µg/m³, normy dobowe WHO.</Text>
              </>
            );
          })()}
        </>
      )}

      {!cur && !loading && !error && !(gpsDenied && !location) && <Text style={s.note}>Pobieram pogodę…</Text>}

      {/* Lokalizacja */}
      <TouchableOpacity style={s.locRow} onPress={() => setPickOpen((v) => !v)} activeOpacity={0.7}>
        <Text style={s.section}>Lokalizacja</Text>
        <Text style={s.locNow} numberOfLines={1}>{location ? `${location.mode === 'gps' ? 'GPS · ' : ''}${location.name}` : 'nie ustawiona'} · zmień</Text>
      </TouchableOpacity>
      {pickOpen && (
        <View style={s.pick}>
          <TouchableOpacity style={s.gpsBtn} onPress={useGps} activeOpacity={0.8}>
            <Navigation size={14} color={colors.bg.primary} />
            <Text style={s.gpsLabel}>Użyj mojej lokalizacji (GPS)</Text>
          </TouchableOpacity>
          <View style={s.searchRow}>
            <Search size={14} color={colors.text.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="albo wpisz miasto…" placeholderTextColor={colors.text.muted} style={s.searchInput} autoCorrect={false} />
            {searching && <ActivityIndicator size="small" color={colors.text.muted} />}
          </View>
          {hits.map((h) => (
            <TouchableOpacity key={`${h.lat},${h.lon}`} style={s.hit} onPress={() => pickCity(h)} activeOpacity={0.7}>
              <Text style={s.hitName}>{h.name}</Text>
              <Text style={s.hitSub} numberOfLines={1}>{[h.region, h.country].filter(Boolean).join(', ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={s.note}>Dane: Open-Meteo</Text>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[2] },
  place: { flexShrink: 1, fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  headBtn: { marginLeft: 'auto', width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  error: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.red, marginBottom: spacing[2] },

  nowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  nowTemp: { fontSize: 44, lineHeight: 48, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -1.5 },
  nowLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  nowRange: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  rain: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary, marginTop: spacing[3] },
  tip: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.orange, marginTop: spacing[1] },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[3], rowGap: spacing[3] },
  gridCell: { width: '33.33%' },
  gridVal: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  gridKey: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },

  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[2] },
  hours: { gap: spacing[2], paddingRight: spacing[2] },
  hour: { alignItems: 'center', width: 42, gap: 4 },
  hourT: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  hourTemp: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  popBox: { height: 28, width: 8, borderRadius: 4, backgroundColor: c.bg.elevated, justifyContent: 'flex-end', overflow: 'hidden' },
  popBar: { width: '100%', backgroundColor: c.accent.blue, borderRadius: 4 },
  hourPop: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.accent.blue, height: 12 },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  dayName: { width: 40, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dayPop: { width: 34, fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.accent.blue, textAlign: 'right' },
  dayMin: { width: 30, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted, textAlign: 'right' },
  dayMax: { width: 30, fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  rangeTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.bg.elevated },
  rangeFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 2, backgroundColor: c.text.secondary },

  airHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  airDot: { width: 10, height: 10, borderRadius: 5 },
  airLabel: { fontSize: 15, fontFamily: 'Inter_900Black' },
  airIdx: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  note: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },

  locRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  locNow: { flexShrink: 1, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pick: { gap: spacing[2] },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[3] },
  gpsLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3] },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary, paddingVertical: spacing[2] },
  hit: { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: c.border.default },
  hitName: { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  hitSub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },
}));
