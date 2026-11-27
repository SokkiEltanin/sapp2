import { memo, useState } from 'react';
import { View, Animated, StyleSheet, type LayoutChangeEvent } from 'react-native';
import type { WeatherToneKey } from '@/utils/weather';
import { Pix, useLoop, wrap, useActive, rng, type Sprite, type Palette } from '@/components/design/pixelAnim';

// Scena pixel-art w kaflu pogody (2026-11-23, user: "kafel pogody bardziej wizualny, ale dalej
// minimalistyczny — żeby było wiadomo, że pada, wieje czy świeci słońce; pixel art, animacja,
// glassmorphism, bez lagów"). Własne sprite'y (bez pobranych grafik), każdy = JEDNO małe Svg
// z poziomymi odcinkami scalonymi w prostokąty (całe piksele = ostre krawędzie). Animacje: tylko transform/opacity
// wrapperów (Animated, native driver, CLAUDE.md zasada 6), 4 wspólne pętle; wszystko staje,
// gdy ekran nie ma fokusu, appka jest w tle albo system ma "ogranicz ruch".


const SUN_CORE: Sprite = [
  '..WWW..',
  '.WYYYY.',
  'WYYYYYO',
  'WYYYYYO',
  'YYYYYYO',
  '.YYYYO.',
  '..OOO..',
];
const SUN_RAYS: Sprite = [
  '......Y......',
  '......Y......',
  '.Y.........Y.',
  '..Y.......Y..',
  '.............',
  '.............',
  'YY.........YY',
  '.............',
  '.............',
  '..Y.......Y..',
  '.Y.........Y.',
  '......Y......',
  '......Y......',
];
const MOON: Sprite = [
  '...MMM..',
  '.MMMM...',
  'MMMM....',
  'MMMS....',
  'MMMS....',
  'MMMMS...',
  '.MMMMMMM',
  '...MMMM.',
];
const STAR: Sprite = ['.W.', 'WWW', '.W.'];
const CLOUD_BIG: Sprite = [
  '......LLLL......',
  '....LLLLLLLL....',
  '..LLLLLLLLLLLL..',
  '.LLLLLLLLLLLLLLL',
  'LLLLLLLLLLLLLLLL',
  'GLLLLLLLLLLLLLLG',
  '.GGGGGGGGGGGGGG.',
];
const CLOUD_SMALL: Sprite = [
  '...LLLL....',
  '.LLLLLLLL..',
  'LLLLLLLLLLL',
  'GLLLLLLLLLG',
  '.GGGGGGGGG.',
];
const FLAKE: Sprite = ['.W.', 'WWW', '.W.'];
const FLAKE_DOT: Sprite = ['WW', 'WW'];
const BOLT: Sprite = ['..YY', '.YY.', 'YYYY', '..YY', '.YY.', '.Y..'];
const FOG: Sprite = ['LLLLLL..LLLLLLLLL...LLLL'];


const SUN_P: Palette = { Y: '#FBBF24', O: '#F59E0B', W: '#FDE68A' };
const MOON_P: Palette = { M: '#E0E7FF', S: '#A5B4FC' };
const STAR_P: Palette = { W: '#E0E7FF' };
const CLOUD_LIGHT: Palette = { L: '#E5E7EB', G: '#9CA3AF' };
const CLOUD_GRAY: Palette = { L: '#9CA3AF', G: '#6B7280' };
const CLOUD_DARK: Palette = { L: '#6B7280', G: '#4B5563' };
// Deszcz (2026-11-27, user: "bardziej realistyczny, intensywność zależnie od realnej"): smuga = kolumna
// pikseli, jaśniejszy czubek; bliższe krople dłuższe, jaśniejsze i szybsze, dalsze krótkie i blade.
const RAIN_NEAR = { head: '#DBEAFE', body: '#93C5FD' };
const RAIN_FAR = { head: '#93C5FD', body: '#60A5FA' };
const SPLASH: Sprite = ['b...b', '.b.b.'];
const SPLASH_P: Palette = { b: '#BFDBFE' };
const FLAKE_P: Palette = { W: '#F8FAFC' };
const BOLT_P: Palette = { Y: '#FDE047' };
const FOG_P: Palette = { L: '#94A3B8' };
const WIND_P: Palette = { W: 'rgba(255,255,255,0.5)' };







