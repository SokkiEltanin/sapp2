// Sprite pixel-art jako tablica wierszy ('.' = pusty, litera = kolor z palety) — scena pogody
// (components/weather/WeatherScene.tsx).
/** Sprite → prostokąty: sąsiednie piksele w wierszu scalone = mniej elementów Svg. */
export function spriteRects(sprite: string[]): { x: number; y: number; w: number; ch: string }[] {
  const out: { x: number; y: number; w: number; ch: string }[] = [];
  sprite.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let w = 1;
      while (row[x + w] === ch) w++;
      out.push({ x, y, w, ch });
      x += w;
    }
  });
  return out;
}
