import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { MapPin, Navigation, RefreshCw, Search, Radar, ExternalLink, Droplet, Droplets, Wind, Gauge, Sun, Sunrise, Sunset } from 'lucide-react-native';
import HourlyChart from './HourlyChart';
import { LinearGradient } from 'expo-linear-gradient';
import { SheetCard, Legend } from '@/components/design/SheetCard';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useWeatherStore } from '@/store/weatherStore';
import { refreshWeather } from '@/hooks/useWeather';
import { searchCity, type CityHit } from '@/services/weather';
import { weatherCodeInfo, aqiInfo, rainSummary, cloudSummary, weatherTip, fmtTemp, weatherColor, weatherToneKey, WEATHER_TONES, tempColor, dayRainText, uvLabel, dayLength, humidityLabel } from '@/utils/weather';
import { haptic } from '@/utils/haptics';

// Układ 2026-11-22 (user: "pogodę zrobiłbym lepiej, brakuje inspiracji"): teraz → jedna karta
// "Szczegóły" (liczba + słowne znaczenie) → wykres 24 h (HourlyChart: krzywa temp., opady,
// chmury) → 7 dni (suchy dzień w jednej linii) → powietrze z paskiem "ile z normy" → radar.
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
  // Pozycja "teraz" na pasku doby (0–1).

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
                  <Text style={s.nowRange}>↑ {fmtTemp(today.max)}</Text>
                  <Text style={s.nowRangeLo}>↓ {fmtTemp(today.min)}</Text>
                </View>
              )}
            </View>
            <Text style={s.rain}>{rainSummary(data!.hourly)}{today && today.precipSum > 0 ? ` · dziś ${today.precipSum.toFixed(1).replace('.', ',')} mm` : ''}</Text>
            {!!clouds && <Text style={s.cloudLine}>{clouds}</Text>}
            {tip && <Text style={s.tip}>{tip}</Text>}
          </View>

          {/* Szczegóły "teraz" w JEDNEJ karcie (2026-11-22, user: "za dużo kafelków") — liczba +
              słowne znaczenie (UV, wilgotność, długość dnia), zamiast 6 osobnych kafli. */}
          <SheetCard title="Szczegóły">
            <View style={s.dGrid}>
              <Detail Icon={Droplets} l="Wilgotność" v={`${Math.round(cur.humidity)}%`} sub={humidityLabel(cur.humidity)} />
              <Detail Icon={Wind} l="Wiatr" v={`${Math.round(cur.wind)} km/h`} sub={`porywy ${Math.round(cur.gusts)}`} warn={cur.gusts >= 60} />
              <Detail Icon={Gauge} l="Ciśnienie" v={`${Math.round(cur.pressure)}`} sub={cur.pressure < 1005 ? 'hPa · niskie' : cur.pressure > 1022 ? 'hPa · wysokie' : 'hPa · w normie'} />
              <Detail Icon={Sun} l="UV max" v={today ? today.uvMax.toFixed(0) : '—'} sub={today ? uvLabel(today.uvMax) : undefined} warn={!!today && today.uvMax >= 6} />
              <Detail Icon={Sunrise} l="Wschód" v={today ? hm(today.sunrise) : '—'} />
              <Detail Icon={Sunset} l="Zachód" v={today ? hm(today.sunset) : '—'} sub={today ? `dzień ${dayLength(today.sunrise, today.sunset)}` : undefined} />
            </View>
          </SheetCard>

          <SheetCard
            title="Najbliższe 24 h"
            right={<Legend items={[{ color: colors.accent.orange, label: 'temp.' }, { color: colors.accent.blue, label: 'szansa opadu' }, ...(hasClouds ? [{ color: colors.text.secondary, label: 'chmury' }] : [])]} />}
          >
            <HourlyChart hours={data!.hourly} isDayAt={isDayAt} />
            <Text style={s.note}>Przesuń w bok. Pod słupkiem: szansa i ilość opadu; dolny pasek — im ciemniej, tym więcej chmur.</Text>
          </SheetCard>

          {/* "7 dni" (2026-11-16, user: "paski kolorki nie docierają do mnie"): bez
              pasków — każdy dzień to dwie linijki zwykłym tekstem: dzień + pogoda +
              temperatury, pod spodem KIEDY pada (utils/weather.ts's dayRainText).
              Potem (user: "drugorzędny tekst nie na kolor; dni kafelkowe, żeby było
              widać, gdzie dzień się kończy"): każdy dzień osobny kafelek, opis i opady
              szarym tekstem — kolor zostaje tylko na ikonie i temperaturze. */}
          <SheetCard title="7 dni">
            {data!.daily.map((d, i) => {
              const tone = WEATHER_TONES[weatherToneKey(d.code)];
              const rain = dayRainText(d);
              return (
                <View key={d.date} style={[s.dayRow, i === 0 && s.dayToday]}>
                  <View style={s.dayTop}>
                    <View style={s.dayNameCol}>
                      <Text style={s.dayName}>{dayName(d.date, i)}</Text>
                      <Text style={s.dayDate}>{Number(d.date.slice(8, 10))}.{d.date.slice(5, 7)}</Text>
                    </View>
                    <Icon name={weatherCodeInfo(d.code).icon} size={18} color={tone.color} />
                    <Text style={s.dayKind} numberOfLines={1}>{tone.label}{rain.wet ? '' : ' · bez opadów'}</Text>
                    <Text style={s.dayTemps}>
                      <Text style={[s.dayMax, { color: tempColor(d.max) }]}>{fmtTemp(d.max)}</Text>
                      <Text style={s.dayMin}>  {fmtTemp(d.min)}</Text>
                    </Text>
                  </View>
                  {rain.wet && (
                    <View style={s.dayRain}>
                      <Droplet size={12} color={colors.accent.blue} />
                      <Text style={s.dayRainTxt} numberOfLines={2}>{rain.text}</Text>
                    </View>
                  )}
                </View>
              );
            })}
            <Text style={s.note}>Duża liczba = najcieplej w dzień, mała = najzimniej w nocy. W nawiasie godziny opadu; % = szansa, mm = ile spadnie.</Text>
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
                      {/* ile z normy (2026-11-22) — pełny pasek = norma WHO */}
                      <View style={s.normTrack}>
                        <View style={[s.normFill, { width: `${Math.min(100, ((v as number) / (norm as number)) * 100)}%`, backgroundColor: (v as number) > (norm as number) ? colors.accent.red : (v as number) > (norm as number) * 0.7 ? colors.accent.orange : colors.accent.green }]} />
                      </View>
                      <Text style={s.gridKey}>{k} · norma {norm}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.note}>µg/m³, normy dobowe WHO. Pełny pasek = norma; czerwone = powyżej.</Text>
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

