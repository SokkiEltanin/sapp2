import Svg, { G, Path } from 'react-native-svg';

// Logo Sapp2 (2026-11-16, user: "logo w SVG białe (nasz biały) i podmień logo appki").
// Te same kształty co assets/logo.svg (z niego generowane są ikony i splash).
export const LOGO_PATHS = [
  'M298 414 A136 136 0 0 1 434 278 H590 A136 136 0 0 1 726 414 Z',
  'M298 442 H590 A136 136 0 0 1 726 578 H434 A136 136 0 0 1 298 442 Z',
  'M298 744 A136 136 0 0 1 434 608 H726 A136 136 0 0 1 590 744 Z',
];

/** `size` = bok kwadratu; logo wypełnia go (przycięte do samego znaku, bez marginesu ikony). */
export default function Logo({ size = 64, color = '#D6D6D6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="290 270 444 482">
      <G fill={color}>{LOGO_PATHS.map((d) => <Path key={d} d={d} />)}</G>
    </Svg>
  );
}
