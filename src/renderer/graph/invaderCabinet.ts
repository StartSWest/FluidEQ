import {
  BUNKER,
  GLYPH_PITCH,
  PixelRect,
  SHIP,
  spriteRects,
  textBitmap,
} from 'common/graphInvaders';

/**
 * The cabinet the fight happens inside: blockhouses, readouts and ground.
 *
 * The formation and the fighter were drawn on bare black, and a row of
 * sprites along the floor of an empty panel is a screensaver rather than
 * an arcade. What was missing is everything AROUND the fight — the four
 * arched shelters the fighter hides behind, the score and hi-score across
 * the top, the spare lives and the credit along the bottom, and the green
 * ground line under all of it. Together they fill the panel's dead margins
 * with the one picture everybody already recognises.
 *
 * The blockhouses are not decoration: a bolt that reaches one eats a hole
 * through it and stops there, so they wear down where the fighting is
 * heaviest, and a shelter chewed past a third of itself is replaced — the
 * next wave's, which is what stops an hour of playback ending with four
 * bare patches of sky.
 */

/** Cells lost to fire, as `row * width + column` into the bunker bitmap. */
interface IBunker {
  centreX: number;
  gone: Set<number>;
}

export interface InvaderCabinet {
  bunkers: IBunker[];
  /** The span the bunkers were laid out for, so a resize re-lays them. */
  spanLeft: number;
  spanRight: number;
  score: number;
  best: number;
  lives: number;
  /** The ship hit this cabinet last counted, so one hit costs one life. */
  countedHitAt: number;
}

/**
 * The cabinet's two colours, fixed rather than taken from the look.
 *
 * The shelters and the ground were green on the original's overlay strip
 * and the readouts were white, and those two facts are most of why a
 * screenshot of this is recognisable at a glance. The look's own colour
 * stays where the spectrum is — on the aliens.
 */
export const INVADER_GREEN = '#3ce86b';
export const INVADER_READOUT = '#dfe8ff';
/** The points a kill is worth, warm so they read over a cool formation. */
export const INVADER_POINTS = '#ffe27a';

/**
 * The blockhouse's cell against a sprite pixel. A little over one: at 1.3
 * the four of them read as green slabs dominating the screen, and the
 * cabinet's own shelters are barely wider than the octopus above them.
 */
const BLOCK = 1.1;
/** How much of a blockhouse has to survive before the next wave brings a new one. */
const REBUILD_BELOW = 0.34;
/** A bolt takes out everything within this many cells of where it landed. */
const BLAST = 1.7;
const LIVES = 3;
/**
 * How far the waveform ground may swing, peak to peak, in readout pixels.
 * Pressed flat on purpose: it is the floor of the screen, and a full-height
 * scope down there would be a second visualizer fighting the formation.
 */
const GROUND_RELIEF = 6;
/**
 * How hard the waveform drives the ground before the soft limit. The
 * capture's samples sit well inside ±1 at ordinary listening levels, and
 * at unity gain the line barely left the floor.
 */
const GROUND_GAIN = 4;

const BUNKER_MAP = BUNKER.frames[0];
const BUNKER_WIDE = BUNKER_MAP[0].length;
const BUNKER_TALL = BUNKER_MAP.length;
const BUNKER_CELLS = BUNKER_MAP.reduce(
  (count, row) => count + [...row].filter((cell) => cell === 'X').length,
  0,
);

export const createInvaderCabinet = (): InvaderCabinet => ({
  bunkers: [],
  spanLeft: 0,
  spanRight: 0,
  score: 0,
  best: 0,
  lives: LIVES,
  countedHitAt: -1,
});

/** What an alien of each kind is worth, as the cabinet has always paid. */
export const ALIEN_SCORES = { squid: 30, crab: 20, octopus: 10 };
/** The saucer: the boss of the screen, worth a hundred when it comes down. */
export const SAUCER_SCORE = 100;

const bunkerWidth = (unit: number) => BUNKER_WIDE * unit * BLOCK;

