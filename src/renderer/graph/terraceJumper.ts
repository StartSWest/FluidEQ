import type { Projected } from 'common/graphStyles';

export interface ITerraceJumper {
  column: number;
  direction: number;
  phase: number;
}

export const createTerraceJumper = (): ITerraceJumper => ({
  column: 0,
  direction: 1,
  phase: 0,
});

/** One simulation step per frame; mirrors only repaint the same jumper. */
export const advanceTerraceJumper = (
  state: ITerraceJumper,
  points: readonly Projected[],
  deltaMs: number,
  playing: boolean,
) => {
  if (points.length < 2) {
    return undefined;
  }
  if (state.column >= points.length) {
    state.column = 0;
    state.phase = 0;
    state.direction = 1;
  }
  if (state.column === 0) {
    state.direction = 1;
  } else if (state.column === points.length - 1) {
    state.direction = -1;
  }
  if (playing) {
    state.phase += deltaMs / 620;
    while (state.phase >= 1) {
      state.phase -= 1;
      state.column += state.direction;
      if (state.column === points.length - 1 || state.column === 0) {
        state.direction *= -1;
      }
    }
  }
  const target = Math.max(
    0,
    Math.min(points.length - 1, state.column + state.direction),
  );
  const [fromX, fromY] = points[state.column];
  const [toX, toY] = points[target];
  // The clearance grows with the difference between shelves, so an uphill
  // jump clears the higher step instead of passing through its wall.
  const clearance = 32 + Math.abs(toY - fromY) * 0.6;
  const progress = state.phase;
  return {
    x: fromX + (toX - fromX) * progress,
    y:
      fromY +
      (toY - fromY) * progress -
      4 * progress * (1 - progress) * clearance,
    direction: state.direction,
  };
};

/**
 * The explorer, one letter a pixel, and each letter's colour; a dot is
 * empty. Exported for the engine's terrace
 * (`engineLooks/designed/terraceLook.ts`), which draws the same sprite.
 */
export const JUMPER_COLOURS: Record<string, string> = {
  T: '#32dec7',
  L: '#b8ffed',
  K: '#153449',
  W: '#fff4be',
  P: '#8d6ee8',
  Y: '#ffc66b',
  C: '#ffad66',
};

export const JUMPER_SPRITE = [
  '......CC........',
  '......CC........',
  '...TTTTTTTT.....',
  '..TLLLLLLLLT....',
  '..TLKKKKKKLT....',
  '..TLKWWWWKLT....',
  '..TLKKKKKKLT....',
  '...TTTTTTTT.....',
  '....PPYYPP......',
  '..TTTPPPPTTT....',
  '.TT..PYYP..TT...',
  '.TT..PPPP..TT...',
  '.....P..P.......',
  '....PP..PP......',
  '...PPP..PPP.....',
  '...KKK..KKK.....',
];

// Merge adjacent pixels once, rather than painting or parsing a sprite grid
// on every animation frame. No images, filters, or extra animation loop.
const RUNS = JUMPER_SPRITE.flatMap((row, y) => {
  const runs: { x: number; y: number; width: number; colour: string }[] = [];
  let x = 0;
  while (x < row.length) {
    const start = x;
    const key = row[x];
    while (row[x] === key) {
      x += 1;
    }
    if (JUMPER_COLOURS[key]) {
      runs.push({ x: start, y, width: x - start, colour: JUMPER_COLOURS[key] });
    }
  }
  return runs;
});

/**
 * How big one of the explorer's pixels is: a little bigger on a wider plot
 * and a deeper one, within limits either way. The sprite's feet stand on
 * its position, its middle column over it.
 */
export const jumperPixel = (plotWidth: number, renderedDepth: number) => {
  const growth = Math.max(0.7, Math.min(2.2, Math.sqrt(renderedDepth / 360)));
  return Math.max(1.4, Math.min(2.5, plotWidth / 750)) * growth;
};

/** Where the sprite's grid starts from its position, in its own pixels. */
export const JUMPER_ORIGIN = { x: -7, y: -16 };

export const paintTerraceJumper = (
  context: CanvasRenderingContext2D,
  position: { x: number; y: number; direction: number },
  plotWidth: number,
  renderedDepth: number,
) => {
  const transform = context.getTransform();
  const aspect = transform.d === 0 ? 1 : Math.abs(transform.a / transform.d);
  const pixel = jumperPixel(plotWidth, renderedDepth);
  context.save();
  context.translate(position.x, position.y);
  context.scale(pixel * position.direction, pixel * aspect);
  RUNS.forEach((run) => {
    context.fillStyle = run.colour;
    context.fillRect(
      run.x + JUMPER_ORIGIN.x,
      run.y + JUMPER_ORIGIN.y,
      run.width,
      1,
    );
  });
  context.restore();
};
