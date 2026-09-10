import type { Projected } from './graphStyles';

/**
 * The invaders' sprites: pixel bitmaps as rows of `X` and `.`, two frames
 * for anything that marches. Shared by the picker's still preview and the
 * running scene so the two draw the same creatures.
 */
export type Bitmap = readonly string[];

export interface Sprite {
  frames: readonly Bitmap[];
  width: number;
  height: number;
}

const sprite = (...frames: Bitmap[]): Sprite => ({
  frames,
  width: frames[0][0].length,
  height: frames[0].length,
});

/**
 * The poses, by frame index. The first two are the cabinet's own march pair
 * and stay first, because the picker's still preview alternates `% 2`; the
 * third is the in-between the live scene passes through, so an alien rising
 * with its band lifts its arms in two steps rather than snapping.
 */
export const POSE_DOWN = 0;
export const POSE_UP = 1;
export const POSE_HALF = 2;

/** The top row's creature: the squid, smallest and fastest to twitch. */
export const SQUID = sprite(
  [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    'XXXXXXXX',
    '..X..X..',
    '.X.XX.X.',
    'X.X..X.X',
  ],
  [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    'XXXXXXXX',
    '.X....X.',
    'X......X',
    '.X....X.',
  ],
  [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    'XXXXXXXX',
    '.X.XX.X.',
    'X......X',
    '.X....X.',
  ],
);

/** The middle rows' crab. */
export const CRAB = sprite(
  [
    '..X.....X..',
    '...X...X...',
    '..XXXXXXX..',
    '.XX.XXX.XX.',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    '...XX.XX...',
  ],
  [
    '..X.....X..',
    'X..X...X..X',
    'X.XXXXXXX.X',
    'XXX.XXX.XXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..X.....X..',
    '.X.......X.',
  ],
  [
    '..X.....X..',
    '...X...X...',
    '..XXXXXXX..',
    'XXX.XXX.XXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..X.....X..',
    '...XX.XX...',
  ],
);

/** The bottom rows' octopus, the widest. */
export const OCTOPUS = sprite(
  [
    '....XXXX....',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XXX..XX..XXX',
    'XXXXXXXXXXXX',
    '...XX..XX...',
    '..XX.XX.XX..',
    'XX........XX',
  ],
  [
    '....XXXX....',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XXX..XX..XXX',
    'XXXXXXXXXXXX',
    '..XXX..XXX..',
    '.XX..XX..XX.',
    '..XX....XX..',
  ],
  [
    '....XXXX....',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XXX..XX..XXX',
    'XXXXXXXXXXXX',
    '...XX..XX...',
    '.XX.XXXX.XX.',
    '.X........X.',
  ],
);

export const SAUCER = sprite([
  '.....XXXXXX.....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '.XX.XX.XX.XX.XX.',
  'XXXXXXXXXXXXXXXX',
  '...XXX....XXX...',
  '....X......X....',
]);

/**
 * The fighter, in the same pixel style as the aliens: `X` is hull, `C` the
 * canopy, `R` the wing stripes. One bitmap, three glyphs, so the layers
 * always line up.
 */
export const SHIP = sprite([
  '.......C.......',
  '.......C.......',
  '......XCX......',
  '......XCX......',
  '.....XXCXX.....',
  '.R...XXCXX...R.',
  '.R...XX.XX...R.',
  '.R..XXXXXXX..R.',
  'XRX.XXXXXXX.XRX',
  'XXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXX',
  'XX.XXXXXXXXX.XX',
  'X..XX.XXX.XX..X',
  'X..XX.....XX..X',
  '...XX.....XX...',
  '...X.......X...',
]);

export const BURST = sprite([
  '....X...X....',
  '.X...X.X...X.',
  '..X.......X..',
  '...X.....X...',
  'XX.........XX',
  '...X.....X...',
  '..X..X.X..X..',
  '.X..X...X..X.',
]);

/**
 * A blockhouse: the arched shelter the fighter hides behind.
 *
 * Sixteen by twelve rather than the cabinet's twenty-two by sixteen. The
 * arch has to survive being drawn at a couple of pixels a cell on a
 * compact panel, and at that size the original's one-cell shoulders close
 * up into a solid brick.
 */
