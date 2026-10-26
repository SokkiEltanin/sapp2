import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, MoreHorizontal } from 'lucide-react-native';
import { spacing, themedStyles } from '@/theme';
import { cornersForPosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Kafelek "Zadania" (2026-10-26) — lista do 4 pozycji, każda z własnym tagiem po lewej
// (kolor taga = kolor gradientu tła tego wiersza, fade do 0% w prawo — user: "gradient
// od niebieskiego do 0 transparent"). Cała warstwa gradientu na 20% opacity — ten sam
// wzorzec co StatTile/PatternTileBackground (user poprawił 2026-10-26: pierwsza wersja
// miała gradient na pełnej sile, niespójnie z resztą kafli). Tylko kolor taga UR
// (#1B36AF) był podany wprost w mockupie; kolory dla "..." i dzwonka to przybliżenie
// z istniejącej palety (NEXT_STEPS.md).
export type TaskTag =
  | { kind: 'label'; text: string; color: string }
  | { kind: 'dots'; color: string }
  | { kind: 'bell'; color: string };

export type Task = { id: string; title: string; tag: TaskTag };

function TagChip({ tag }: { tag: TaskTag }) {
  const s = makeS();
  return (
    <View style={[s.chip, { backgroundColor: tag.color }]}>
      {tag.kind === 'label' && <Text style={s.chipLabel}>{tag.text}</Text>}
      {tag.kind === 'dots' && <MoreHorizontal size={14} color="#0B0E14" />}
      {tag.kind === 'bell' && <Bell size={14} color="#0B0E14" />}
    </View>
  );
}

function TaskRow({ task, isLast }: { task: Task; isLast: boolean }) {
  const s = makeS();
  return (
    <View style={[s.row, !isLast && s.rowGap]}>
      <LinearGradient
        colors={[task.tag.color, 'transparent']}
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
  tile: { flex: 3, height: TILE_ROW_HEIGHT, backgroundColor: c.bg.card, overflow: 'hidden' },
  // Każdy wiersz to osobny, lekko zaokrąglony segment z odstępem do następnego (nie
  // ciągły blok z cienkimi liniami-dzielnikami jak w pierwszej wersji) — tak jak w
  // mockupie usera. Zewnętrzny `tile` (overflow: hidden + zaokrąglenie skrajnych
  // krawędzi) przycina pierwszy/ostatni wiersz do właściwego kształtu automatycznie.
  row: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  rowGap: { marginBottom: 3 },
  gradient: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
  rowContent: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[2],
  },
  chip: {
    minWidth: 26, height: 20, borderRadius: 999, paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  chipLabel: { fontFamily: 'Inter_900Black', fontSize: 9, color: '#0B0E14' },
  title: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 13, color: c.text.primary },
}));