/**
 * The fighter's scale against a sprite pixel, and its half-height in those
 * pixels. Here rather than beside the ship because the shelters are placed
 * from it: they stand over the ship's canopy, and a shelter placed from a
 * guess at the ship's size overlapped its nose on the first screenshot.
 */
export const SHIP_SCALE = 1.2;
const SHIP_HALF = (SHIP.height * SHIP_SCALE) / 2;
/** The clear air between the canopy and the shelter's floor, in sprite pixels. */
const SHELTER_GAP = 3;

/** Where the shelters stand: over the fighter's canopy, never on it. */
export const bunkerTop = (shipY: number, unit: number) =>
  shipY - (SHIP_HALF + SHELTER_GAP + BUNKER_TALL * BLOCK) * unit;

/**
 * How far over the fighter's lane the lowest alien may ride, in sprite
 * pixels: the shelter's roof plus half an alien plus three pixels of air.
 * With one, a quiet band's aliens stood on the arches like ornaments.
 */
export const ALIEN_FLOOR =
  SHIP_HALF + SHELTER_GAP + BUNKER_TALL * BLOCK + 4 + 3;

const layOut = (
  state: InvaderCabinet,
  left: number,
  right: number,
  unit: number,
) => {
  const span = Math.max(1, right - left);
  // Four is the cabinet's own number and the right one on a squarish panel;
  // a wide, shallow strip needs more of them or the row reads as a gap with
  // three ornaments in it.
  const count = Math.max(
    4,
    Math.min(9, Math.round(span / Math.max(1, bunkerWidth(unit) * 5))),
  );
  const step = span / count;
  state.bunkers = Array.from({ length: count }, (_, index) => ({
    centreX: left + step * (index + 0.5),
    gone: new Set<number>(),
  }));
  state.spanLeft = left;
  state.spanRight = right;
};

/**
 * Take fire on the shelters.
 *
 * Returns true when a shelter swallowed the shot, which is what stops the
 * bolt going on to the fighter. A shelter already eaten through at that
 * column lets it pass — the hole stays a hole, and that is the whole point
 * of shooting at one.
 */
export const strikeBunker = (
  state: InvaderCabinet,
  x: number,
  y: number,
  unit: number,
  shipY: number,
  fromBelow: boolean,
): boolean => {
  const cell = unit * BLOCK;
  const top = bunkerTop(shipY, unit);
  if (y < top || y > top + BUNKER_TALL * cell) {
    return false;
  }
  const bunker = state.bunkers.find(
    (entry) => Math.abs(x - entry.centreX) <= bunkerWidth(unit) / 2,
  );
  if (!bunker) {
    return false;
  }
  const column = Math.floor(
    (x - (bunker.centreX - bunkerWidth(unit) / 2)) / cell,
  );
  if (column < 0 || column >= BUNKER_WIDE) {
    return false;
  }
  // The face the shot meets: a bolt eats the roof, the fighter's laser eats
  // the underside.
  let struck = -1;
  for (let step = 0; step < BUNKER_TALL && struck < 0; step += 1) {
    const row = fromBelow ? BUNKER_TALL - 1 - step : step;
    if (
      BUNKER_MAP[row][column] === 'X' &&
      !bunker.gone.has(row * BUNKER_WIDE + column)
    ) {
      struck = row;
    }
  }
  if (struck < 0) {
    return false;
  }
  for (let row = 0; row < BUNKER_TALL; row += 1) {
    for (let col = 0; col < BUNKER_WIDE; col += 1) {
      if (Math.hypot(col - column, row - struck) <= BLAST) {
        bunker.gone.add(row * BUNKER_WIDE + col);
      }
    }
  }
  if (BUNKER_CELLS - bunker.gone.size < BUNKER_CELLS * REBUILD_BELOW) {
    bunker.gone.clear();
  }
  return true;
};

