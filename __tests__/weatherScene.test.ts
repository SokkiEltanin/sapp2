import { spriteRects } from '@/utils/pixelSprite';

describe('scena pogody: sprite → prostokąty', () => {
  it('scala sąsiednie piksele w wierszu i pomija puste', () => {
    expect(spriteRects(['.YY.O', 'W...W'])).toEqual([
      { x: 1, y: 0, w: 2, ch: 'Y' }, { x: 4, y: 0, w: 1, ch: 'O' },
      { x: 0, y: 1, w: 1, ch: 'W' }, { x: 4, y: 1, w: 1, ch: 'W' },
    ]);
  });
});
