import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import {
  ALIENS,
  BURST,
  invaderUnit,
  kindForColumn,
  PixelRect,
  POSE_DOWN,
  POSE_HALF,
  POSE_UP,
  SAUCER,
  SHIP,
  spriteRects,
  textBitmap,
} from 'common/graphInvaders';
import {
  ALIEN_FLOOR,
  ALIEN_SCORES,
  advanceInvaderCabinet,
  InvaderCabinet,
  SAUCER_SCORE,
  scoreInvader,
  SHIP_SCALE,
  startNextGame,
  strikeBunker,
} from './invaderCabinet';
import { createWreckPaths, EXPLODE_LIFE } from './invaderWreck';

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
  /** Fired at the saucer rather than at the formation. */
  atSaucer: boolean;
}

/** Points printed where they were won, rising and fading. */
interface IPopup {
  x: number;
  y: number;
  points: number;
  bornAt: number;
}

interface IBolt {
  x: number;
  y: number;
  seed: number;
  /** Aimed at the ship, from a bass hit; lands on it rather than passing. */
  aimed: boolean;
  /** Thrown by the saucer: a plasma ball rather than an alien's zigzag. */
  boss: boolean;
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
  /**
   * The formation's sideways step, in pixels, and where it is in the
   * four-beat right-centre-left-centre walk. The aliens hold their bands'
   * heights; it is only the march that moves them across, which is the one
   * thing everybody remembers about this cabinet.
   */
  march: number;
  marchPhase: number;
  shipX: number;
  shipTarget: number;
  roll: number;
  firedAt: number;
  fired: number;
  shieldAt: number;
  shipHitAt: number;
  /**
   * When the last ship was blown apart, or -1. The wreck flies for
   * `EXPLODE_LIFE`, then the next game's ship blinks in behind its bubble.
   */
  explodedAt: number;
  /**
   * Where the ship was when it blew apart. The wreck stays there: a dead
   * ship does not go on hunting the bands, and a fireball that slid along
   * the formation with the music read as the ship still flying.
   */
  wreckX: number;
  /**
   * The protecting bubble: up until `bubbleUntil`, and able to snap up by
   * itself again from `bubbleReadyAt`. See `BUBBLE_LIFE`.
   */
  bubbleUntil: number;
  bubbleReadyAt: number;
  popups: IPopup[];
  /** When the saucer on screen was shot down, or -1. */
  saucerDownAt: number;
  /** When the saucer last threw a plasma ball, for its cooldown. */
  bossFiredAt: number;
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

export const STARS = 340;
export const BURST_LIFE = 0.45;
export const SAUCER_CROSSING = 5;
const SHOT_LIMIT = 14;
const BOLT_LIMIT = 12;
const BURST_LIMIT = 16;
/** A shot's climb, a bolt's fall, in plot depths per second. */
const SHOT_SPEED = 3;
const BOLT_SPEED = 1.3;
/**
 * The aliens volley at the ship at most this often, in clock seconds. At
 * a second and a half a bass-heavy track put a volley in the air more
 * often than the ship could get out from under one.
 */
const VOLLEY_COOLDOWN = 3;
/** How long the screen shakes after the ship is hit, in clock seconds. */
export const SHAKE_LIFE = 0.35;
/** The new ship blinks in for this long, behind its bubble. */
export const RESPAWN_BLINK = 1;
/**
 * The protecting bubble lasts this long, and takes this long to charge
 * again once it has dropped.
 *
 * It exists because the ship died in a blink. A bass volley is three bolts
 * homing on it, and each one landing on a later frame counted as its own
 * hit — one volley could take all three ships. Now the first bolt to reach
 * the ship raises the bubble instead of hurting it, everything else in the
 * volley pops on it, and a ship only takes damage in the window while the
 * bubble is charging. A hit that does get through raises it too, so no
 * volley can cost more than one ship. The new game's ship arrives inside
 * one.
 */
export const BUBBLE_LIFE = 4;
export const BUBBLE_RECHARGE = 6;
/** The bubble's reach in ship pixels, and how much flatter it is than round. */
const BUBBLE_RADIUS = 13;
const BUBBLE_SQUASH = 0.8;
/** Points hang where they were won for this long. */
export const POPUP_LIFE = 0.9;
const POPUP_LIMIT = 10;
/**
 * The saucer fights back: on a beat while it is over the panel it throws a
 * plasma ball at the ship, no more often than this, in clock seconds.
 */
const BOSS_COOLDOWN = 0.7;
/** The gaps along the saucer's rim row that its running lights show in. */
const PORTHOLES = [3, 6, 9, 12];
/**
 * An alien's pose from how far its band has lifted it, 0 on the floor and
 * 1 at the ceiling: arms down through the bottom third, half raised through
 * the middle, fully up in the top third. Three steps rather than two, so
 * a band climbing past the middle does not snap from one pose to the other.
 */
export const poseFor = (lifted: number) => {
  if (lifted > 2 / 3) {
    return POSE_UP;
  }
  return lifted > 1 / 3 ? POSE_HALF : POSE_DOWN;
};
/**
 * Below this mean level the room is silent: the fighter drifts home to the
 * middle of the screen rather than hovering wherever the last note left it.
 */
const QUIET = 0.05;

/**
 * An alien's idle float: a slow bob, each on its own phase, so the formation
 * is alive in a quiet room without anything pretending to be music.
 */
export const alienBob = (index: number, seconds: number, unit: number) =>
  Math.sin(seconds * 1.7 + index * 0.9) * unit * 1.4;

const raiseBubble = (state: SpaceInvasion, seconds: number) => {
  state.bubbleUntil = seconds + BUBBLE_LIFE;
  state.bubbleReadyAt = seconds + BUBBLE_LIFE + BUBBLE_RECHARGE;
};

/** Where the saucer is at this age of its crossing, in the fight's space. */
const saucerAt = (
  age: number,
  left: number,
  width: number,
  top: number,
  unit: number,
  seconds: number,
) => ({
  x: left - width + (age / SAUCER_CROSSING) * width * 3,
  y: top + unit * 2 + Math.sin(seconds * 6) * unit + (SAUCER.height * unit) / 2,
});

/** How long ago the last ship was blown apart, or Infinity if it never was. */
const wreckAge = (state: SpaceInvasion, seconds: number) =>
  state.explodedAt < 0 ? Infinity : seconds - state.explodedAt;

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
  march: 0,
  marchPhase: 0,
  shipX: 0,
  shipTarget: 0,
  roll: 0,
  firedAt: -1,
  fired: 0,
  shieldAt: -1,
  shipHitAt: -1,
  explodedAt: -1,
  wreckX: 0,
  bubbleUntil: -1,
  // Ready from the first frame: the first bolt to reach the ship raises it.
  bubbleReadyAt: 0,
  popups: [],
  saucerDownAt: -1,
  bossFiredAt: -10,
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

/**
 * Where the ship flies: this far above the floor, in plot depths. Low, the
 * way the cabinet has it — the shelters and the formation's floor stack on
 * top of this lane, and every depth it climbs is taken from the range the
 * aliens have to show the spectrum in.
 */
export const SHIP_LANE = 0.16;

/**
 * An alien's centre for its column, kept between the saucer lane and the
 * shelters' roofs, so a quiet band parks on top of an arch instead of
 * standing inside it.
 *
 * `ceiling` is where the fight's sky starts: the plot's top, or lower when
 * the cabinet's readouts are printed across it — the saucer flies just
 * under the score, and the formation under the saucer.
 */
export const alienY = (
  y: number,
  top: number,
  bottom: number,
  unit: number,
  ceiling = top,
) => {
  const depth = bottom - top;
  return Math.max(
    Math.max(top, ceiling) + unit * 12,
    Math.min(bottom - depth * SHIP_LANE - unit * ALIEN_FLOOR, y),
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
  cabinet: InvaderCabinet,
  columns: readonly Projected[],
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
  sizeHeight: number,
  ceiling = top,
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
    state.marchPhase = (state.marchPhase + 1) % 4;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }
  // The step is eased rather than jumped: at a fast tempo a hard snap on
  // every beat reads as a flicker, and the cabinet's own march is a slide
  // between two positions rather than a teleport.
  const stepTo = [0, 1, 0, -1][state.marchPhase] * spacing * 0.22;
  state.march += (stepTo - state.march) * getEaseFactor(elapsedMs, 70);
  const alienX = (x: number) => x + state.march;

  // The last ship gone: it comes apart, the rack reads empty while the
  // wreck flies, and then the next game's ship arrives.
  if (advanceInvaderCabinet(cabinet, left, right, unit, state.shipHitAt)) {
    state.explodedAt = seconds;
    state.wreckX = state.shipX;
    state.shakeAt = seconds;
  }
  const wreck = wreckAge(state, seconds);
  if (wreck >= EXPLODE_LIFE && cabinet.lives === 0) {
    startNextGame(cabinet);
    raiseBubble(state, seconds);
  }
  // Nothing hits a ship that is not there.
  const wrecked = wreck < EXPLODE_LIFE;
  const addPopup = (x: number, y: number, points: number) => {
    if (state.popups.length >= POPUP_LIMIT) {
      state.popups.shift();
    }
    state.popups.push({ x, y, points, bornAt: seconds });
  };
  const saucerAge = seconds - state.saucerAt;
  const saucerFlying =
    state.saucerAt >= 0 &&
    saucerAge < SAUCER_CROSSING &&
    state.saucerDownAt < state.saucerAt;
  const saucerNow = saucerAt(saucerAge, left, width, ceiling, unit, seconds);

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
  // Dead, it does not hunt: the next ship arrives where the last one fell
  // and takes up the chase from there.
  if (rises[jumped] >= 0.08 && !wrecked) {
    state.shipTarget = alienX(columns[jumped][0]);
  }
  if (mean < QUIET && !wrecked) {
    state.shipTarget = (left + right) / 2;
  }
  const before = state.shipX;
  if (!wrecked) {
    state.shipX +=
      (state.shipTarget - state.shipX) * getEaseFactor(elapsedMs, 180);
  }
  const slide = dt > 0 ? (state.shipX - before) / dt / width : 0;
  state.roll +=
    (Math.max(-1, Math.min(1, slide * 1.5)) - state.roll) *
    getEaseFactor(elapsedMs, 90);

  // On the beat the ship fires at the two aliens whose bands rose most,
  // wherever they are, one shot from each cannon along the line to them.
  const shipY = bottom - depth * SHIP_LANE;
  if (beat && !wrecked && state.shots.length < SHOT_LIMIT) {
    const ranked = rises
      .map((rise, index) => ({ rise, index }))
      .sort((a, b) => b.rise - a.rise)
      .slice(0, 2);
    ranked.forEach(({ index }, shot) => {
      const side = shot === 0 ? -1 : 1;
      const [, ay] = columns[index];
      const ax = alienX(columns[index][0]);
      // The cannons are the wingtip stripes, five and a half ship pixels out.
      const fromX = state.shipX + side * unit * SHIP_SCALE * 5.5;
      const fromY = shipY - unit * 3;
      const dx = ax - fromX;
      const dy =
        alienY(ay, top, bottom, unit, ceiling) +
        alienBob(index, seconds, unit) -
        fromY;
      const length = Math.max(1, Math.hypot(dx, dy));
      state.shots.push({
        x: fromX,
        y: fromY,
        dx: dx / length,
        dy: dy / length,
        column: index,
        atSaucer: false,
      });
    });
    // While the saucer is over the panel the nose cannon goes for it,
    // leading it by the time the shot takes to climb — the bonus is won,
    // not handed out.
    const { x: sx, y: sy } = saucerNow;
    if (saucerFlying && sx > left && sx < right) {
      const fromY = shipY - unit * SHIP_SCALE * 8;
      const climb = (fromY - sy) / Math.max(1, depth * SHOT_SPEED);
      const lead = sx + ((width * 3) / SAUCER_CROSSING) * Math.max(0, climb);
      const dx = lead - state.shipX;
      const dy = sy - fromY;
      const length = Math.max(1, Math.hypot(dx, dy));
      state.shots.push({
        x: state.shipX,
        y: fromY,
        dx: dx / length,
        dy: dy / length,
        column: -1,
        atSaucer: true,
      });
    }
    state.firedAt = seconds;
    state.fired += 1;
  }
  const addBurst = (x: number, y: number) => {
    if (state.bursts.length >= BURST_LIMIT) {
      state.bursts.shift();
    }
    state.bursts.push({ x, y, bornAt: seconds });
  };
  state.shots = state.shots.filter((shot) => {
    const step = depth * SHOT_SPEED * dt;
    shot.x += shot.dx * step;
    shot.y += shot.dy * step;
    // The fighter's own shelter is in its way: a laser eats the underside
    // of the arch it was fired through, which is how the holes over its
    // head get there.
    if (strikeBunker(cabinet, shot.x, shot.y, unit, shipY, true)) {
      addBurst(shot.x, shot.y);
      return false;
    }
    if (shot.atSaucer) {
      // Up through the saucer's lane: a hit if it is still there and the
      // shot is under its hull, otherwise the shot leaves the top.
      if (shot.y > saucerNow.y + unit * 3) {
        return true;
      }
      const under =
        Math.abs(shot.x - saucerNow.x) < (SAUCER.width * unit) / 2 + unit;
      if (saucerFlying && under) {
        state.saucerDownAt = seconds;
        scoreInvader(cabinet, SAUCER_SCORE);
        addBurst(saucerNow.x, saucerNow.y);
        addPopup(saucerNow.x, saucerNow.y, SAUCER_SCORE);
        return false;
      }
      return shot.y > top - depth * 0.5;
    }
    const [, ay] = columns[shot.column];
    const ax = alienX(columns[shot.column][0]);
    const targetY =
      alienY(ay, top, bottom, unit, ceiling) +
      alienBob(shot.column, seconds, unit);
    if (shot.y > targetY + unit * 2) {
      return true;
    }
    state.hitAt[shot.column] = seconds;
    const points = ALIEN_SCORES[kindForColumn(shot.column, columns.length)];
    scoreInvader(cabinet, points);
    addBurst(ax, targetY);
    addPopup(ax, targetY, points);
    return false;
  });
  state.popups = state.popups.filter(
    (popup) => seconds - popup.bornAt < POPUP_LIFE,
  );
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
    const [, y] = columns[column];
    state.bolts.push({
      x: alienX(columns[column][0]),
      y: alienY(y, top, bottom, unit, ceiling) + unit * 5,
      seed,
      aimed: false,
      boss: false,
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
      const [, y] = columns[column];
      state.bolts.push({
        x: alienX(columns[column][0]),
        y: alienY(y, top, bottom, unit, ceiling) + unit * 5,
        seed: state.fired * 11 + i,
        aimed: true,
        boss: false,
      });
    });
  }
  // The boss fights back: on the beat, while it is over the panel, the
  // saucer drops a plasma ball that homes on the ship.
  if (
    beat &&
    saucerFlying &&
    saucerNow.x > left &&
    saucerNow.x < right &&
    seconds - state.bossFiredAt >= BOSS_COOLDOWN &&
    state.bolts.length < BOLT_LIMIT
  ) {
    state.bossFiredAt = seconds;
    state.bolts.push({
      x: saucerNow.x,
      y: saucerNow.y + (SAUCER.height * unit) / 2,
      seed: state.fired * 13 + 7,
      aimed: true,
      boss: true,
    });
  }
  state.bolts = state.bolts.filter((bolt) => {
    bolt.y += depth * BOLT_SPEED * (bolt.boss ? 0.8 : 1) * dt;
    if (bolt.aimed) {
      // Homing: it drifts toward the ship as it falls.
      bolt.x += (state.shipX - bolt.x) * getEaseFactor(elapsedMs, 150);
    }
    // The shelter takes it first. That is what a shelter is for, and it is
    // why the fighter can stand under one through a heavy bar.
    if (strikeBunker(cabinet, bolt.x, bolt.y, unit, shipY, false)) {
      addBurst(bolt.x, bolt.y);
      return false;
    }
    // With the bubble up a bolt pops on its skin, not inside it.
    const skin =
      seconds < state.bubbleUntil
        ? unit * SHIP_SCALE * BUBBLE_RADIUS * BUBBLE_SQUASH
        : unit * 6;
    if (bolt.y < shipY - skin) {
      return true;
    }
    // An aimed bolt lands: it was fired at the ship and has homed on it
    // all the way down. A stray one lands only if the ship is under it.
    // Half the fighter's fifteen-pixel span either side of its middle.
    const underIt =
      bolt.aimed ||
      Math.abs(bolt.x - state.shipX) < unit * SHIP_SCALE * (SHIP.width / 2);
    if (!underIt || wrecked) {
      return false;
    }
    // The bubble takes it if it is up, or snaps up to take it if it has
    // charged; only a bolt that arrives while it is charging gets through,
    // and that raises it too — see `BUBBLE_LIFE`.
    state.shieldAt = seconds;
    if (seconds < state.bubbleUntil) {
      return false;
    }
    if (seconds < state.bubbleReadyAt) {
      state.shipHitAt = seconds;
      state.shakeAt = seconds;
    }
    raiseBubble(state, seconds);
    return false;
  });
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
  state.bassLevel = Math.max(bass, state.bassLevel * release);

