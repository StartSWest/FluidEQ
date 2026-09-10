import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import {
  ALIENS,
  BURST,
  invaderUnit,
  kindForColumn,
  PixelRect,
  SAUCER,
  SHIP,
  spriteRects,
} from 'common/graphInvaders';

/**
 * The space fight behind the Invaders form.
 *
 * The spectrum is a formation of pixel aliens — octopi on the bass end,
 * crabs in the middle, squids on the treble — each riding at its band's
 * level and stepping between its two frames on the beat. Under them a
 * pixel fighter in the same style hunts whichever band just jumped, so it
 * roams the whole formation rather than parking under the bass; it banks
 * as it slides, and its twin engines burn pixel flames that lengthen
 * with the bass and flare on the beat. On every beat it fires at the two
 * aliens whose bands rose most, wherever they are, along a line from its
 * cannons to them; a hit is a pixel burst and a white flash on the alien.
 * The aliens fight back: treble cracks make a random alien throw a plasma
 * bolt down, and on a bass hit the aliens nearest the ship fire straight
 * at it — a bolt that lands lights the shield, flashes the ship and
 * shakes the screen. Behind everything a star field rushes past, three
 * layers deep, the streaks stretching into warp as the music gets loud; a
 * big hit brings the saucer across the top.
 *
 * All of it runs on the music-pace clock and reads the beat from the
 * live frame, so it lands on the hit rather than after it. Every sprite
 * is a handful of merged pixel runs in one Path2D, so a frame is a few
 * hundred rectangles however big the plot.
 */

interface IStar {
  /** 0..1 across the scene, 0..1 down it, and how near: 0.35 far, 1 near. */
  u: number;
  v: number;
  near: number;
}

interface IShot {
  x: number;
  y: number;
  /** Direction, unit length. */
  dx: number;
  dy: number;
  column: number;
}

interface IBolt {
  x: number;
  y: number;
  seed: number;
  /** Aimed at the ship, from a bass hit; lands on it rather than passing. */
  aimed: boolean;
}

interface IBurst {
  x: number;
  y: number;
  bornAt: number;
}

export interface SpaceInvasion {
  stars: IStar[];
  warp: number;
  shots: IShot[];
  bolts: IBolt[];
  bursts: IBurst[];
  /** Per column: when the alien was last hit. */
  hitAt: number[];
  /** Per column: the live level last frame, for the rise that picks targets. */
  levels: number[];
  /** Which march frame the formation is on: 0 or 1, flipped by the beat. */
  frame: number;
  shipX: number;
  shipTarget: number;
  roll: number;
  firedAt: number;
  fired: number;
  shieldAt: number;
  shipHitAt: number;
  shakeAt: number;
  /** When the aliens last volleyed at the ship, for the cooldown. */
  volleyAt: number;
  saucerAt: number;
  mean: number;
  bassLevel: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  clock: number;
  started: boolean;
}