export const BUNKER = sprite([
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '.XXXXXXXXXXXXXX.',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  'XXXXX......XXXXX',
  'XXXX........XXXX',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXX..........XXX',
]);

/**
 * The cabinet's readouts, five by seven.
 *
 * Only the characters the scene actually prints. A full face would be
 * three hundred lines of table for twenty-six letters that never appear,
 * and the readout is fixed text: two labels and the digits under them.
 */
const GLYPHS: Record<string, Bitmap> = {
  '0': ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '3': ['XXXXX', '...X.', '..XX.', '....X', 'X...X', 'X...X', '.XXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],
  C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  '-': ['.....', '.....', '.....', 'XXXXX', '.....', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

/** The width of one readout character, in sprite pixels, gap included. */
export const GLYPH_PITCH = 6;

/**
 * A line of text as one bitmap, so the run merger treats the whole line
 * at once rather than a rectangle per character.
 */
export const textBitmap = (text: string): Bitmap =>
  Array.from({ length: 7 }, (_, row) =>
    [...text.toUpperCase()]
      .map((character) => (GLYPHS[character] ?? GLYPHS[' '])[row])
      .join('.'),
  );

export type AlienKind = 'squid' | 'crab' | 'octopus';
export const ALIENS: Record<AlienKind, Sprite> = {
  squid: SQUID,
  crab: CRAB,
  octopus: OCTOPUS,
};

/**
 * Which creature a column is: the bass third are octopi, the middle crabs,
 * the treble squids — the arcade's rows, laid along the spectrum.
 */
export const kindForColumn = (index: number, count: number): AlienKind => {
  const t = (index + 0.5) / Math.max(1, count);
  if (t < 1 / 3) {
    return 'octopus';
  }
  return t < 2 / 3 ? 'crab' : 'squid';
};

/** A pixel rectangle: x, y, width, height. */
export type PixelRect = readonly [number, number, number, number];

/**
 * The lit pixels of a frame as rectangles, horizontal runs merged so a
 * solid row is one rectangle. `centreX` and `top` in pixels, `unit` the
 * size of one sprite pixel, `glyph` which layer of the bitmap to take.
 * `shear` slides each row sideways by that many units per row from the
 * middle, which is how a pixel ship banks without a rotation.
 */
export const spriteRects = (
  bitmap: Bitmap,
  centreX: number,
  top: number,
  unit: number,
  glyph = 'X',
  shear = 0,
): PixelRect[] => {
  const rects: PixelRect[] = [];
  const width = bitmap[0].length;
  const left = centreX - (width * unit) / 2;
  const middle = bitmap.length / 2;
  bitmap.forEach((row, r) => {
    const slide = Math.round(shear * (r - middle)) * unit;
    let run = -1;
    for (let c = 0; c <= row.length; c += 1) {
      const lit = c < row.length && row[c] === glyph;
      if (lit && run < 0) {
        run = c;
      } else if (!lit && run >= 0) {
        rects.push([
          left + run * unit + slide,
          top + r * unit,
          (c - run) * unit,
          unit,
        ]);
        run = -1;
      }
    }
  });
  return rects;
};

/** The pixel size for a plot: from its depth, and never wider than a column. */
export const invaderUnit = (depth: number, spacing: number) =>
  Math.max(1.5, Math.min(6, depth / 120, spacing / 14));

const rect = ([x, y, w, h]: PixelRect) =>
  `M ${x.toFixed(1)},${y.toFixed(1)} h ${w.toFixed(1)} v ${h.toFixed(1)} h ${(-w).toFixed(1)} Z `;

/** The formation alone as a path string, for the picker's still preview. */
export const createGraphInvaders = (
  points: readonly Projected[],
  top: number,
  bottom: number,
): string => {
  if (points.length < 2) {
    return '';
  }
  const spacing =
    (points[points.length - 1][0] - points[0][0]) / (points.length - 1);
  const unit = invaderUnit(bottom - top, spacing);
  let path = '';
  points.forEach(([x, y], index) => {
    const kind = kindForColumn(index, points.length);
    const alien = ALIENS[kind];
    const height = alien.height * unit;
    const cy = Math.max(top + height, Math.min(bottom - height * 2, y));
    spriteRects(alien.frames[index % 2], x, cy - height / 2, unit).forEach(
      (r) => {
        path += rect(r);
      },
    );
  });
  return path;
};
