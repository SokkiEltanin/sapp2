import { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Flame, Wallet, CheckSquare, PawPrint, Settings } from 'lucide-react-native';
import { spacing, radius, themedStyles } from '@/theme';

// Pasek zakładek — WŁASNY komponent (nie domyślny `Tabs` UI) dla pełnej kontroli nad
// wyglądem, ten sam wzorzec co w sapp. Przełączanie EKRANÓW jest tap-only, ZERO
// animacji przejścia (ustalone jako bezpieczny start — prawdziwy "jedzie za palcem"
// slide był w sapp udokumentowanym źródłem bugów/szarpania, bo wszystkie ciężkie
// ekrany zostają zamontowane naraz i muszą się przeliczać w trakcie animacji). TO
// pozostaje bez zmian. Osobna sprawa: samo PODŚWIETLENIE aktywnej ikony w navbarze —
// mała, tania mikro-animacja na jednym elemencie (nie cały ekran) — user: "navbar nie
// animowes... ma się tak ładnie podświetlenie" (2026-10-28). `TabIcon` niżej animuje
// skalę/opacity odznaki przy zmianie `active`, zero wpływu na politykę ekranów.
//
// Kolejność i pozycja (2026-10-26, NEXT_STEPS.md) — klaster ściśnięty do PRAWEJ
// krawędzi, nie pełna szerokość: prawy skraj = najbliżej kciuka = najkrótszy ruch, więc
// najczęściej używany ekran (Pupil) jest skrajnie po prawej, najrzadziej używany
// (Dashboard — i tak zawsze pierwszy po starcie appki) najdalej. "Notatki" z pierwotnej
// notatki w NEXT_STEPS.md zastąpione realnie istniejącym "Zadania" (ten sam slot w
// kolejności częstości). Ustawienia NIE są jedną z 5 głównych zakładek — osobny, mały
// przycisk w lewym dolnym rogu, z dala od klastra (wcześniej pływający na Dashboardzie,
// nachodził na kafelek pogody — przeniesiony tutaj na stałe).
//
// `label` zostaje w danych (accessibility), ale NIE renderuje się już jako tekst pod
// ikoną (2026-10-28, user podesłał dokładny Figma-reference navbaru: tylko ikony, bez
// etykiet — "nie sugeruj się ilością [ikon w ich przykładzie] tylko styl i kolory").
// `accent` per-zakładka USUNIĘTY — reference nie koloruje aktywnej ikony kolorem
// sekcji, tylko jasna neutralna odznaka + ciemna ikona (patrz `iconBadge`/
// `iconBadgeActive` niżej), ten sam monochromatyczny system wszędzie.
export const TABS = [
  { key: 'index', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'daily', label: 'Daily', icon: Flame },
  { key: 'finances', label: 'Finanse', icon: Wallet },
  { key: 'tasks', label: 'Zadania', icon: CheckSquare },
  { key: 'pupil', label: 'Pupil', icon: PawPrint },
] as const;

type TabIconProps = {
  Icon: (typeof TABS)[number]['icon'];
  isActive: boolean;
  activeIconColor: string;
  inactiveColor: string;
  badgeStyle: object;
  badgeActiveStyle: object;
};

// Odznaka pod ikoną wjeżdża/znika skalą+opacity zamiast twardego snapu
// (`useNativeDriver: true` — animuje się na wątku UI, tanie, nie dotyka layoutu reszty
// paska). Kolor samej ikony zostaje zmieniany od razu (bez cross-fade) — to świadomy,
// tańszy kompromis: dwie nakładające się ikony różnych kolorów byłyby bardziej
// "poprawne" wizualnie, ale dla 20px glifu różnica jest w praktyce niezauważalna, a
// kod dwa razy prostszy.
function TabIcon({ Icon, isActive, activeIconColor, inactiveColor, badgeStyle, badgeActiveStyle }: TabIconProps) {
  const progress = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isActive, progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  return (
    <View style={badgeStyle}>
      <Animated.View
        style={[StyleSheet.absoluteFill, badgeActiveStyle, { opacity: progress, transform: [{ scale }] }]}
      />
      <Icon size={20} color={isActive ? activeIconColor : inactiveColor} />
    </View>
  );
}

