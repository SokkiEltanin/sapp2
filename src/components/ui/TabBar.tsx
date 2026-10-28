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
// pozostaje bez zmian. Osobna sprawa: samo PODŚWIETLENIE aktywnej ikony — mała, tania
// mikro-animacja na jednym elemencie (nie cały ekran). `TabIcon` niżej animuje
// skalę/opacity odznaki przy zmianie `active`, zero wpływu na politykę ekranów.
//
// PRAWDZIWIE PŁYWAJĄCY układ (2026-10-28, user podesłał dokładny Figma-reference:
// "to był floating navbar... ikona ustawień była osobno" — poprzednia wersja miała
// Ustawienia i klaster zakładek w JEDNYM wspólnym tle/pasku rozdzielonym kreską, co
// NIE jest tym samym co dwa w pełni osobne, pływające elementy). Teraz: `settingsBtn`
// (okrągły przycisk) i `cluster` (zaokrąglona karta z ikonami) to DWA niezależne
// elementy bez wspólnego tła/paska łączącego je — oba leżą bezpośrednio na tle ekranu,
// z marginesem od dołu/krawędzi, żadnej kreski-separatora (nie jest już potrzebna,
// skoro są wizualnie w pełni rozdzielone).
//
// Kolejność i pozycja (2026-10-26, NEXT_STEPS.md) — klaster ściśnięty do PRAWEJ
// krawędzi, nie pełna szerokość: prawy skraj = najbliżej kciuka = najkrótszy ruch, więc
// najczęściej używany ekran (Pupil) jest skrajnie po prawej, najrzadziej używany
// (Dashboard — i tak zawsze pierwszy po starcie appki) najdalej. "Notatki" z pierwotnej
// notatki w NEXT_STEPS.md zastąpione realnie istniejącym "Zadania" (ten sam slot w
// kolejności częstości).
//
// `label` zostaje w danych (accessibility), ale NIE renderuje się już jako tekst pod
// ikoną — reference: tylko ikony, bez etykiet ("nie sugeruj się ilością [ikon w ich
// przykładzie] tylko styl i kolory"). `accent` per-zakładka USUNIĘTY — reference nie
// koloruje aktywnej ikony kolorem sekcji, tylko BIAŁA odznaka + ciemna ikona (patrz
// `iconBadgeActive` niżej — `#FFFFFF` dosłownie, nie `c.text.primary`, user: "miało
// być białe tło a nie ma").
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
    <View style={[s.wrap, { paddingBottom: insets.bottom + spacing[2] }]} pointerEvents="box-none">
      <TouchableOpacity onPress={onSettingsPress} style={s.settingsBtn} activeOpacity={0.7}>
        <Settings size={17} color={inactiveColor} />
      </TouchableOpacity>
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
    // BEZ tła/obramowania/paddingu-poziomego na poziomie całego paska (2026-10-28) —
    // `wrap` jest już tylko bezbarwnym kontenerem pozycjonującym dwa osobne, pływające
    // elementy (`settingsBtn`, `cluster`) na dole ekranu, nie wspólną "szybą" spod
    // której by wystawały. `pointerEvents="box-none"` na komponencie, żeby pusta
    // przestrzeń MIĘDZY dwoma elementami nie blokowała dotyku treści pod spodem.
    wrap: {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      paddingHorizontal: spacing[3], paddingTop: spacing[2],
    },
    // Okrągły przycisk Ustawień — w PEŁNI osobny pływający element (nie część
    // wspólnego paska), własny cień żeby czytał się jako uniesiony nad tłem.
    settingsBtn: {
      width: 44, height: 44, borderRadius: radius.full,
      backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
      elevation: 6,
    },
    // Karta-pigułka z klastrem zakładek — DRUGI, osobny pływający element, w pełni
    // zaokrąglony (`radius.full` na wysokości ~56 = stadium/pigułka, nie zaokrąglony
    // prostokąt), własny cień tak samo jak `settingsBtn` dla spójnego "unoszenia się".
    cluster: {
      flexDirection: 'row', gap: spacing[1],
      backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
      borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[1],
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
      elevation: 6,
    },
    item: { alignItems: 'center', justifyContent: 'center', minWidth: 46 },
    // Aktywna zakładka = BIAŁE KÓŁKO pod ikoną + ciemna ikona w środku (2026-10-28,
    // user po teście na urządzeniu: "zmień je na KÓŁKO zamiast prostokąta
    // zaokrąglonego" — poprawka Figma-referencji z wcześniej tego dnia, która miała
    // `rx` ≈ 33% szerokości, zaokrąglony kwadrat). Jeden spójny, monochromatyczny
    // system zamiast kolorowania per-sekcja.
    iconBadge: {
      width: 38, height: 38, borderRadius: radius.full,
      alignItems: 'center', justifyContent: 'center',
    },
    // `#FFFFFF` DOSŁOWNIE, nie `c.text.primary` (#D6D6D6, lekko szarawy) — user: "miało
    // być białe tło a nie ma". `borderRadius` zdublowany z `iconBadge` CELOWO — ten
    // obiekt trafia też na osobną `Animated.View` nałożoną przez
    // `StyleSheet.absoluteFill` (animacja skali/opacity w `TabIcon`), która nie
    // dziedziczy zaokrąglenia rodzica.
    iconBadgeActive: { backgroundColor: '#FFFFFF', borderRadius: radius.full },
  }),
  inactiveColor: c.text.secondary,
  activeIconColor: c.bg.primary,
}));