/**
 * Put the shelters where the plot is, and keep the tally honest.
 *
 * Returns true on the hit that took the last ship, which is the fight's
 * cue to blow the fighter apart. The count stays at none until the fight
 * says the next game has started, so the readout shows the empty rack
 * for as long as the wreck is on screen.
 */
export const advanceInvaderCabinet = (
  state: InvaderCabinet,
  left: number,
  right: number,
  unit: number,
  shipHitAt: number,
): boolean => {
  if (
    state.bunkers.length === 0 ||
    Math.abs(state.spanLeft - left) > 1 ||
    Math.abs(state.spanRight - right) > 1
  ) {
    layOut(state, left, right, unit);
  }
  if (shipHitAt < 0 || shipHitAt === state.countedHitAt) {
    return false;
  }
  state.countedHitAt = shipHitAt;
  state.lives = Math.max(0, state.lives - 1);
  return state.lives === 0;
};

/**
 * A fresh coin: three ships, the score back to nothing and the best kept.
 * What stops a readout left running for an hour from becoming a number
 * nobody can read.
 */
export const startNextGame = (state: InvaderCabinet) => {
  state.best = Math.max(state.best, state.score);
  state.score = 0;
  state.lives = LIVES;
};

/**
 * Add a kill to the tally.
 *
 * Capped at the largest whole number a double still counts exactly. Past
 * it, adding thirty stops changing the value at all — the score would
 * freeze with no sign why — and the readout's digits would start printing
 * rounding noise. Nobody will reach nine quadrillion; the cap is there so
 * that an arcade left running for a year does not find out what happens.
 */
export const scoreInvader = (state: InvaderCabinet, points: number) => {
  state.score = Math.min(Number.MAX_SAFE_INTEGER, state.score + points);
  state.best = Math.max(state.best, state.score);
};

const rects = (path: Path2D, list: readonly PixelRect[]) => {
  list.forEach(([x, y, w, h]) => path.rect(x, y, w, h));
};

const digits = (value: number) => String(value).padStart(4, '0');

/**
 * The shelters, standing where the fight laid them out.
 *
 * In the fight's space, not the window's: the bolts meet them where they
 * are drawn, and they stand over the fighter's canopy, so they move with
 * the fighter's lane when the height slider moves it — and reflect with the
 * rest of the fight in the mirror.
 */
export const createShelterPaths = (
  state: InvaderCabinet,
  shipY: number,
  unit: number,
) => {
  const cell = unit * BLOCK;
  const shelters = new Path2D();
  const roof = bunkerTop(shipY, unit);
  state.bunkers.forEach((bunker) => {
    const standing = BUNKER_MAP.map((row, r) =>
      [...row]
        .map((glyph, c) =>
          glyph === 'X' && !bunker.gone.has(r * BUNKER_WIDE + c) ? 'X' : '.',
        )
        .join(''),
    );
    rects(shelters, spriteRects(standing, bunker.centreX, roof, cell));
  });
  return shelters;
};

/** A piece of the app's own chrome over the canvas, in the canvas's pixels. */
export interface IChromeBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Where the readout row sits: under the lowest of the app's chrome along
 * the top edge — full screen puts the creature over the top-left corner and
 * the graph's controls across the top, and the score printed at the very
 * edge was sitting underneath both — and how far down the row reaches.
 *
 * One row for both readouts rather than one drop each: printed at two
 * different heights they looked like a layout bug, and the machine has
 * always lined them up.
 */
const readoutRow = (
  height: number,
  unit: number,
  chrome: readonly IChromeBox[],
) => {
  const label = Math.max(1.5, unit * 0.6);
  const margin = label * 4;
  const top =
    chrome.reduce(
      (lowest, box) =>
        box.top < height / 2 ? Math.max(lowest, box.bottom) : lowest,
      0,
    ) + margin;
  return { label, margin, top, bottom: top + label * 7 };
};

/**
 * The lowest the readout row reaches, in the window's pixels. Nothing in
 * the fight may ride above this — the saucer's lane starts under it, and
 * the formation's ceiling under that — or a loud band's aliens and the
 * saucer both fly through the score.
 */
