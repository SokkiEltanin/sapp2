import { View, Text, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { themedStyles } from '@/theme';
import { cornersForPosition, getTilePosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Wzorzec z mockupów usera (2026-10-26, kafelek WODA) — jeden kolor akcentu na
// kategorię, używany i do tekstu, i do gradientu w tle (ten sam hex, warstwa gradientu
// czarny→akcent na 20% opacity nad bazą #141414). Reguła zaokrąglania (tylko skrajne
// krawędzie rzędu) — patrz `tilePosition.ts`, wspólna z PatternTileBackground.
export type { StatTilePosition };
export { getTilePosition };

type BaseProps = {
  position: StatTilePosition;
  accent: string;
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
  const { position, accent, value } = props;

  return (
    <View style={[s.tile, cornersForPosition(position)]}>
      <LinearGradient
        colors={['#000000', accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.gradient}
      />
      <View style={s.content}>
        <Text style={[s.value, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
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
              <Text style={[s.detail, { color: accent }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
                {props.detail}
              </Text>
            ) : (
              <Text style={[s.label, { color: accent }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
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
  gradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
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
    fontSize: 30,
    textAlign: 'center',
  },
  unit: {
    fontFamily: 'Inter_200ExtraLight',
    fontSize: 13,
    color: c.text.primary,
    textAlign: 'center',
    marginTop: -4,
  },
  label: {
    fontFamily: 'Inter_900Black',
    fontSize: 14,
    textAlign: 'center',
  },
  detail: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    textAlign: 'left',
    lineHeight: 14,
  },
  weatherIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
}));