export const STARS = 180;
export const BURST_LIFE = 0.45;
export const SAUCER_CROSSING = 5;
const SHOT_LIMIT = 14;
const BOLT_LIMIT = 12;
const BURST_LIMIT = 16;
/** A shot's climb, a bolt's fall, in plot depths per second. */
const SHOT_SPEED = 3;
const BOLT_SPEED = 1.3;
/** The aliens volley at the ship at most this often, in clock seconds. */
const VOLLEY_COOLDOWN = 1.5;
/** How long the screen shakes after the ship is hit, in clock seconds. */
export const SHAKE_LIFE = 0.35;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createSpaceInvasion = (): SpaceInvasion => ({
  stars: Array.from({ length: STARS }, (_, i) => ({
    u: noise(i * 3 + 1),
    v: noise(i * 3 + 2),
    near: 0.35 + noise(i * 3 + 3) ** 2 * 0.65,
  })),
  warp: 0,
  shots: [],
  bolts: [],
  bursts: [],
  hitAt: [],
  levels: [],
  frame: 0,
  shipX: 0,
  shipTarget: 0,
  roll: 0,
  firedAt: -1,
  fired: 0,
  shieldAt: -1,
  shipHitAt: -1,
  shakeAt: -1,
  // Far enough back that the first hard hit volleys at once.
  volleyAt: -10,
  saucerAt: -1,
  mean: 0,
  bassLevel: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  clock: 0,
  started: false,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

/** Where the ship flies: this far above the floor, in plot depths. */
export const SHIP_LANE = 0.2;

/** An alien's centre for its column, kept between the saucer lane and the ship. */
export const alienY = (
  y: number,
  top: number,
  bottom: number,
  unit: number,
) => {
  const depth = bottom - top;
  return Math.max(
    top + unit * 12,
    Math.min(bottom - depth * SHIP_LANE - unit * 14, y),
  );
};

/** The screen's shake after a hit on the ship: a decaying wobble. */
export const invasionShake = (state: SpaceInvasion, seconds: number) => {
  const age = seconds - state.shakeAt;
  if (state.shakeAt < 0 || age >= SHAKE_LIFE) {
    return { x: 0, y: 0 };
  }
  const fade = (1 - age / SHAKE_LIFE) ** 2;
  return {
    x: Math.sin(age * 110) * 6 * fade,
    y: Math.cos(age * 90) * 4 * fade,
  };
};

export const advanceSpaceInvasion = (
  state: SpaceInvasion,
  columns: readonly Projected[],
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
  sizeHeight: number,
) => {
  if (columns.length < 2) {
    return;
  }
  const left = columns[0][0];
  const right = columns[columns.length - 1][0];
  const width = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);
  const spacing = width / (columns.length - 1);
  const unit = invaderUnit(sizeHeight, spacing);
  if (!state.started) {
    state.shipX = (left + right) / 2;
    state.shipTarget = state.shipX;
    state.started = true;
  }
  if (state.hitAt.length !== columns.length) {
    state.hitAt = columns.map(() => -1);
    state.levels = columns.map(() => 0);
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  // Paused, the fight freezes: the clock is not read, so every shot, bolt
  // and burst is where it was when the music comes back.
  if (!playing) {
    return;
  }
  state.clock = seconds;

  // The beat, the bass and the treble, from the live frame; and per band,
  // how much it rose, which is what the ship hunts.
  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const rises = levels.map(
    (level, index) => level - (state.levels[index] ?? 0),
  );
  state.levels = levels;
  const mean =
    levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length);
  const crack = mean - state.mean;
  state.mean = mean;
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const trebleFrom = Math.floor(levels.length * 0.6);
  const treble =
    levels.slice(trebleFrom).reduce((s, v) => s + v, 0) /
    Math.max(1, levels.length - trebleFrom);
  const beat = crack >= 0.05 && mean >= 0.15;
  if (beat) {
    state.thump = 1;
    state.frame = 1 - state.frame;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }

  // Warp: the star field's speed follows the level, up fast and down slow,
  // so a drop throws the stars into streaks and a quiet bar lets them
  // settle.
  state.warp +=
    (mean - state.warp) *
    getEaseFactor(elapsedMs, mean > state.warp ? 60 : 400);
  const starSpeed = (0.25 + state.warp * 2.2) * dt;
  state.stars.forEach((star) => {
    star.v += starSpeed * star.near;
    if (star.v > 1) {
      star.v -= 1;
      star.u = noise(star.u * 97 + seconds);
    }
  });

  // The ship hunts the band that just rose most — anywhere along the
  // formation, so the treble end gets its turn — and banks into the slide.
  let jumped = 0;
  rises.forEach((rise, index) => {
    if (rise > rises[jumped]) {
      jumped = index;
    }
  });
  if (rises[jumped] >= 0.08) {
    [state.shipTarget] = columns[jumped];
  }
  const before = state.shipX;
  state.shipX +=
    (state.shipTarget - state.shipX) * getEaseFactor(elapsedMs, 180);
  const slide = dt > 0 ? (state.shipX - before) / dt / width : 0;
  state.roll +=
    (Math.max(-1, Math.min(1, slide * 1.5)) - state.roll) *
    getEaseFactor(elapsedMs, 90);

  // On the beat the ship fires at the two aliens whose bands rose most,
  // wherever they are, one shot from each cannon along the line to them.
  const shipY = bottom - depth * SHIP_LANE;
  if (beat && state.shots.length < SHOT_LIMIT) {
    const ranked = rises
      .map((rise, index) => ({ rise, index }))
      .sort((a, b) => b.rise - a.rise)
      .slice(0, 2);
    ranked.forEach(({ index }, shot) => {
      const side = shot === 0 ? -1 : 1;
      const [ax, ay] = columns[index];
      const fromX = state.shipX + side * unit * 8;
      const fromY = shipY - unit * 3;
      const dx = ax - fromX;
      const dy = alienY(ay, top, bottom, unit) - fromY;
      const length = Math.max(1, Math.hypot(dx, dy));
      state.shots.push({
        x: fromX,
        y: fromY,
        dx: dx / length,
        dy: dy / length,
        column: index,
      });
    });
    state.firedAt = seconds;
    state.fired += 1;
  }
  state.shots = state.shots.filter((shot) => {
    const step = depth * SHOT_SPEED * dt;
    shot.x += shot.dx * step;
    shot.y += shot.dy * step;
    const [ax, ay] = columns[shot.column];
    const targetY = alienY(ay, top, bottom, unit);
    if (shot.y > targetY + unit * 2) {
      return true;
    }
    state.hitAt[shot.column] = seconds;
    if (state.bursts.length >= BURST_LIMIT) {
      state.bursts.shift();
    }
    state.bursts.push({ x: ax, y: targetY, bornAt: seconds });
    return false;
  });
  state.bursts = state.bursts.filter(
    (burst) => seconds - burst.bornAt < BURST_LIFE,
  );

  // The aliens fight back. A treble crack — relative to the treble's own
  // recent level, so a hi-hat counts on a plot where the highs sit low —
  // makes a random alien throw a bolt. A bass hit makes the aliens over
  // the ship fire straight at it.
  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  if (
    trebleCrack >= 0.02 &&
    relative >= 0.35 &&
    state.bolts.length < BOLT_LIMIT
  ) {
    const seed =
      state.fired * 7 + state.bolts.length * 3 + Math.floor(seconds * 10);
    const column = Math.floor(noise(seed) * columns.length);
    const [x, y] = columns[column];
    state.bolts.push({
      x,
      y: alienY(y, top, bottom, unit) + unit * 5,
      seed,
      aimed: false,
    });
  }
  // A hard bass hit, and not more than one volley every second and a
  // half: the ship was white more often than not.
  const bassCrack = bass - state.bassLevel;
  if (
    bassCrack >= 0.12 &&
    bass >= 0.45 &&
    seconds - state.volleyAt >= VOLLEY_COOLDOWN &&
    state.bolts.length < BOLT_LIMIT
  ) {
    state.volleyAt = seconds;
    let nearest = 0;
    columns.forEach(([x], index) => {
      if (
        Math.abs(x - state.shipX) < Math.abs(columns[nearest][0] - state.shipX)
      ) {
        nearest = index;
      }
    });
    [nearest - 1, nearest, nearest + 1].forEach((column, i) => {
      if (column < 0 || column >= columns.length) {
        return;
      }
      const [x, y] = columns[column];
      state.bolts.push({
        x,
        y: alienY(y, top, bottom, unit) + unit * 5,
        seed: state.fired * 11 + i,
        aimed: true,
      });
    });
  }
  state.bolts = state.bolts.filter((bolt) => {
    bolt.y += depth * BOLT_SPEED * dt;
    if (bolt.aimed) {
      // Homing: it drifts toward the ship as it falls.
      bolt.x += (state.shipX - bolt.x) * getEaseFactor(elapsedMs, 150);
    }
    if (bolt.y < shipY - unit * 6) {
      return true;
    }
    // An aimed bolt lands: it was fired at the ship and has homed on it
    // all the way down. A stray one lands only if the ship is under it.
    if (bolt.aimed || Math.abs(bolt.x - state.shipX) < unit * 12) {
      state.shieldAt = seconds;
      state.shipHitAt = seconds;
      state.shakeAt = seconds;
    }
    return false;
  });
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
  state.bassLevel = Math.max(bass, state.bassLevel * release);

  // A big hit sends the saucer across the top.
  const saucerDone = seconds - state.saucerAt > SAUCER_CROSSING;
  if (crack >= 0.1 && mean >= 0.5 && saucerDone) {
    state.saucerAt = seconds;
  }
};

const rects = (path: Path2D, list: readonly PixelRect[]) => {
  list.forEach(([x, y, w, h]) => path.rect(x, y, w, h));
};

/** Which star layer a nearness falls in: far, middle, near. */
const layerOf = (near: number) => {
  if (near < 0.55) {
    return 0;
  }
  return near < 0.8 ? 1 : 2;
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

/**
 * A pixel flame under an engine: rows of pixels narrowing to the tip,
 * jittering row by row on the clock, `length` rows long. The top half is
 * the hot core.
 */
const pixelFlame = (
  flame: Path2D,
  core: Path2D,
  centreX: number,
  top: number,
  unit: number,
  length: number,
  tick: number,
) => {
  for (let row = 0; row < length; row += 1) {
    const t = row / Math.max(1, length);
    const wide = Math.max(1, Math.round(3 * (1 - t) + noise(tick + row) * 0.9));
    const wobble = Math.round((noise(tick * 3 + row * 7) - 0.5) * (1 + t * 2));
    const x = centreX + (wobble - wide / 2) * unit;
    const y = top + row * unit;
    flame.rect(x, y, wide * unit, unit);
    if (t < 0.5 && wide > 1) {
      core.rect(x + unit * 0.5, y, (wide - 1) * unit, unit);
    }
  }
};

export const createSpaceInvasionPaths = (
  state: SpaceInvasion,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);
  const spacing = width / Math.max(1, columns.length - 1);
  const unit = invaderUnit(sizeHeight, spacing);
  // The scene reaches a plot's width past each end and half a depth above
  // and below: the panel has margins, and a scene may overflow them.
  const reach = width;
  const sceneLeft = left - reach;
  const sceneWidth = width + reach * 2;
  const sceneTop = top - depth * 0.5;
  const sceneHeight = depth * 1.7;

  // The stars, three layers: the near ones streak longest in warp.
  const stars: IBand[] = [0.45, 0.7, 1].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  const streak = unit * (0.3 + state.warp * 14);
  state.stars.forEach((star) => {
    const x = sceneLeft + star.u * sceneWidth;
    const y = sceneTop + star.v * sceneHeight;
    const band = stars[layerOf(star.near)];
    band.path.moveTo(x, y);
    band.path.lineTo(x, y - Math.max(1.5, streak * star.near));
  });

  // The formation: every column's alien on its frame, the figure. A
  // hit alien flashes white for a tenth of a second.
  const shape = new Path2D();
  const flash = new Path2D();
  columns.forEach(([x, y], index) => {
    const alien = ALIENS[kindForColumn(index, columns.length)];
    const frame = alien.frames[(state.frame + index) % 2];
    const cy = alienY(y, top, bottom, unit);
    const pixels = spriteRects(frame, x, cy - (alien.height * unit) / 2, unit);
    rects(shape, pixels);
    if (seconds - (state.hitAt[index] ?? -1) < 0.1) {
      rects(flash, pixels);
    }
  });

  // The ship: the pixel fighter in three layers — hull, canopy, stripes —
  // sheared into its bank; white all over for a tenth of a second after a
  // hit. Under each engine a pixel flame, longer with the bass, flaring
  // on the beat, jittering on the clock.
  const shipY = bottom - depth * SHIP_LANE;
  // The ship is drawn half again as big as an alien: it is the hero.
  const ship = unit * 1.5;
  const shipTop = shipY - (SHIP.height * ship) / 2;
  const shear = -state.roll * 0.35;
  const hull = new Path2D();
  const canopy = new Path2D();
  const stripes = new Path2D();
  rects(
    hull,
    spriteRects(SHIP.frames[0], state.shipX, shipTop, ship, 'X', shear),
  );
  rects(
    canopy,
    spriteRects(SHIP.frames[0], state.shipX, shipTop, ship, 'C', shear),
  );
  rects(
    stripes,
    spriteRects(SHIP.frames[0], state.shipX, shipTop, ship, 'R', shear),
  );
  const shipFlash = new Path2D();
  if (state.shipHitAt >= 0 && seconds - state.shipHitAt < 0.1) {
    shipFlash.addPath(hull);
    shipFlash.addPath(canopy);
    shipFlash.addPath(stripes);
  }
  const flame = new Path2D();
  const core = new Path2D();
  const burn = Math.round(3 + state.bass * 8 + state.thump * 4);
  const tick = Math.floor(seconds * 24);
  const bottomShear = Math.round(shear * (SHIP.height / 2)) * ship;
  [-3.5, 3.5].forEach((engine) => {
    pixelFlame(
      flame,
      core,
      state.shipX + engine * ship + bottomShear,
      shipTop + SHIP.height * ship,
      ship,
      burn,
      tick + engine,
    );
  });
  // The muzzle flash: a pixel cross at each cannon for the first frames
  // after a shot.
  const muzzle = new Path2D();
  if (state.firedAt >= 0 && seconds - state.firedAt < 0.08) {
    [-5.5, 5.5].forEach((cannon) => {
      const mx = state.shipX + cannon * ship;
      const my = shipTop + 5 * ship;
      muzzle.rect(mx - ship * 1.5, my - ship * 0.5, ship * 3, ship);
      muzzle.rect(mx - ship * 0.5, my - ship * 1.5, ship, ship * 3);
    });
  }
  // The shield: a pixel ring round the ship for a fifth of a second after
  // a bolt lands.
  const shield = new Path2D();
  const shieldAge = seconds - state.shieldAt;
  if (state.shieldAt >= 0 && shieldAge < 0.2) {
    const r = ship * (10 + shieldAge * 20);
    for (let step = 0; step < 16; step += 1) {
      const a = (step / 16) * Math.PI * 2;
      shield.rect(
        state.shipX + Math.cos(a) * r - unit * 0.5,
        shipY + Math.sin(a) * r * 0.8 - unit * 0.5,
        unit,
        unit,
      );
    }
  }

  // Shots along their lines, bolts down.
  const shots = new Path2D();
  state.shots.forEach((shot) => {
    shots.moveTo(shot.x, shot.y);
    shots.lineTo(shot.x - shot.dx * unit * 3.5, shot.y - shot.dy * unit * 3.5);
  });
  const bolts = new Path2D();
  state.bolts.forEach((bolt) => {
    const sway = Math.sin(seconds * 30 + bolt.seed) * unit * 0.6;
    bolts.moveTo(bolt.x - sway, bolt.y - unit * 3);
    bolts.lineTo(bolt.x + sway, bolt.y - unit * 1.5);
    bolts.lineTo(bolt.x - sway, bolt.y);
    bolts.lineTo(bolt.x + sway, bolt.y + unit * 1.5);
  });

  // The bursts: the classic explosion sprite, growing and fading, in
  // three alpha bands.
  const bursts: IBand[] = [0.95, 0.6, 0.25].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  state.bursts.forEach((burst) => {
    const age = (seconds - burst.bornAt) / BURST_LIFE;
    const size = unit * (0.7 + age * 1.6);
    const band = bursts[Math.min(2, Math.floor(age * 3))];
    rects(
      band.path,
      spriteRects(
        BURST.frames[0],
        burst.x,
        burst.y - (BURST.height * size) / 2,
        size,
      ),
    );
  });

  // The saucer, crossing the top when a big hit sent it.
  const saucer = new Path2D();
  const saucerAge = seconds - state.saucerAt;
  if (state.saucerAt >= 0 && saucerAge < SAUCER_CROSSING) {
    const x = sceneLeft + (saucerAge / SAUCER_CROSSING) * sceneWidth;
    const wobble = Math.sin(seconds * 6) * unit;
    rects(
      saucer,
      spriteRects(SAUCER.frames[0], x, top + unit * 2 + wobble, unit),
    );
  }

  return {
    shape,
    flash,
    stars,
    hull,
    canopy,
    stripes,
    shipFlash,
    flame,
    core,
    muzzle,
    shield,
    shots,
    bolts,
    bursts,
    saucer,
    unit,
    warp: state.warp,
    thump: state.thump,
    bass: state.bass,
  };
};

export type SpaceInvasionPaths = ReturnType<typeof createSpaceInvasionPaths>;
