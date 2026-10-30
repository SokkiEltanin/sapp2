import { View, Text, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { themedStyles } from '@/theme';
import { cornersForPosition, getTilePosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Monochromatyczny redesign (2026-10-30, user podesłał dokładny SVG-referencję:
// "wywaliłem gradienty i poprawiłem monochromatyczność... taki styl przyjmujemy dla
// całej aplikacji") — ZASTĘPUJE poprzedni wzorzec "jeden kolor akcentu na kategorię,
// użyty i w tekście, i w gradiencie tła". Teraz: płaskie tło `c.bg.card`, liczba
// `c.text.bright`, etykieta/jednostka `c.text.secondary` — bez per-kategoria
// kolorowania. `accent` (prop) USUNIĘTY z API — nic go już tu nie używa. Reguła
// zaokrąglania (tylko skrajne krawędzie rzędu) — patrz `tilePosition.ts`, wspólna z
// PatternTileBackground.
export type { StatTilePosition };
export { getTilePosition };

type BaseProps = {
  position: StatTilePosition;
  value: string;
};

type StatProps = BaseProps & {
  variant?: 'stat';
  unit: string;
  label: string;
};

type EventProps = BaseProps & {
  variant: 'event';
  unit: string;
  detail: string; // multi-line, \n-separated — Inter Medium (węższy, więcej się mieści)
};

type WeatherProps = BaseProps & {
  variant: 'weather';
  icon: ReactNode; // np. <CloudSun /> z lucide-react-native, duża, w dolnej części kafla
};

export type StatTileProps = StatProps | EventProps | WeatherProps;

export default function StatTile(props: StatTileProps) {
  const s = makeS();
  const { position, value } = props;

  return (
    <View style={[s.tile, cornersForPosition(position)]}>
      <View style={s.content}>
        <Text style={s.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {value}
        </Text>
        {props.variant === 'weather' ? (
          <View style={s.weatherIconWrap}>{props.icon}</View>
        ) : (
          <>
            <Text style={s.unit} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {props.unit}
            </Text>
            {props.variant === 'event' ? (
              <Text style={s.detail} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                {props.detail}
              </Text>
            ) : (
              // `numberOfLines`: 2 TYLKO gdy etykieta ma jawny `\n` (np. "DZIENNIE\n#JEDZENIE"
              // w Finansach — to CELOWY dwuwiersz). Dla zwykłej jednowyrazowej nazwy
              // kategorii (WODA/SŁODYCZE/ĆWICZENIA) wymuszamy 1 linię, żeby
              // `adjustsFontSizeToFit` ZMNIEJSZAŁ czcionkę zamiast zawijać do brzydkiego
              // drugiego wiersza z jedną sierotą-literą (user: "ĆWICZENIA wypierdzielaj
              // się dziwnie", 2026-10-27).
              <Text
                style={s.label}
                numberOfLines={props.label.includes('\n') ? 2 : 1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {props.label}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  tile: {
    flex: 1,
    height: TILE_ROW_HEIGHT,
    backgroundColor: c.bg.card,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    // UWAGA: `alignItems: 'stretch'` (domyślne), NIE 'center' — Text potrzebuje realnej
    // szerokości żeby `adjustsFontSizeToFit` miało względem czego się kurczyć. Z 'center'
    // tekst dostawał tylko tyle miejsca ile sam chciał i po prostu wystawał poza
    // `overflow: hidden` kafla (stąd "DNI"→"DN", "SŁODYCZE"→"ŁODYCZI" ucięte, 2026-10-26).
    justifyContent: 'space-between',
  },
  value: {
    fontFamily: 'Inter_900Black',
    fontSize: 34,
    textAlign: 'center',
    color: c.text.bright,
  },
  unit: {
    fontFamily: 'Inter_200ExtraLight',
    fontSize: 15,
    color: c.text.primary,
    textAlign: 'center',
    marginTop: -4,
  },
  label: {
    fontFamily: 'Inter_900Black',
    fontSize: 16,
    textAlign: 'center',
    color: c.text.secondary,
  },
  detail: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 14,
    color: c.text.secondary,
  },
  weatherIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
}));
