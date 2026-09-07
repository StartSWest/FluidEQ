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

const COLOURS: Record<string, string> = {
  T: '#32dec7',
  L: '#b8ffed',
  K: '#153449',
  W: '#fff4be',
  P: '#8d6ee8',
  Y: '#ffc66b',
  C: '#ffad66',
};

const EXPLORER = [
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
const RUNS = EXPLORER.flatMap((row, y) => {
  const runs: { x: number; y: number; width: number; colour: string }[] = [];
  let x = 0;
  while (x < row.length) {
    const start = x;
    const key = row[x];
    while (row[x] === key) {
      x += 1;
    }
    if (COLOURS[key]) {
      runs.push({ x: start, y, width: x - start, colour: COLOURS[key] });
    }
  }
  return runs;
});

export const paintTerraceJumper = (
  context: CanvasRenderingContext2D,
  position: { x: number; y: number; direction: number },
  plotWidth: number,
  renderedDepth: number,
) => {
  const transform = context.getTransform();
  const aspect = transform.d === 0 ? 1 : Math.abs(transform.a / transform.d);
  const growth = Math.max(0.7, Math.min(2.2, Math.sqrt(renderedDepth / 360)));
  const pixel = Math.max(1.4, Math.min(2.5, plotWidth / 750)) * growth;
  context.save();
  context.translate(position.x, position.y);
  context.scale(pixel * position.direction, pixel * aspect);
  RUNS.forEach((run) => {
    context.fillStyle = run.colour;
    context.fillRect(run.x - 7, run.y - 16, run.width, 1);
  });
  context.restore();
};