  // A big hit sends the saucer across the top, for the fighter's nose
  // cannon to try for.
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
  ceiling = top,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);
  const spacing = width / Math.max(1, columns.length - 1);
  const unit = invaderUnit(sizeHeight, spacing);
  // The stars reach half a depth above and below the plot: the panel has
  // margins, and a scene may overflow them.
  const sceneTop = top - depth * 0.5;
  const sceneHeight = depth * 1.7;

  // The stars, three layers: the near ones streak longest in warp.
  //
  // Spread over the PANEL rather than over the saucer's run-up. The saucer
  // flies in from a plot's width off each end, and scattering the stars
  // across all of that put two thirds of them where nobody can see them —
  // the field on screen read as drizzle.
  const stars: IBand[] = [0.45, 0.7, 1].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  const starLeft = left - width * 0.04;
  const starWidth = width * 1.08;
  // Short. At fourteen pixels a unit of warp three hundred stars became a
  // downpour — the screenshot read as rain on a window, not space — and the
  // far layer does not streak at all, so there is depth to fly through.
  const streak = unit * (0.3 + state.warp * 4);
  state.stars.forEach((star) => {
    const x = starLeft + star.u * starWidth;
    const y = sceneTop + star.v * sceneHeight;
    const band = stars[layerOf(star.near)];
    band.path.moveTo(x, y);
    const far = layerOf(star.near) === 0;
    band.path.lineTo(x, y - (far ? 1 : Math.max(1.5, streak * star.near)));
  });

  // The formation: every column's alien, the figure — arms down at rest,
  // thrown up for a moment when its band jumps, each one floating on its
  // own slow bob. A hit alien flashes white for a tenth of a second.
  const shape = new Path2D();
  const flash = new Path2D();
  // The pose follows how high the band has lifted its alien: arms down on
  // the floor, half up through the middle, fully up at the ceiling.
  const floorY = bottom - depth * SHIP_LANE - unit * ALIEN_FLOOR;
  const ceilingY = Math.max(top, ceiling) + unit * 12;
  const reach = Math.max(1, floorY - ceilingY);
  columns.forEach(([x, y], index) => {
    const alien = ALIENS[kindForColumn(index, columns.length)];
    const rest = alienY(y, top, bottom, unit, ceiling);
    const lifted = (floorY - rest) / reach;
    const pose = poseFor(lifted);
    const frame = alien.frames[pose] ?? alien.frames[0];
    const cy = rest + alienBob(index, seconds, unit);
    const pixels = spriteRects(
      frame,
      x + state.march,
      cy - (alien.height * unit) / 2,
      unit,
    );
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
  // The ship is drawn larger than an alien: it is the hero.
  const ship = unit * SHIP_SCALE;
  const shipTop = shipY - (SHIP.height * ship) / 2;
  const shear = -state.roll * 0.35;
  // Gone while its wreck flies; then blinking in, the way a new ship
  // arrives on the cabinet — on for a twelfth of a second, off for one.
  const wreck = wreckAge(state, seconds);
  const blinkingIn =
    wreck >= EXPLODE_LIFE && wreck < EXPLODE_LIFE + RESPAWN_BLINK;
  const shipShown =
    wreck >= EXPLODE_LIFE && (!blinkingIn || Math.floor(wreck * 12) % 2 === 0);
  const hull = new Path2D();
  const canopy = new Path2D();
  const stripes = new Path2D();
  const flame = new Path2D();
  const core = new Path2D();
  if (shipShown) {
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
  }
  const shipFlash = new Path2D();
  if (state.shipHitAt >= 0 && seconds - state.shipHitAt < 0.1) {
    shipFlash.addPath(hull);
    shipFlash.addPath(canopy);
    shipFlash.addPath(stripes);
  }
  const wreckage =
    wreck < EXPLODE_LIFE
      ? createWreckPaths(state.wreckX, shipY, ship, wreck)
      : undefined;
  // The muzzle flash: a pixel cross at each cannon for the first frames
  // after a shot.
  const muzzle = new Path2D();
  if (shipShown && state.firedAt >= 0 && seconds - state.firedAt < 0.08) {
    [-5.5, 5.5].forEach((cannon) => {
      const mx = state.shipX + cannon * ship;
      const my = shipTop + 5 * ship;
      muzzle.rect(mx - ship * 1.5, my - ship * 0.5, ship * 3, ship);
      muzzle.rect(mx - ship * 0.5, my - ship * 1.5, ship, ship * 3);
    });
  }
  // The bubble: a ring of pixels round the ship while it protects, swelling
  // on the beat, rippling outward when a bolt pops on it, and blinking
  // through its last second so the drop is seen coming. Its skin is where
  // the bolts stop — see the landing test.
  const shield = new Path2D();
  const bubbleLeft = state.bubbleUntil - seconds;
  const ripple = seconds - state.shieldAt;
  const rippling = state.shieldAt >= 0 && ripple < 0.25;
  const bubbleUp =
    shipShown &&
    bubbleLeft > 0 &&
    (bubbleLeft > 1 || Math.floor(bubbleLeft * 10) % 2 === 0);
  if (bubbleUp) {
    const r =
      ship * (BUBBLE_RADIUS + state.thump * 1.2 + (rippling ? ripple * 10 : 0));
    const dots = 32;
    for (let step = 0; step < dots; step += 1) {
      const a = (step / dots) * Math.PI * 2 + seconds * 0.8;
      shield.rect(
        state.shipX + Math.cos(a) * r - unit * 0.5,
        shipY + Math.sin(a) * r * BUBBLE_SQUASH - unit * 0.5,
        unit,
        unit,
      );
    }
  }

  // The points, where they were won: rising, bright for the first half of
  // their life and dim for the second — two fills rather than an alpha per
  // number.
  const popups = new Path2D();
  const popupsFading = new Path2D();
  const popupSize = Math.max(1, unit * 0.55);
  state.popups.forEach((popup) => {
    const age = seconds - popup.bornAt;
    rects(
      age < POPUP_LIFE / 2 ? popups : popupsFading,
      spriteRects(
        textBitmap(String(popup.points)),
        popup.x,
        // Never up into the readout row: the saucer's 300 rose straight
        // into the hi-score and printed over it.
        Math.max(ceiling + unit, popup.y - unit * 6 - age * unit * 14),
        popupSize,
      ),
    );
  });

  // Shots along their lines, bolts down.
  const shots = new Path2D();
  state.shots.forEach((shot) => {
    shots.moveTo(shot.x, shot.y);
    shots.lineTo(shot.x - shot.dx * unit * 3.5, shot.y - shot.dy * unit * 3.5);
  });
  const bolts = new Path2D();
  // The saucer's plasma: a white-hot core, a flickering ring of flame round
  // it and a tail of embers shrinking behind — pixels on the cabinet's grid,
  // so the boss's fire is plainly not an alien's zigzag.
  const plasmaCore = new Path2D();
  const plasmaFlame = new Path2D();
  state.bolts.forEach((bolt) => {
    if (bolt.boss) {
      const tick = Math.floor(seconds * 24);
      plasmaCore.rect(bolt.x - unit, bolt.y - unit, unit * 2, unit * 2);
      for (let spark = 0; spark < 8; spark += 1) {
        const a = (spark / 8) * Math.PI * 2 + tick * 0.4;
        const r = unit * (1.8 + noise(bolt.seed + spark + tick) * 0.9);
        plasmaFlame.rect(
          bolt.x + Math.cos(a) * r - unit * 0.5,
          bolt.y + Math.sin(a) * r - unit * 0.5,
          unit,
          unit,
        );
      }
      for (let ember = 1; ember <= 4; ember += 1) {
        const size = unit * (1.4 - ember * 0.25);
        const drift = (noise(bolt.seed * 3 + ember + tick) - 0.5) * unit;
        plasmaFlame.rect(
          bolt.x + drift - size / 2,
          bolt.y - unit * 1.6 * ember - size / 2,
          size,
          size,
        );
      }
      return;
    }
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

  // The saucer, crossing the top when a big hit sent it, until the nose
  // cannon brings it down.
  const saucer = new Path2D();
  const saucerLights = new Path2D();
  const saucerAge = seconds - state.saucerAt;
  if (
    state.saucerAt >= 0 &&
    saucerAge < SAUCER_CROSSING &&
    state.saucerDownAt < state.saucerAt
  ) {
    const at = saucerAt(saucerAge, left, width, ceiling, unit, seconds);
    const hullTop = at.y - (SAUCER.height * unit) / 2;
    rects(saucer, spriteRects(SAUCER.frames[0], at.x, hullTop, unit));
    // Running lights in the portholes along its rim, chasing round — the
    // boss is lit up, not a flat red stamp.
    const leftEdge = at.x - (SAUCER.width * unit) / 2;
    const chase = Math.floor(seconds * 10) % PORTHOLES.length;
    PORTHOLES.forEach((column, index) => {
      if (index === chase || index === (chase + 2) % PORTHOLES.length) {
        saucerLights.rect(
          leftEdge + column * unit,
          hullTop + unit * 3,
          unit,
          unit,
        );
      }
    });
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
    saucerLights,
    plasmaCore,
    plasmaFlame,
    wreckage,
    popups,
    popupsFading,
    unit,
    warp: state.warp,
    thump: state.thump,
    bass: state.bass,
  };
};

export type SpaceInvasionPaths = ReturnType<typeof createSpaceInvasionPaths>;