function Detail({ Icon: I, l, v, sub, warn }: { Icon: any; l: string; v: string; sub?: string; warn?: boolean }) {
  const s = makeS();
  return (
    <View style={s.dCell}>
      <View style={s.dHead}><I size={12} color={colors.text.muted} /><Text style={s.dL} numberOfLines={1}>{l}</Text></View>
      <Text style={[s.dV, warn && { color: colors.accent.orange }]} numberOfLines={1}>{v}</Text>
      {sub ? <Text style={s.dSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  dGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing[3] },
  dCell: { width: '33.33%', paddingRight: spacing[2] },
  dHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dL: { flex: 1, fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  dV: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary, marginTop: 3, fontVariant: ['tabular-nums'] },
  dSub: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
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
  radar: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], marginTop: spacing[2] },
  radarTitle: { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  radarSub: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  rain: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary, marginTop: spacing[2] },
  tip: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.orange, marginTop: spacing[1] },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing[3] },
  gridCell: { width: '50%', paddingRight: spacing[3] },
  normTrack: { height: 4, borderRadius: 2, backgroundColor: c.ui.in2, marginTop: 4, marginBottom: 4, overflow: 'hidden' },
  normFill: { height: '100%', borderRadius: 2 },
  gridVal: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  gridKey: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },

  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[2] },

  nowCard: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], overflow: 'hidden' },
  // Kafelki dni jak mini-kafelki wyżej (2026-11-17, user: "czarne kafelki — za duży kontrast,
  // wyłamują się ze stylu"): jaśniejsze tło karty zamiast czarnego, bez obwódek; dziś = cienka ramka.
  dayRow: { backgroundColor: c.ui.in2, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing[3], gap: 4, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  dayToday: { borderColor: c.border.default },
  dayTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dayNameCol: { width: 64 },
  dayName: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
  dayDate: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  dayKind: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  dayTemps: { textAlign: 'right' },
  dayMax: { fontSize: 18, fontFamily: 'Inter_900Black', fontVariant: ['tabular-nums'] },
  dayMin: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  dayRain: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 64 + spacing[2] },
  dayRainTxt: { flex: 1, fontSize: 12, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: c.text.muted },

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
