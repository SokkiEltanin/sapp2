import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { MapPin, Navigation, RefreshCw, Search, Radar, ExternalLink, Droplet } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SheetCard, Legend } from '@/components/design/SheetCard';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useWeatherStore } from '@/store/weatherStore';
import { refreshWeather } from '@/hooks/useWeather';
import { searchCity, type CityHit } from '@/services/weather';
import { weatherCodeInfo, aqiInfo, rainSummary, cloudSummary, weatherTip, fmtTemp, weatherColor, weatherToneKey, WEATHER_TONES, tempColor } from '@/utils/weather';
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
  const nowTone = cur ? weatherColor(cur.code, cur.isDay) : colors.text.secondary;
  const info = cur ? weatherCodeInfo(cur.code, cur.isDay) : null;
  const today = data?.daily[0];
  const tip = data ? weatherTip(data) : null;
  // Dzień/noc dla ikon godzinowych z prawdziwego wschodu/zachodu tego dnia.
  const isDayAt = (t: string) => {
    const d = data?.daily.find((x) => x.date === t.slice(0, 10));
    return d ? t >= d.sunrise && t < d.sunset : true;
  };
  const clouds = data ? cloudSummary(data.hourly) : '';
  const hasClouds = !!data?.hourly.some((h) => h.cloud != null);
  // Radar w przeglądarce/aplikacji RainViewer (nie w appce — interaktywna mapa
  // w WebView to ciężki element, user: "tylko nie wiem, czy to nie będzie lagować").
  const coords = location ?? null;
  const openRadar = () => {
    if (!coords) return;
    haptic.tap();
    Linking.openURL(`https://www.rainviewer.com/map.html?loc=${coords.lat.toFixed(3)},${coords.lon.toFixed(3)},8&layer=radar&sm=1&sn=1`).catch(() => {});
  };
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
          {/* Karta "teraz" z lekkim gradientem w kolorze pogody (2026-11-14, user:
              "żeby widzieć czy pochmurnie czy śnieg czy deszcz — bez animacji"). */}
          <View style={s.nowCard}>
            <LinearGradient
              colors={[nowTone + '45', nowTone + '14', 'transparent']}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.nowRow}>
              <Icon name={info.icon} size={40} color={nowTone} />
              <View style={{ flex: 1 }}>
                <Text style={s.nowTemp}>{fmtTemp(cur.temp)}</Text>
                <Text style={s.nowLabel}>{info.label} · odczuwalna {fmtTemp(cur.feels)}</Text>
              </View>
              {today && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.nowRange}>{fmtTemp(today.max)}</Text>
                  <Text style={s.nowRangeLo}>{fmtTemp(today.min)}</Text>
                </View>
              )}
            </View>
            <Text style={s.rain}>{rainSummary(data!.hourly)}{today && today.precipSum > 0 ? ` · dziś ${today.precipSum.toFixed(1).replace('.', ',')} mm` : ''}</Text>
            {!!clouds && <Text style={s.cloudLine}>{clouds}</Text>}
            {tip && <Text style={s.tip}>{tip}</Text>}
          </View>

          <View style={s.miniRow}>
            {[
              ['Wilgotność', `${Math.round(cur.humidity)}%`],
              ['Wiatr', `${Math.round(cur.wind)}`, 'km/h'],
              ['Porywy', `${Math.round(cur.gusts)}`, 'km/h'],
              ['Ciśnienie', `${Math.round(cur.pressure)}`, 'hPa'],
              ['UV max', today ? today.uvMax.toFixed(0) : '—'],
              ['Słońce', today ? `${hm(today.sunrise)}` : '—', today ? `do ${hm(today.sunset)}` : undefined],
            ].map(([k, v, unit]) => (
              <View key={k} style={s.mini}>
                <Text style={s.gridVal}>{v}{unit && !unit.startsWith('do') ? <Text style={s.unit}> {unit}</Text> : null}</Text>
                <Text style={s.gridKey}>{k}{unit?.startsWith('do') ? ` · ${unit}` : ''}</Text>
              </View>
            ))}
          </View>

          <SheetCard
            title="24 h"
            right={<Legend items={[{ color: colors.accent.blue, label: 'deszcz %' }, ...(hasClouds ? [{ color: colors.ui.dim, label: 'chmury %' }] : [])]} />}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hours}>
              {data!.hourly.map((h) => (
                <View key={h.time} style={s.hour}>
                  <Text style={s.hourT}>{hm(h.time)}</Text>
                  <Icon name={weatherCodeInfo(h.code, isDayAt(h.time)).icon} size={15} color={weatherColor(h.code, isDayAt(h.time))} />
                  <Text style={s.hourTemp}>{fmtTemp(h.temp)}</Text>
                  <View style={s.barsRow}>
                    <View style={s.popBox}>
                      <View style={[s.popBar, { height: `${h.pop}%`, opacity: h.pop >= 50 ? 1 : 0.55 }]} />
                    </View>
                    {hasClouds && (
                      <View style={s.popBox}>
                        <View style={[s.cloudBar, { height: `${h.cloud ?? 0}%` }]} />
                      </View>
                    )}
                  </View>
                  <Text style={s.hourPop}>{h.pop > 0 ? `${h.pop}%` : ''}</Text>
                  <Text style={s.hourMm}>{h.precip >= 0.1 ? `${h.precip.toFixed(1).replace('.', ',')}` : ''}</Text>
                </View>
              ))}
            </ScrollView>
            <Text style={s.note}>Słupek pełny = 100%. Liczba pod spodem = mm opadu w tej godzinie.</Text>
          </SheetCard>

          {/* "7 dni" (2026-11-14, user: "nie rozumiem tego paska"): kolumny podpisane
              (opady / noc / dzień), pod dniem słowo o pogodzie w jej kolorze, pasek =
              temperatura od nocy do dnia, kolorem od zimna (niebieski) do ciepła
              (pomarańczowy), położony na skali całego tygodnia. */}
          <SheetCard title="7 dni">
            <View style={s.dayHead}>
              <Text style={[s.colHead, { width: 92 }]}>dzień</Text>
              <Text style={[s.colHead, { width: 40, textAlign: 'right' }]}>opady</Text>
              <Text style={[s.colHead, { width: 34, textAlign: 'right' }]}>noc</Text>
              <Text style={[s.colHead, { flex: 1, textAlign: 'center' }]}>temperatura</Text>
              <Text style={[s.colHead, { width: 34 }]}>dzień</Text>
            </View>
            {data!.daily.map((d, i) => {
              const span = Math.max(1, weekMax - weekMin);
              const tone = WEATHER_TONES[weatherToneKey(d.code)];
              return (
                <View key={d.date} style={s.dayRow}>
                  <View style={s.dayNameCol}>
                    <Icon name={weatherCodeInfo(d.code).icon} size={16} color={tone.color} />
                    <View style={{ flexShrink: 1 }}>
                      <Text style={s.dayName}>{dayName(d.date, i)}</Text>
                      <Text style={[s.dayKind, { color: tone.color }]} numberOfLines={1}>{tone.label}</Text>
                    </View>
                  </View>
                  <View style={s.dayPopCol}>
                    {d.pop >= 20 && <Droplet size={10} color={colors.accent.blue} />}
                    <Text style={s.dayPop}>{d.pop >= 20 ? `${d.pop}%` : '–'}</Text>
                  </View>
                  <Text style={[s.dayMin, { color: tempColor(d.min) }]}>{fmtTemp(d.min)}</Text>
                  <View style={s.rangeTrack}>
                    <LinearGradient
                      colors={[tempColor(d.min), tempColor(d.max)]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[s.rangeFill, { left: `${((d.min - weekMin) / span) * 100}%`, right: `${((weekMax - d.max) / span) * 100}%` }]}
                    />
                  </View>
                  <Text style={[s.dayMax, { color: tempColor(d.max) }]}>{fmtTemp(d.max)}</Text>
                </View>
              );
            })}
            <Text style={s.note}>Pasek = od nocy do dnia; dalej w prawo = cieplej niż w inne dni. Kolor: niebieski zimno → pomarańczowy ciepło.</Text>
          </SheetCard>

          {data!.air && (() => {
            const a = aqiInfo(data!.air!.aqi);
            return (
              <SheetCard
                title="Powietrze"
                right={<View style={s.airHead}><View style={[s.airDot, { backgroundColor: a.color }]} /><Text style={[s.airLabel, { color: a.color }]}>{a.label}</Text><Text style={s.airIdx}>{data!.air!.aqi}</Text></View>}
              >
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
                <Text style={s.note}>µg/m³, normy dobowe WHO. Czerwone = powyżej normy.</Text>
              </SheetCard>
            );
          })()}

          {coords && (
            <TouchableOpacity style={s.radar} onPress={openRadar} activeOpacity={0.75}>
              <Radar size={18} color={colors.text.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.radarTitle}>Radar opadów</Text>
                <Text style={s.radarSub}>mapa na żywo z animacją chmur deszczowych</Text>
              </View>
              <ExternalLink size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}
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
      <Text style={s.note}>Dane: Open-Meteo · radar: RainViewer</Text>
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
  nowRange: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  nowRangeLo: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  cloudLine: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary, marginTop: 2 },
  miniRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  mini: { flexGrow: 1, flexBasis: '30%', backgroundColor: c.ui.in, borderRadius: radius.lg, paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  unit: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  barsRow: { flexDirection: 'row', gap: 2 },
  cloudBar: { width: '100%', backgroundColor: c.ui.dim, borderRadius: 4 },
  hourMm: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: c.text.muted, height: 11 },
  radar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], marginTop: spacing[2] },
  radarTitle: { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  radarSub: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  rain: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary, marginTop: spacing[2] },
  tip: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.orange, marginTop: spacing[1] },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing[3] },
  gridCell: { width: '50%' },
  gridVal: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  gridKey: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },

  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[2] },
  hours: { gap: spacing[2], paddingRight: spacing[2] },
  hour: { alignItems: 'center', width: 42, gap: 4 },
  hourT: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  hourTemp: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  popBox: { height: 32, width: 7, borderRadius: 4, backgroundColor: c.bg.elevated, justifyContent: 'flex-end', overflow: 'hidden' },
  popBar: { width: '100%', backgroundColor: c.accent.blue, borderRadius: 4 },
  hourPop: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.accent.blue, height: 12 },

  nowCard: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], overflow: 'hidden' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: c.ui.line, marginBottom: 2 },
  colHead: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  dayNameCol: { width: 92, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dayKind: { fontSize: 9.5, fontFamily: 'Inter_700Bold', marginTop: 1 },
  dayPopCol: { width: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  dayName: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dayPop: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.accent.blue, textAlign: 'right' },
  dayMin: { width: 34, fontSize: 12, fontFamily: 'Inter_800ExtraBold', textAlign: 'right', fontVariant: ['tabular-nums'] },
  dayMax: { width: 34, fontSize: 12.5, fontFamily: 'Inter_900Black', fontVariant: ['tabular-nums'] },
  rangeTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.bg.primary },
  rangeFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },

  airHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  airDot: { width: 10, height: 10, borderRadius: 5 },
  airLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black' },
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
