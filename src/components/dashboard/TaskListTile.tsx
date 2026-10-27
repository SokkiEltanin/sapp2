import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, MoreHorizontal, AlertTriangle } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';
import { cornersForPosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Kafelek "Zadania" — lista do 4 pozycji, każda z własnym tagiem po lewej (kolor taga =
// kolor gradientu tła tego wiersza, fade do 0% w prawo, cała warstwa na 20% opacity —
// ten sam wzorzec co StatTile/PatternTileBackground).
//
// System tagów (2026-10-27, user): dowolny skrót (#UR, #PW, przyszłe inne) → chip z
// tym tekstem; BRAK taga → pusty chip z kropeczkami; PILNE → czerwony chip z
// wykrzyknikiem (niezależnie od tego czy ma nazwany tag — osobny stan). `label.text`
// jest dowolnym stringiem, więc nowe skróty (PW itp.) nie wymagają zmian w kodzie,
// tylko w danych.
export type TaskTag =
  | { kind: 'empty' }
  | { kind: 'label'; text: string; color: string }
  | { kind: 'urgent' }
  | { kind: 'bell'; color: string };

export type Task = { id: string; title: string; tag: TaskTag };

function tagColor(tag: TaskTag): string {
  switch (tag.kind) {
    case 'label': return tag.color;
    case 'bell': return tag.color;
    case 'urgent': return colors.accent.red;
    case 'empty': default: return colors.chart.muted;
  }
}

// Treść chipa (tekst/ikona) jest BIAŁA na ciemnych/nasyconych tłach (label dowolnego
// koloru, szary "brak taga") i CZARNA na jasnych (bell = złoty event-color, urgent =
// czerwony — ten drugi to świadomie "znak ostrzegawczy" czarny-na-czerwonym, nie błąd).
// Wcześniej WSZYSTKIE chipy miały twardo zakodowany prawie-czarny tekst (#0B0E14) — na
// ciemnoniebieskim/szarym tle "UR" i kropeczki były praktycznie nieczytelne
// (2026-10-27, user mockup pokazuje wyraźny biały tekst na niebieskim).
function chipContentColor(tag: TaskTag): string {
  return tag.kind === 'bell' || tag.kind === 'urgent' ? '#0B0E14' : '#FFFFFF';
}

function TagChip({ tag }: { tag: TaskTag }) {
  const s = makeS();
  const bg = tagColor(tag);
  const fg = chipContentColor(tag);
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      {tag.kind === 'label' && (
        <Text
          style={[s.chipLabel, { color: fg }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {tag.text}
        </Text>
      )}
      {tag.kind === 'empty' && <MoreHorizontal size={15} color={fg} />}
      {tag.kind === 'bell' && <Bell size={15} color={fg} />}
      {tag.kind === 'urgent' && <AlertTriangle size={14} color={fg} fill={fg} strokeWidth={0} />}
    </View>
  );
}

function TaskRow({ task, isLast }: { task: Task; isLast: boolean }) {
  const s = makeS();
  const gradientColor = tagColor(task.tag);
  return (
    <View style={[s.row, !isLast && s.rowGap]}>
      <LinearGradient
        colors={[gradientColor, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.gradient}
      />
      <View style={s.rowContent}>
        <TagChip tag={task.tag} />
        <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {task.title}
        </Text>
      </View>
    </View>
  );
}

export default function TaskListTile({
  position,
  tasks,
}: {
  position: StatTilePosition;
  tasks: Task[];
}) {
  const s = makeS();
  return (
    <View style={[s.tile, cornersForPosition(position)]}>
      {tasks.map((t, i) => (
        <TaskRow key={t.id} task={t} isLast={i === tasks.length - 1} />
      ))}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  // Tło kontenera TRANSPARENTNE (2026-10-27, user mockup: wiersze "pływają" luzem na
  // czarnym tle ekranu, nie siedzą na wspólnej karcie) — każdy wiersz niesie WŁASNY
  // kolor/zaokrąglenie, odstęp między nimi ma pokazywać czarne tło pod spodem, nie
  // `c.bg.card`. Mały `padding` zostaje, żeby duże zaokrąglenie zewnętrznych rogów
  // kafla (pierwszy/ostatni wiersz) nie "odgryzało" chipa taga.
  tile: {
    flex: 3, height: TILE_ROW_HEIGHT, backgroundColor: 'transparent', overflow: 'hidden',
    padding: 4,
  },
  // Każdy wiersz to osobny, zaokrąglony ze WSZYSTKICH stron segment z wyraźnym odstępem
  // do następnego (nie ciągły blok z cienkimi liniami-dzielnikami) — jak w mockupie
  // usera. Zewnętrzny `tile` (overflow: hidden + zaokrąglenie skrajnych krawędzi)
  // przycina pierwszy/ostatni wiersz do właściwego kształtu automatycznie.
  row: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  rowGap: { marginBottom: 6 },
  // Opacity WYŻSZA niż na reszcie dashboardu (tam 0.2) — celowo. Kolor taga (np. #1B36AF,
  // ciemny granat dobrany pod CZYTELNY biały tekst na chipie) jest dużo ciemniejszy niż
  // jasne akcenty kafli statystyk (np. #5AAFFA WODA) — przy tych samych 20% nad czarnym
  // tłem robi się praktycznie niewidoczny (user porównał z Figmą: u niego wiersz ma
  // wyraźnie widoczny kolor, u nas wychodził prawie czarny pasek z samym chipem).
  gradient: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  rowContent: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[2],
  },
  // JEDEN stały kształt dla WSZYSTKICH 4 stanów taga (2026-10-27, user podesłał
  // dokładne wymiary z Figmy: chip 89×50, corner radius 20 — proporcja ~1.78:1,
  // promień ~40% wysokości). To ZAOKRĄGLONY PROSTOKĄT, nie pełna "pigułka"/okrąg —
  // poprzednia wersja miała DWA różne kształty (rosnąca pigułka dla `label`, stały
  // okrąg dla `empty`/`bell`/`urgent`) i borderRadius:999 (pełne zaokrąglenie) —
  // oba te założenia były błędne względem źródła.
  chip: {
    width: 46, height: 26, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipLabel: { fontFamily: 'Inter_900Black', fontSize: 11.5 },
  // fontSize podbity względem chipa (2026-10-27, Figma: tytuł 40 vs tekst chipa 32 —
  // różnica 1.25×, u nas była za mała, 13.5 vs 11.5 ≈ 1.17×).
  title: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14.5, color: c.text.primary },
}));
