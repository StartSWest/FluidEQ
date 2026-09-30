import {
  ALIENS,
  BURST,
  PixelRect,
  SAUCER,
  SHIP,
  invaderUnit,
  kindForColumn,
  spriteRects,
  textBitmap,
} from 'common/graphInvaders';
import { type Projected } from 'common/graphStyles';
import noise from 'common/seededNoise';
import { ALIEN_FLOOR, SHIP_SCALE } from './invaderCabinet';
import { EXPLODE_LIFE, wreckLayout } from './invaderWreck';
import rectsPath from './pixelRects';
import type { SpaceInvasion } from './spaceInvasion';
import {
  BUBBLE_RADIUS,
  BUBBLE_SQUASH,
  BURST_ALPHAS,
  BURST_LIFE,
  POPUP_LIFE,
  PORTHOLES,
  RESPAWN_BLINK,
  SAUCER_CROSSING,
  SHIP_LANE,
  STAR_ALPHAS,
  alienBob,
  alienY,
  poseFor,
  saucerAt,
  wreckAge,
} from './spaceInvasion';

// Where everything in the arcade stands on a frame, and the paths it is
// drawn with, read from the invasion spaceInvasion.ts advances.

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

/** One star: where its streak starts, how far up it runs, which layer. */
export interface IInvasionStar {
  x: number;
  y: number;
  length: number;
  layer: number;
}

/**
 * A pixel flame under an engine: rows of pixels narrowing to the tip,
 * jittering row by row on the clock, `length` rows long. The top half is
 * the hot core.
 */
const pixelFlame = (
  flame: PixelRect[],
  core: PixelRect[],
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
    flame.push([x, y, wide * unit, unit]);
    if (t < 0.5 && wide > 1) {
      core.push([x + unit * 0.5, y, (wide - 1) * unit, unit]);
    }
  }
};

/**
 * The fight as it stands this frame, as pixel rectangles and lines: the
 * stars, the formation alien by alien and which of them flash, the
 * fighter's layers and flames, its muzzle and bubble, the wreck, the
 * points won, the lasers and bolts, the saucer's plasma, the bursts and
 * the saucer. What the page's canvas and the engine's invaders
 * (`engineLooks/designed/invadersLook.ts`) both draw.
 */