export const readoutFloor = (
  height: number,
  unit: number,
  chrome: readonly IChromeBox[],
) => {
  const row = readoutRow(height, unit, chrome);
  return row.bottom + row.margin;
};

/**
 * The machine's screen edges: the readouts along the top, the ground, the
 * spare ships and the credit along the bottom.
 *
 * In the WINDOW's own pixels, painted once and never through the wave's
 * transform: they are the edges of the screen, so a half-height wave must
 * not leave them floating mid-panel, the mirror must not print them upside
 * down, and a bolt landing on the ship must not shake the score.
 */
export const createCabinetFramePaths = (
  state: InvaderCabinet,
  width: number,
  height: number,
  unit: number,
  chrome: readonly IChromeBox[],
  wave: readonly number[] = [],
) => {
  const { label, margin, top } = readoutRow(height, unit, chrome);
  const textWidth = (text: string) => (text.length * GLYPH_PITCH - 1) * label;
  const readout = new Path2D();
  const print = (text: string, left: number, row: number) => {
    rects(
      readout,
      spriteRects(textBitmap(text), left + textWidth(text) / 2, row, label),
    );
  };

  const score = `SCORE ${digits(state.score)}`;
  const scoreLeft = margin * 2;
  print(score, scoreLeft, top);
  const best = `HI-SCORE ${digits(state.best)}`;
  print(best, (width - textWidth(best)) / 2, top);

  // The ground across the whole screen, lifted clear of anything the app
  // pins over the bottom edge — and alive: still one thin line, but traced
  // by the live waveform like an oscilloscope pressed nearly flat, stepping
  // on the cabinet's pixel grid. Under it nothing but the two things every
  // cabinet prints there.
  const rule = Math.max(1, unit * 0.6);
  const relief = label * GROUND_RELIEF;
  const floor =
    chrome.reduce(
      (highest, box) =>
        box.top >= height / 2 ? Math.min(highest, box.top) : highest,
      height,
    ) -
    rule -
    relief / 2;
  const ground = new Path2D();
  const across = Math.max(2, Math.floor(width / label));
  const sampleAt = (t: number) => {
    if (wave.length === 0) {
      return 0;
    }
    const at = t * (wave.length - 1);
    const low = Math.floor(at);
    const high = Math.min(wave.length - 1, low + 1);
    return wave[low] + (wave[high] - wave[low]) * (at - low);
  };
  let before = 0;
  for (let column = 0; column < across; column += 1) {
    // A soft limit rather than a clip, so a loud passage rounds off at the
    // strip's edge instead of flattening into a square wave.
    const swing = Math.tanh(sampleAt(column / (across - 1)) * GROUND_GAIN);
    const lift = Math.round((swing * relief) / 2 / label) * label;
    const x = column * label;
    ground.rect(x, floor - lift, label, rule);
    if (column > 0 && lift !== before) {
      // The riser between two steps, so the line never breaks.
      ground.rect(
        x,
        floor - Math.max(lift, before),
        rule,
        Math.abs(lift - before) + rule,
      );
    }
    before = lift;
  }

  const spare = new Path2D();
  const icon = label;
  const iconTop = floor - relief / 2 - label * 2 - SHIP.height * icon;
  for (let life = 0; life < state.lives; life += 1) {
    rects(
      spare,
      spriteRects(
        SHIP.frames[0],
        scoreLeft + (SHIP.width * icon) / 2 + life * SHIP.width * icon * 1.5,
        iconTop,
        icon,
      ),
    );
  }
  const credit = 'CREDIT 00';
  rects(
    readout,
    spriteRects(
      textBitmap(credit),
      width - margin * 2 - textWidth(credit) / 2,
      floor - relief / 2 - label * 9,
      label,
    ),
  );

  return { ground, readout, spare };
};

export type CabinetFramePaths = ReturnType<typeof createCabinetFramePaths>;
