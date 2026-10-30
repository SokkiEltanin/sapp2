import { View, Text, StyleSheet } from 'react-native';
import { Bell, MoreHorizontal, AlertTriangle } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';
import { cornersForPosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Kafelek "Zadania" — lista do 4 pozycji, każda z własnym tagiem po lewej. Monochromatyczny
// redesign (2026-10-30, user podesłał SVG-referencję) — USUNIĘTY gradient tła wiersza
// (kolorowany kolorem taga, fade w prawo); teraz płaskie, neutralne tło wiersza
// (`c.bg.card`). JEDYNY kolor który ZOSTAJE to sam chip taga — w referencyjnym SVG to
// jedyny nie-neutralny element całego designu (niebieski chip "UR"), więc to świadomie
// zachowany wyjątek, nie przeoczenie.
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
      {tag.kind === 'empty' && <MoreHorizontal size={11} color={fg} />}
      {tag.kind === 'bell' && <Bell size={11} color={fg} />}
      {tag.kind === 'urgent' && <AlertTriangle size={10} color={fg} fill={fg} strokeWidth={0} />}
    </View>
  );
}

function TaskRow({ task, isLast }: { task: Task; isLast: boolean }) {
  const s = makeS();
  return (
    <View style={[s.row, !isLast && s.rowGap]}>
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
  // przycina pierwszy/ostatni wiersz do właściwego kształtu automatycznie. Tło wiersza
  // PŁASKIE `c.bg.card` (2026-10-30, redesign — usunięty kolorowany gradient fade, patrz
  // komentarz przy imporcie).
  row: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: c.bg.card },
  rowGap: { marginBottom: 6 },
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
  //
  // Rozmiar PRZELICZONY względem realnie dostępnej wysokości wiersza, nie przepisany
  // 1:1 — realny root cause "chip wystaje poza kafelek" (2026-10-27, user): wysokość
  // 26 była WIĘKSZA niż faktyczna wysokość jednego wiersza (TILE_ROW_HEIGHT=120, minus
  // padding kafla ×2, minus 3 odstępy między wierszami, przez 4 wiersze ≈ 23.5px) —
  // chip dosłownie nie mieścił się w swoim wierszu. Wcześniej (mniejszy odstęp
  // międzywierszowy, 3px zamiast 6px) różnica była na tyle mała że niezauważalna;
  // runda 7 podbiła odstęp do 6px i dopiero wtedy przelało się to w realny,
  // widoczny overflow. 18 (zamiast 26) mieści się z zapasem, proporcja z Figmy
  // zachowana (~1.78:1 szerokość:wysokość, promień ~40% wysokości).
  chip: {
    width: 32, height: 18, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipLabel: { fontFamily: 'Inter_900Black', fontSize: 10 },
  // fontSize podbity względem chipa (2026-10-27, Figma: tytuł 40 vs tekst chipa 32 —
  // różnica 1.25×, u nas była za mała, 13.5 vs 11.5 ≈ 1.17×).
  title: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14.5, color: c.text.primary },
}));