export const spaceInvasionLayout = (
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
  const starLeft = left - width * 0.04;
  const starWidth = width * 1.08;
  // Short. At fourteen pixels a unit of warp three hundred stars became a
  // downpour — the screenshot read as rain on a window, not space — and the
  // far layer does not streak at all, so there is depth to fly through.
  const streak = unit * (0.3 + state.warp * 4);
  const stars: IInvasionStar[] = state.stars.map((star) => {
    const layer = layerOf(star.near);
    return {
      x: starLeft + star.u * starWidth,
      y: sceneTop + star.v * sceneHeight,
      length: layer === 0 ? 1 : Math.max(1.5, streak * star.near),
      layer,
    };
  });

  // The formation: every column's alien, the figure — arms down at rest,
  // thrown up for a moment when its band jumps, each one floating on its
  // own slow bob. A hit alien flashes white for a tenth of a second.
  // The pose follows how high the band has lifted its alien: arms down on
  // the floor, half up through the middle, fully up at the ceiling.
  const floorY = bottom - depth * SHIP_LANE - unit * ALIEN_FLOOR;
  const ceilingY = Math.max(top, ceiling) + unit * 12;
  const reach = Math.max(1, floorY - ceilingY);
  const aliens = columns.map(([x, y], index) => {
    const alien = ALIENS[kindForColumn(index, columns.length)];
    const rest = alienY(y, top, bottom, unit, ceiling);
    const pose = poseFor((floorY - rest) / reach);
    const frame = alien.frames[pose] ?? alien.frames[0];
    const cy = rest + alienBob(index, seconds, unit);
    return {
      rects: spriteRects(
        frame,
        x + state.march,
        cy - (alien.height * unit) / 2,
        unit,
      ),
      /** Across, where the alien's middle stands. */
      middle: x + state.march,
      flash: seconds - (state.hitAt[index] ?? -1) < 0.1,
    };
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
  const layerRects = (glyph: string) =>
    shipShown
      ? spriteRects(SHIP.frames[0], state.shipX, shipTop, ship, glyph, shear)
      : [];
  const hull = layerRects('X');
  const canopy = layerRects('C');
  const stripes = layerRects('R');
  const flame: PixelRect[] = [];
  const core: PixelRect[] = [];
  if (shipShown) {
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
  const shipFlash = state.shipHitAt >= 0 && seconds - state.shipHitAt < 0.1;
  const wreckage =
    wreck < EXPLODE_LIFE
      ? wreckLayout(state.wreckX, shipY, ship, wreck)
      : undefined;
  // The muzzle flash: a pixel cross at each cannon for the first frames
  // after a shot.
  const muzzle: PixelRect[] = [];
  if (shipShown && state.firedAt >= 0 && seconds - state.firedAt < 0.08) {
    [-5.5, 5.5].forEach((cannon) => {
      const mx = state.shipX + cannon * ship;
      const my = shipTop + 5 * ship;
      muzzle.push([mx - ship * 1.5, my - ship * 0.5, ship * 3, ship]);
      muzzle.push([mx - ship * 0.5, my - ship * 1.5, ship, ship * 3]);
    });
  }
  // The bubble: a ring of pixels round the ship while it protects, swelling
  // on the beat, rippling outward when a bolt pops on it, and blinking
  // through its last second so the drop is seen coming. Its skin is where
  // the bolts stop — see the landing test.
  const shield: PixelRect[] = [];
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
      shield.push([
        state.shipX + Math.cos(a) * r - unit * 0.5,
        shipY + Math.sin(a) * r * BUBBLE_SQUASH - unit * 0.5,
        unit,
        unit,
      ]);
    }
  }

  // The points, where they were won: rising, bright for the first half of
  // their life and dim for the second — two fills rather than an alpha per
  // number.
  const popups: PixelRect[] = [];
  const popupsFading: PixelRect[] = [];
  const popupSize = Math.max(1, unit * 0.55);
  state.popups.forEach((popup) => {
    const age = seconds - popup.bornAt;
    (age < POPUP_LIFE / 2 ? popups : popupsFading).push(
      ...spriteRects(
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
  const shots: Projected[][] = state.shots.map((shot) => [
    [shot.x, shot.y],
    [shot.x - shot.dx * unit * 3.5, shot.y - shot.dy * unit * 3.5],
  ]);
  const bolts: Projected[][] = [];
  // The saucer's plasma: a white-hot core, a flickering ring of flame round
  // it and a tail of embers shrinking behind — pixels on the cabinet's grid,
  // so the boss's fire is plainly not an alien's zigzag.
  const plasmaCore: PixelRect[] = [];
  const plasmaFlame: PixelRect[] = [];
  state.bolts.forEach((bolt) => {
    if (bolt.boss) {
      const tick = Math.floor(seconds * 24);
      plasmaCore.push([bolt.x - unit, bolt.y - unit, unit * 2, unit * 2]);
      for (let spark = 0; spark < 8; spark += 1) {
        const a = (spark / 8) * Math.PI * 2 + tick * 0.4;
        const r = unit * (1.8 + noise(bolt.seed + spark + tick) * 0.9);
        plasmaFlame.push([
          bolt.x + Math.cos(a) * r - unit * 0.5,
          bolt.y + Math.sin(a) * r - unit * 0.5,
          unit,
          unit,
        ]);
      }
      for (let ember = 1; ember <= 4; ember += 1) {
        const size = unit * (1.4 - ember * 0.25);
        const drift = (noise(bolt.seed * 3 + ember + tick) - 0.5) * unit;
        plasmaFlame.push([
          bolt.x + drift - size / 2,
          bolt.y - unit * 1.6 * ember - size / 2,
          size,
          size,
        ]);
      }
      return;
    }
    const sway = Math.sin(seconds * 30 + bolt.seed) * unit * 0.6;
    bolts.push([
      [bolt.x - sway, bolt.y - unit * 3],
      [bolt.x + sway, bolt.y - unit * 1.5],
      [bolt.x - sway, bolt.y],
      [bolt.x + sway, bolt.y + unit * 1.5],
    ]);
  });

  // The bursts: the classic explosion sprite, growing and fading, in
  // three alpha bands.
  const bursts: PixelRect[][] = [[], [], []];
  state.bursts.forEach((burst) => {
    const age = (seconds - burst.bornAt) / BURST_LIFE;
    const size = unit * (0.7 + age * 1.6);
    bursts[Math.min(2, Math.floor(age * 3))].push(
      ...spriteRects(
        BURST.frames[0],
        burst.x,
        burst.y - (BURST.height * size) / 2,
        size,
      ),
    );
  });

  // The saucer, crossing the top when a big hit sent it, until the nose
  // cannon brings it down.
  let saucer: PixelRect[] = [];
  const saucerLights: PixelRect[] = [];
  const saucerAge = seconds - state.saucerAt;
  if (
    state.saucerAt >= 0 &&
    saucerAge < SAUCER_CROSSING &&
    state.saucerDownAt < state.saucerAt
  ) {
    const at = saucerAt(saucerAge, left, width, ceiling, unit, seconds);
    const hullTop = at.y - (SAUCER.height * unit) / 2;
    saucer = spriteRects(SAUCER.frames[0], at.x, hullTop, unit);
    // Running lights in the portholes along its rim, chasing round — the
    // boss is lit up, not a flat red stamp.
    const leftEdge = at.x - (SAUCER.width * unit) / 2;
    const chase = Math.floor(seconds * 10) % PORTHOLES.length;
    PORTHOLES.forEach((column, index) => {
      if (index === chase || index === (chase + 2) % PORTHOLES.length) {
        saucerLights.push([
          leftEdge + column * unit,
          hullTop + unit * 3,
          unit,
          unit,
        ]);
      }
    });
  }

  return {
    stars,
    starAlphas: STAR_ALPHAS,
    aliens,
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
    burstAlphas: BURST_ALPHAS,
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

export type SpaceInvasionLayout = ReturnType<typeof spaceInvasionLayout>;

/** Lines, each its own subpath, as one path. */
const linesPath = (lines: readonly Projected[][]) => {
  const path = new Path2D();
  lines.forEach(([[fromX, fromY], ...rest]) => {
    path.moveTo(fromX, fromY);
    rest.forEach(([x, y]) => path.lineTo(x, y));
  });
  return path;
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
  const layout = spaceInvasionLayout(
    state,
    columns,
    top,
    bottom,
    seconds,
    sizeHeight,
    ceiling,
  );
  const stars: IBand[] = layout.starAlphas.map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  layout.stars.forEach(({ x, y, length, layer }) => {
    stars[layer].path.moveTo(x, y);
    stars[layer].path.lineTo(x, y - length);
  });
  const hull = rectsPath(layout.hull);
  const canopy = rectsPath(layout.canopy);
  const stripes = rectsPath(layout.stripes);
  const shipFlash = new Path2D();
  if (layout.shipFlash) {
    shipFlash.addPath(hull);
    shipFlash.addPath(canopy);
    shipFlash.addPath(stripes);
  }
  const { wreckage } = layout;
  return {
    shape: rectsPath(layout.aliens.flatMap(({ rects }) => rects)),
    flash: rectsPath(
      layout.aliens.filter(({ flash }) => flash).flatMap(({ rects }) => rects),
    ),
    stars,
    hull,
    canopy,
    stripes,
    shipFlash,
    flame: rectsPath(layout.flame),
    core: rectsPath(layout.core),
    muzzle: rectsPath(layout.muzzle),
    shield: rectsPath(layout.shield),
    shots: linesPath(layout.shots),
    bolts: linesPath(layout.bolts),
    bursts: layout.bursts.map((list, band): IBand => ({
      path: rectsPath(list),
      alpha: layout.burstAlphas[band],
    })),
    saucer: rectsPath(layout.saucer),
    saucerLights: rectsPath(layout.saucerLights),
    plasmaCore: rectsPath(layout.plasmaCore),
    plasmaFlame: rectsPath(layout.plasmaFlame),
    wreckage: wreckage && {
      hull: rectsPath(wreckage.hull),
      canopy: rectsPath(wreckage.canopy),
      stripes: rectsPath(wreckage.stripes),
      fire: rectsPath(wreckage.fire),
      heart: rectsPath(wreckage.heart),
      glow: wreckage.glow,
      flash: wreckage.flash,
    },
    popups: rectsPath(layout.popups),
    popupsFading: rectsPath(layout.popupsFading),
    unit: layout.unit,
    warp: layout.warp,
    thump: layout.thump,
    bass: layout.bass,
    layout,
  };
};

export type SpaceInvasionPaths = ReturnType<typeof createSpaceInvasionPaths>;