/** `px` = rozmiar piksela (domyślnie z wymiarów), `inset` = odstęp od prawej/górnej krawędzi.
 *  Używane w kaflu Dashboardu i w karcie "teraz" okna pogody (ten sam styl, 2026-11-23). */
/** `intensity` 0..1 = natężenie opadu z prognozy (utils/weather.ts `precipIntensity`); brak = typowe dla sceny. */
export default memo(function WeatherScene({ scene, wind, px: pxFixed, inset = 10, intensity }: { scene: WeatherToneKey; wind: number; px?: number; inset?: number; intensity?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const run = useActive() && !!size;
  const rainyScene = scene === 'drizzle' || scene === 'rain' || scene === 'heavy' || scene === 'storm' || scene === 'freezing';
  const k = Math.min(1, Math.max(0, intensity ?? (scene === 'drizzle' ? 0.2 : scene === 'heavy' || scene === 'storm' ? 0.85 : scene === 'freezing' ? 0.35 : 0.45)));
  // Tempo spadania rośnie z natężeniem (mżawka ~1,5 s, ulewa ~0,5 s); zaokrąglone do 50 ms (bez restartów pętli).
  const q50 = (ms: number) => Math.round(ms / 50) * 50;
  const nearMs = q50(scene === 'drizzle' ? 1500 : 1050 - 500 * k);
  const fast = useLoop(nearMs, run && rainyScene);
  const slow = useLoop(5200, run, true);
  const snowT = useLoop(3400, run);
  const blink = useLoop(2600, run);
  // Tempo jak wiatr (2026-11-24, user: "im szybciej wieje, tym szybciej to postępuje"): 25 km/h = 1×,
  // 50 km/h = 2×, max 2,6× — podmuchy lecą i fala przełamania biegnie szybciej, deszcz i śnieg mocniej
  // znosi w bok. Zaokrąglone do 50 ms, żeby drobna zmiana wiatru nie restartowała pętli.
  const windK = Math.min(2.6, Math.max(1, wind / 25));
  const wq = (ms: number) => Math.round(ms / windK / 50) * 50;
  const windT = useLoop(wq(1800), run && wind >= 25);
  // drugie tempo dla części cząstek — nie lecą wszystkie w jednym rytmie
  const fast2 = useLoop(q50(nearMs * 1.18), run && rainyScene);
  const farT = useLoop(q50(nearMs * 1.45), run && rainyScene);
  const snowT2 = useLoop(4600, run && (scene === 'snow' || scene === 'freezing'));
  const windT2 = useLoop(wq(2600), run && wind >= 25);
  // "żywy" wiatr: fala przełamania biegnąca wzdłuż podmuchu
  const waveT = useLoop(wq(1100), run && wind >= 25);
  const waveT2 = useLoop(wq(1600), run && wind >= 25);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  };
  if (!size) return <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" />;

  const { w, h } = size;
  const px = pxFixed ?? Math.max(2, Math.round(Math.min(w / 42, h / 26)));
  const right = inset;
  const top = Math.max(2, inset - 2);
  const cloudW = CLOUD_BIG[0].length * px;
  const cloudH = CLOUD_BIG.length * px;
  const cloudX = w - right - cloudW;

  const sun = scene === 'sun' || scene === 'partly';
  const moon = scene === 'night' || scene === 'partlyNight';
  const cloudy = !(scene === 'sun' || scene === 'night');
  const rainy = scene === 'drizzle' || scene === 'rain' || scene === 'heavy' || scene === 'storm' || scene === 'freezing';
  const snowy = scene === 'snow' || scene === 'freezing';
  const cloudP = scene === 'storm' || scene === 'heavy' ? CLOUD_DARK : scene === 'partly' || scene === 'partlyNight' ? CLOUD_LIGHT : CLOUD_GRAY;
  // Ile kropli: od kilku (mżawka 0,1 mm/h) do gęstej ściany (ulewa 10+ mm/h).
  const drops = rainy ? Math.round((scene === 'freezing' ? 3 : 5) + (scene === 'freezing' ? 6 : 21) * k) : 0;
  const flakes = scene === 'snow' ? Math.round(6 + 12 * k) : scene === 'freezing' ? 4 : 0;
  // Z opadem chmura przy samej górze, żeby krople miały drogę nad tekstem.
  const cloudY = rainy || snowy ? top - px : top + px * 3;
  const fallTo = Math.max(px * 8, h * 0.72 - (cloudY + cloudH));
  // deszcz leci niżej niż śnieg (gaśnie nad dolnym wierszem tekstu)
  const rainFall = Math.max(px * 8, h * 0.8 - (cloudY + cloudH));

  const r = rng(scene.length * 7919 + drops * 31 + flakes);
  const between = (a: number, b: number) => a + (b - a) * r();
  // Cząstki drobniejsze niż chmura (2026-11-24, user: "płatki ogromne względem chmur"):
  // własny piksel ≈ połowa piksela sceny.
  const pp = Math.max(1, Math.floor(px / 2));
  const rainSlant = wind >= 25 ? px * 2 * windK : px * 0.6;
  const snowDrift = wind >= 25 ? px * 2 * windK : 0;
  const drizzle = scene === 'drizzle';
  const smallCloudX = cloudX - px * 7;
  const rain = Array.from({ length: drops }, (_, i) => {
    const far = i % 3 === 2;                       // co trzecia kropla "dalej": krótsza, bledsza, wolniejsza
    const fromSmall = scene !== 'partly' && r() < 0.25; // część spod małej chmury
    const x0 = fromSmall ? smallCloudX + px : cloudX + px;
    const x1 = fromSmall ? smallCloudX + px * 10 : cloudX + cloudW - px * 2;
    // długość smugi w pikselach: mżawka 1–2, deszcz 3–5, ulewa do 7
    const lenPx = drizzle ? (far ? 1 : 2) : Math.round((far ? 2 : 3) + (far ? 2 : 4) * k * between(0.7, 1.15));
    return {
      x: Math.round(between(x0, x1)), y0: Math.round(between(0, px * 3)) - (fromSmall ? px * 3 : 0),
      ph: r(), slow: r() < 0.45, far, lenPx: Math.max(1, lenPx),
      len: between(0.75, 1), slant: rainSlant * between(0.6, 1.2) * (far ? 0.8 : 1),
      splash: !drizzle && !far && k >= 0.3 && r() < 0.6,
    };
  });
  const snow = Array.from({ length: flakes }, () => {
    const amp = px * between(0.8, 2.4) * (r() < 0.5 ? -1 : 1);
    const turns = r() < 0.5 ? 1 : 2;
    const swayIn = turns === 1 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
    // kołysanie + znoszenie w bok proporcjonalne do wiatru
    const swayOut = swayIn.map((t, k) => [0, amp, 0, -amp][k % 4] + snowDrift * t);
    return {
      x: Math.round(between(cloudX - px, cloudX + cloudW - px)),
      y0: Math.round(between(0, px * 4)),
      ph: r(), slow: r() < 0.5, len: between(0.65, 1), big: r() < 0.35, swayIn, swayOut,
    };
  });
  // wiatr na całym kafelku (2026-11-24, user: "na całym kafelku mi się podobał")
  // Podmuch = linia z odcinków (2026-11-24, user: "wiatr z segmentów, które zmieniają się w punkcie
  // przełamania, jakby były żywe: _____ → ____- → ___--- → ------_"): każdy odcinek przeskakuje
  // między dwoma poziomami, prawe wcześniej niż lewe → próg wędruje wzdłuż linii.
  const gusts = wind >= 25 ? Array.from({ length: wind >= 45 ? 5 : 4 }, () => ({
    y: Math.round(between(h * 0.06, h * 0.82)), ph: r(), slow: r() < 0.5, op: between(0.45, 0.9),
    n: 7 + Math.floor(r() * 7), wph: r(), wslow: r() < 0.5, span: between(0.45, 0.9),
  })) : [];
  const segW = pp * 2;

  const drift = (amp: number) => ({ transform: [{ translateX: slow.interpolate({ inputRange: [0, 1], outputRange: [-amp, amp] }) }] });

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {/* słońce: promienie pulsują, tarcza lekko "oddycha" */}
      {sun && (
        <View style={{ position: 'absolute', right: scene === 'partly' ? right + cloudW * 0.45 : right, top }}>
          <Animated.View style={{ opacity: slow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }}>
            <Pix sprite={SUN_RAYS} palette={SUN_P} px={px} />
          </Animated.View>
          <View style={{ position: 'absolute', left: px * 3, top: px * 3 }}>
            <Pix sprite={SUN_CORE} palette={SUN_P} px={px} />
          </View>
        </View>
      )}

      {/* księżyc + migające gwiazdy */}
      {moon && (
        <>
          <View style={{ position: 'absolute', right: scene === 'partlyNight' ? right + cloudW * 0.5 : right + px * 2, top: top + px }}>
            <Pix sprite={MOON} palette={MOON_P} px={px} />
          </View>
          {[[0.18, 0.1, 0], [0.42, 0.22, 0.33], [0.3, 0.42, 0.66], [0.55, 0.06, 0.5]].map(([fx, fy, ph], i) => (
            <Animated.View key={i} style={{ position: 'absolute', left: w * fx, top: h * fy, opacity: wrap(blink, ph, 0, 1).interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] }) }}>
              <Pix sprite={STAR} palette={STAR_P} px={Math.max(1, px - 1)} />
            </Animated.View>
          ))}
        </>
      )}

      {/* mgła: dwa pasy płyną w przeciwne strony */}
      {scene === 'fog' && [0.3, 0.46].map((fy, i) => (
        <Animated.View key={i} style={[{ position: 'absolute', right: right - px * 2, top: h * fy, opacity: 0.7 }, drift(i ? -px * 3 : px * 3)]}>
          <Pix sprite={FOG} palette={FOG_P} px={px} />
        </Animated.View>
      ))}

      {/* deszcz pod chmurą (rysowany przed chmurą, żeby krople wychodziły spod niej) */}
      {rain.map((d, i) => {
        const prog = wrap(d.far ? farT : d.slow ? fast2 : fast, d.ph, 0, 1);
        const col = d.far ? RAIN_FAR : RAIN_NEAR;
        const dropW = drizzle ? pp : Math.max(1, Math.round(pp * (d.far ? 0.75 : 1)));
        const fall = rainFall * d.len;
        const top0 = cloudY + cloudH - px * 2 + d.y0;
        return (
          <View key={`d${i}`} style={{ position: 'absolute', left: d.x, top: top0 }}>
            <Animated.View style={{
              transform: [
                { translateY: prog.interpolate({ inputRange: [0, 1], outputRange: [0, fall] }) },
                { translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [0, d.slant] }) },
              ],
              opacity: prog.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, d.far ? 0.5 : 0.95, d.far ? 0.4 : 0.8, 0] }),
            }}>
              <View style={{ width: dropW, height: pp, backgroundColor: col.head }} />
              <View style={{ width: dropW, height: pp * Math.max(0, d.lenPx - 1), backgroundColor: col.body }} />
            </Animated.View>
            {d.splash && (
              // rozprysk tam, gdzie kropla kończy lot: krótki błysk dwóch kropelek
              <Animated.View style={{
                position: 'absolute', left: d.slant - pp * 2, top: fall + pp * d.lenPx,
                opacity: prog.interpolate({ inputRange: [0, 0.9, 0.94, 1], outputRange: [0, 0, 0.85, 0] }),
                transform: [{ translateY: prog.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0, 0, -pp] }) }],
              }}>
                <Pix sprite={SPLASH} palette={SPLASH_P} px={pp} />
              </Animated.View>
            )}
          </View>
        );
      })}
      {snow.map((f, i) => {
        const prog = wrap(f.slow ? snowT2 : snowT, f.ph, 0, 1);
        return (
          <Animated.View key={`f${i}`} style={{
            position: 'absolute', left: f.x, top: cloudY + cloudH - px * 2 + f.y0,
            transform: [
              { translateY: prog.interpolate({ inputRange: [0, 1], outputRange: [0, fallTo * f.len] }) },
              // własne kołysanie każdego płatka (amplituda, kierunek, ile zakosów)
              { translateX: prog.interpolate({ inputRange: f.swayIn, outputRange: f.swayOut }) },
            ],
            opacity: prog.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.85, 0.1] }),
          }}>
            <Pix sprite={f.big ? FLAKE : FLAKE_DOT} palette={FLAKE_P} px={pp} />
          </Animated.View>
        );
      })}

      {/* błysk */}
      {scene === 'storm' && (
        <Animated.View style={{
          position: 'absolute', left: cloudX + cloudW * 0.45, top: cloudY + cloudH - px,
          opacity: blink.interpolate({ inputRange: [0, 0.7, 0.72, 0.78, 0.8, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
        }}>
          <Pix sprite={BOLT} palette={BOLT_P} px={px} />
        </Animated.View>
      )}

      {/* chmury: duża + mała, płyną powoli */}
      {cloudy && scene !== 'fog' && (
        <>
          {scene !== 'partly' && scene !== 'partlyNight' && (
            <Animated.View style={[{ position: 'absolute', left: cloudX - px * 7, top: Math.max(2, cloudY - px * 3), opacity: 0.75 }, drift(-px * 2)]}>
              <Pix sprite={CLOUD_SMALL} palette={cloudP} px={px} />
            </Animated.View>
          )}
          <Animated.View style={[{ position: 'absolute', left: cloudX, top: scene === 'partly' || scene === 'partlyNight' ? cloudY + px * 4 : cloudY }, drift(px * 2)]}>
            <Pix sprite={CLOUD_BIG} palette={cloudP} px={px} />
          </Animated.View>
        </>
      )}

      {/* wiatr (≥ 25 km/h): smugi przelatują przez scenę */}
      {gusts.map((g, i) => {
        const prog = wrap(g.slow ? windT2 : windT, g.ph, 0, 1);
        const wv = g.wslow ? waveT2 : waveT;
        return (
          <Animated.View key={`w${i}`} style={{
            position: 'absolute', left: 0, top: g.y, width: g.n * segW, height: pp * 3,
            // pojawia się, płynie i gaśnie — jak podmuch, nie jak taśma
            opacity: prog.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, g.op, g.op, 0] }),
            transform: [{ translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [-g.n * segW, w] }) }],
          }}>
            {Array.from({ length: g.n }, (_, k) => (
              <Animated.View key={k} style={{
                position: 'absolute', left: k * segW, top: pp * 2, width: segW, height: pp, backgroundColor: WIND_P.W,
                // skok (nie płynnie) między poziomami — pixel art; prawe odcinki przeskakują pierwsze
                transform: [{ translateY: wrap(wv, (g.wph + (k / Math.max(1, g.n - 1)) * g.span) % 1, 0, 1).interpolate({
                  inputRange: [0, 0.5, 0.5001, 1], outputRange: [0, 0, -pp * 2, -pp * 2],
                }) }],
              }} />
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
});

/** Tło "nieba" kafla — półprzezroczysty odcień pod szkło (bez blur, który na Androidzie laguje). */
export const SKY: Record<WeatherToneKey, string> = {
  sun: '#F59E0B', night: '#6366F1', partly: '#F59E0B', partlyNight: '#6366F1', cloud: '#9CA3AF',
  fog: '#94A3B8', drizzle: '#38BDF8', rain: '#3B82F6', heavy: '#2563EB', freezing: '#22D3EE', snow: '#CBD5E1', storm: '#8B5CF6',
};