export default function TabBar({
  active,
  onPress,
  onSettingsPress,
}: {
  active: string;
  onPress: (key: string) => void;
  onSettingsPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { styles: s, inactiveColor, activeIconColor } = makeS();
  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + spacing[2] }]}>
      {/* Ustawienia + kreska-separator jako JEDNA grupa, żeby `justifyContent:
          'space-between'` na `wrap` rozdzielał tylko DWIE rzeczy (tę grupę i klaster
          zakładek), nie trzy — kreska wizualnie czyta się jako "to osobny przycisk,
          nie szósta zakładka", ale nadal żyje w tym samym pasku (user, 2026-10-27). */}
      <View style={s.settingsGroup}>
        <TouchableOpacity onPress={onSettingsPress} style={s.settingsBtn} activeOpacity={0.7}>
          <Settings size={17} color={inactiveColor} />
        </TouchableOpacity>
        <View style={s.divider} />
      </View>
      <View style={s.cluster}>
        {TABS.map((t) => {
          const isActive = t.key === active;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => onPress(t.key)}
              style={s.item}
              activeOpacity={0.7}
              accessibilityLabel={t.label}
            >
              <TabIcon
                Icon={Icon}
                isActive={isActive}
                activeIconColor={activeIconColor}
                inactiveColor={inactiveColor}
                badgeStyle={s.iconBadge}
                badgeActiveStyle={s.iconBadgeActive}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// `inactiveColor`/`activeIconColor` ŚWIADOMIE poza `StyleSheet.create` (nie-stylowe
// wartości w środku mieszałyby się z RN-ową walidacją obiektów stylów) —
// `themedStyles` nie wymusza że buduje WYŁĄCZNIE arkusz stylów, więc zwracamy je
// razem z jednego cache'u.
const makeS = themedStyles((c) => ({
  styles: StyleSheet.create({
    wrap: {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      backgroundColor: c.bg.elevated, borderTopWidth: 1, borderTopColor: c.border.default,
      paddingTop: spacing[2], paddingHorizontal: spacing[2],
    },
    settingsGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    // Tło + obramowanie jak karty/przyciski gdzie indziej w appce (np. Ustawienia same
    // w sobie) — żeby Ustawienia czytały się jako samodzielny przycisk, nie 6. zakładka
    // bez tła wtopiona w resztę klastra.
    settingsBtn: {
      width: 38, height: 38, borderRadius: radius.full,
      backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
      alignItems: 'center', justifyContent: 'center',
    },
    divider: { width: 1, height: 24, backgroundColor: c.border.default, marginLeft: spacing[2] },
    cluster: { flexDirection: 'row', gap: spacing[1] },
    item: { alignItems: 'center', justifyContent: 'center', minWidth: 46 },
    // Aktywna zakładka = JASNA, lekko zaokrąglona (nie pełne koło) odznaka pod ikoną +
    // ciemna ikona w środku (2026-10-28, dokładny Figma-reference navbaru podesłany
    // przez usera: `rx` odznaki ≈ 33% jej szerokości — zaokrąglony kwadrat, nie
    // pigułka/okrąg). Zastępuje poprzedni system kolorowania per-sekcja (każda
    // zakładka swoim akcentem) jednym spójnym, monochromatycznym traktowaniem —
    // user: "nie sugeruj się ilością, tylko styl i kolory" + wcześniejsze "pójdziemy
    // we wszystko jednolite".
    iconBadge: {
      width: 38, height: 38, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    // `borderRadius` zdublowany z `iconBadge` CELOWO — ten obiekt trafia też na
    // osobną `Animated.View` nałożoną przez `StyleSheet.absoluteFill` (animacja
    // skali/opacity w `TabIcon`), która nie dziedziczy zaokrąglenia rodzica.
    iconBadgeActive: { backgroundColor: c.text.primary, borderRadius: 13 },
  }),
  inactiveColor: c.text.secondary,
  activeIconColor: c.bg.primary,
}));
