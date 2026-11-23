import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import { MapPin, Navigation, RefreshCw, Search, Radar, ExternalLink, Droplets, Wind, Gauge, Sun, Sunrise, Sunset } from 'lucide-react-native';
import HourlyChart from './HourlyChart';
import WeeklyChart from './WeeklyChart';
import WeatherScene, { SKY } from './WeatherScene';
import { LinearGradient } from 'expo-linear-gradient';
import { SheetCard, Legend } from '@/components/design/SheetCard';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useWeatherStore } from '@/store/weatherStore';
import { refreshWeather } from '@/hooks/useWeather';
import { searchCity, type CityHit } from '@/services/weather';
import { weatherCodeInfo, aqiInfo, rainSummary, cloudSummary, weatherTip, fmtTemp, weatherToneKey, uvLabel, dayLength, humidityLabel, aqiAdvice, worstPollutant, AIR_NORMS } from '@/utils/weather';
import { haptic } from '@/utils/haptics';

// Układ 2026-11-22 (user: "pogodę zrobiłbym lepiej, brakuje inspiracji"): teraz → jedna karta
// "Szczegóły" (liczba + słowne znaczenie) → wykres 24 h (HourlyChart: krzywa temp., opady,
// chmury) → 7 dni (suchy dzień w jednej linii) → powietrze z paskiem "ile z normy" → radar.
// Szczegóły pogody (2026-11-13): teraz (odczuwalna/wilgotność/wiatr/ciśnienie/
// UV/wschód-zachód), 24 h godzina po godzinie (temp + szansa opadów), 7 dni,
// jakość powietrza z normami WHO, a na dole lokalizacja: GPS albo wyszukane
// miasto (config na samym dole — CLAUDE.md zasada 10).
const hm = (t: string) => t.slice(11, 16);

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
  const nowKey = cur ? weatherToneKey(cur.code, cur.isDay) : 'cloud';
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
          {/* Karta "teraz" w stylu kafla Dashboardu (2026-11-23, user: "jak się wchodzi, to ten sam
              styl"): odcień nieba (SKY) + animowana scena pixel-art zamiast ikony. */}
          <View style={s.nowCard}>
            <LinearGradient
              colors={[SKY[nowKey] + '45', SKY[nowKey] + '14', 'transparent']}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.nowRow}>
              <View style={s.scene} pointerEvents="none">
                <WeatherScene scene={nowKey} wind={Math.max(cur.wind, cur.gusts * 0.6)} px={4} inset={4} />
              </View>
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
            {/* Ogólna ocena powietrza na górze (2026-11-22) — szczegóły na dole panelu. */}
            {data!.air && (() => {
              const a = aqiInfo(data!.air!.aqi);
              const worst = worstPollutant(data!.air!);
              return (
                <View style={s.airTop}>
                  <View style={[s.airBadge, { backgroundColor: a.color + '26', borderColor: a.color + '66' }]}>
                    <View style={[s.airDot, { backgroundColor: a.color }]} />
                    <Text style={[s.airBadgeTxt, { color: a.color }]}>Powietrze {a.label}</Text>
                  </View>
                  <Text style={s.airAdvice} numberOfLines={2}>{aqiAdvice(data!.air!.aqi)}{worst ? ` · ${worst.label} ${worst.pct}% normy` : ''}</Text>
                </View>
              );
            })()}
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
          <SheetCard title="7 dni" right={<Legend items={[{ color: '#FB923C', label: 'dzień' }, { color: '#818CF8', label: 'noc' }, { color: colors.accent.blue, label: 'opad' }]} />}>
            <WeeklyChart days={data!.daily} />
            <Text style={s.note}>Stuknij dzień — pod wykresem pogoda i godziny opadów. Liczby nad = najcieplej w dzień, pod = najzimniej w nocy.</Text>
          </SheetCard>

          {/* Powietrze — szczegóły (2026-11-22, user: "ogólny score na górze, na dole szczegóły
              ładnie"): skala europejskiego indeksu ze znacznikiem + każdy składnik z paskiem
              "ile z normy WHO". */}
          {data!.air && (() => {
            const air = data!.air!;
            const a = aqiInfo(air.aqi);
            const scale = [['#22C55E', 20], ['#A3E635', 20], ['#FBBF24', 20], ['#F97316', 20], ['#EF4444', 20], ['#A855F7', 20]] as const;
            const pos = Math.min(100, (air.aqi / 120) * 100);
            return (
              <SheetCard title="Powietrze — szczegóły" right={<Text style={[s.airLabel, { color: a.color }]}>{air.aqi} · {a.label}</Text>}>
                <View style={s.aqiScale}>
                  {scale.map(([c], i) => <View key={i} style={{ flex: 1, backgroundColor: c, opacity: 0.85 }} />)}
                  <View style={[s.aqiMark, { left: `${pos}%` }]} />
                </View>
                <View style={s.aqiLabels}>
                  {['b. dobre', 'dobre', 'umiark.', 'złe', 'b. złe', 'fatalne'].map((l) => <Text key={l} style={s.aqiLab} numberOfLines={1}>{l}</Text>)}
                </View>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {AIR_NORMS.filter((n) => air[n.key] != null).map((n) => {
                    const v = air[n.key] as number;
                    const ratio = v / n.norm;
                    const col = ratio > 1 ? colors.accent.red : ratio > 0.7 ? colors.accent.orange : colors.accent.green;
                    return (
                      <View key={n.key} style={s.polRow}>
                        <Text style={s.polName}>{n.label}</Text>
                        <View style={s.polTrack}><View style={[s.polFill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: col }]} /></View>
                        <Text style={[s.polVal, ratio > 1 && { color: colors.accent.red }]}>{Math.round(v)}<Text style={s.polNorm}> / {n.norm}</Text></Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={s.note}>µg/m³ · pełny pasek = norma dobowa WHO; czerwone = powyżej normy.</Text>
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
  scene: { width: 92, height: 76, marginLeft: -4 },
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


  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[2] },

  nowCard: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], overflow: 'hidden' },
  // Kafelki dni jak mini-kafelki wyżej (2026-11-17, user: "czarne kafelki — za duży kontrast,
  // wyłamują się ze stylu"): jaśniejsze tło karty zamiast czarnego, bez obwódek; dziś = cienka ramka.

  airDot: { width: 8, height: 8, borderRadius: 4 },
  airTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.ui.line },
  airBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  airBadgeTxt: { fontSize: 11.5, fontFamily: 'Inter_900Black' },
  airAdvice: { flex: 1, fontSize: 11, lineHeight: 15, fontFamily: 'Inter_600SemiBold', color: c.text.secondary },
  aqiScale: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'visible', gap: 2 },
  aqiMark: { position: 'absolute', top: -4, width: 4, height: 16, marginLeft: -2, borderRadius: 2, backgroundColor: c.text.bright, borderWidth: 1, borderColor: c.bg.card },
  aqiLabels: { flexDirection: 'row', gap: 2, marginTop: 4 },
  aqiLab: { flex: 1, textAlign: 'center', fontSize: 9, fontFamily: 'Inter_700Bold', color: c.text.muted },
  polRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  polName: { width: 46, fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  polTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.ui.in2, overflow: 'hidden' },
  polFill: { height: '100%', borderRadius: 3 },
  polVal: { width: 64, textAlign: 'right', fontSize: 13, fontFamily: 'Inter_900Black', color: c.text.primary, fontVariant: ['tabular-nums'] },
  polNorm: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  airLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black' },
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
