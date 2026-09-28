import type { Projected } from 'common/graphStyles';

/**
 * The fireworks over the bridge.
 *
 * What made the old ones read as cheap was that a spark was a straight
 * segment in one flat colour that only faded. Real ones do three things
 * this now does:
 *
 *  - **They age through colour.** A spark leaves the break white hot,
 *    takes the shell's colour as it slows, and dies as a dull ember. The
 *    burst is painted as bands from the tail forward, each with its own
 *    hue and lightness, so one shell shows the whole ramp at once.
 *  - **They arc.** The tail is sampled along the trajectory in five
 *    pieces rather than one straight stub, so drag and gravity bend it.
 *  - **They break.** A ring of light expands out of the flash for a
 *    sixth of a second, which is the thing the eye reads as an explosion
 *    rather than a fade-in.
 *
 * And the water carries them: every burst above the horizon is mirrored
 * into the sea, squashed and dimmed, which is most of what a firework
 * over water actually looks like.
 */

/** A rocket climbs for this long before it breaks. */
export const ROCKET_CLIMB = 0.5;
/**
 * How many pieces a spark's tail is drawn in.
 *
 * Every piece is a segment per spark, and eight shells of fifty-six
 * sparks put that many segments on the frame; at five pieces with round
 * caps it was thirty milliseconds a frame, three times the whole budget,
 * because a round cap draws two half-discs per segment. Three pieces
 * still bend the tail, and only the head keeps round caps.
 */
const TAIL_STEPS = 3;
/** The hue an ember dies at: a dull orange. */
const EMBER_HUE = 24;
/** How far into the water a reflection reaches, as a fraction of its height. */
const REFLECTION_SQUASH = 0.55;

export type ShellKind =
  'peony' | 'chrysanthemum' | 'willow' | 'ring' | 'palm' | 'crackle' | 'strobe';

export const SHELL_KINDS: ShellKind[] = [
  'peony',
  'chrysanthemum',
  'willow',
  'ring',
  'palm',
  'crackle',
  'strobe',
];

/**
 * How each kind throws its sparks: how many, how fast, how heavy, how long
 * they trail, how thick they draw, whether they twinkle, how long the shell
 * lives, and how far its colour travels as the sparks cool.
 *
 * Willow is slow and long and turns to gold; crackle is many tiny
 * flickers; palm is a few fat arms; ring is one speed for every spark;
 * strobe barely moves and blinks hard.
 */
const SHELLS: Record<
  ShellKind,
  {
    sparks: number;
    speed: number;
    spread: number;
    gravity: number;
    tail: number;
    width: number;
    twinkle: boolean;
    life: number;
    /** Degrees the hue travels between the head and the end of the tail. */
    shift: number;
  }
> = {
  peony: {
    sparks: 36,
    speed: 1,
    spread: 0.2,
    gravity: 0.7,
    tail: 0.32,
    width: 1.6,
    twinkle: false,
    life: 1.5,
    shift: 18,
  },
  chrysanthemum: {
    sparks: 44,
    speed: 1,
    spread: 0.15,
    gravity: 0.6,
    tail: 0.7,
    width: 1.4,
    twinkle: true,
    life: 1.9,
    shift: 30,
  },
  willow: {
    sparks: 28,
    speed: 0.75,
    spread: 0.1,
    gravity: 1.3,
    tail: 1.1,
    width: 1.8,
    twinkle: false,
    life: 2.6,
    shift: 46,
  },
  ring: {
    sparks: 40,
    speed: 1.05,
    spread: 0,
    gravity: 0.35,
    tail: 0.18,
    width: 1.6,
    twinkle: false,
    life: 1.4,
    shift: -26,
  },
  palm: {
    sparks: 9,
    speed: 0.85,
    spread: 0.1,
    gravity: 0.9,
    tail: 0.55,
    width: 4,
    twinkle: false,
    life: 1.7,
    shift: 38,
  },
  crackle: {
    sparks: 56,
    speed: 0.9,
    spread: 0.45,
    gravity: 0.5,
    tail: 0.06,
    width: 1.2,
    twinkle: true,
    life: 1.6,
    shift: 0,
  },
  strobe: {
    sparks: 34,
    speed: 0.5,
    spread: 0.3,
    gravity: 0.25,
    tail: 0.04,
    width: 2.2,
    twinkle: true,
    life: 2.2,
    shift: 0,
  },
};

export interface IRocket {
  kind: ShellKind;
  x: number;
  /** Where it bursts, in plot pixels. */
  burstY: number;
  /** Where it launches from: the deck, at that x. */
  launchY: number;
  at: number;
  /** Degrees around the colour wheel: each rocket its own. */
  hue: number;
  strength: number;
}

/** A segment: where it starts, where it ends. */
export type TSegment = readonly [Projected, Projected];

/** One stroke of a burst: segments that share a colour, as numbers. */
export interface IFireworkStroke {
  segments: TSegment[];
  hue: number;
  /** 0..100, as HSL wants it. */
  lightness: number;
  alpha: number;
  width: number;
  /**
   * Round caps, for the head alone.
   *
   * The tail's pieces are chained end to end, so their joins need no cap;
   * rounding them anyway is two half-discs per segment on thousands of
   * segments, which is what made a sky full of shells unaffordable.
   */
  round?: boolean;
}

/** One rocket this frame, as numbers: what the painters draw it from. */
export interface IFireworkLayout {
  /** Painted in order: the tail's oldest piece first, the head last. */
  strokes: IFireworkStroke[];
  /** Twinkling sparks: the half of them lit this instant, painted white. */
  twinkle?: TSegment[];
  /** The white core of the break, for its first 150ms. */
  flash?: { x: number; y: number; r: number };
  /** The shock ring the break throws, for its first 180ms. */
  ring?: { x: number; y: number; r: number };
  ringWidth: number;
  ringAlpha: number;
  /** The whole burst mirrored into the water, when it is above it. */
  reflection?: TSegment[];
  reflectionAlpha: number;
  climbing: boolean;
}

/** One stroke of a burst, as a path. */
export interface IFireworkBand {
  path: Path2D;
  hue: number;
  lightness: number;
  alpha: number;
  width: number;
  round?: boolean;
}

export interface IFirework {
  bands: IFireworkBand[];
  twinkle?: Path2D;
  flash?: Path2D;
  ring?: Path2D;
  ringWidth: number;
  ringAlpha: number;
  reflection?: Path2D;
  reflectionAlpha: number;
  climbing: boolean;
}

/** The fireworks' saturation: every colour of theirs is a full one. */
export const FIREWORK_SATURATION = 100;

/**
 * A firework's colour, `hsl(hue, 100%, lightness%)`, as 0..1 channels — the
 * CSS conversion, for a painter that cannot be handed the string.
 */
export const fireworkRgb = (
  hue: number,
  lightness: number,
): [number, number, number] => {
  // Whole numbers, as the canvas's string carries them.
  const h = Number(hue.toFixed(0));
  const l = Number(lightness.toFixed(0)) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * (FIREWORK_SATURATION / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
};

/** The same colour as a canvas takes it. */
export const fireworkColour = (hue: number, lightness: number) =>
  `hsl(${hue.toFixed(0)}, ${FIREWORK_SATURATION}%, ${lightness.toFixed(0)}%)`;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/** Round the wheel the short way, so a shift never spins through 300°. */
const mixHue = (from: number, to: number, amount: number) => {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * amount + 360) % 360;
};

/**
 * How long a shell of this kind lives, so the caller can retire a rocket
 * without knowing the table.
 */
export const shellLife = (kind: ShellKind) => SHELLS[kind].life;

/** Which kind a rocket of this sequence number carries. */
export const shellFor = (seed: number) =>
  SHELL_KINDS[seed % SHELL_KINDS.length];

const climbStrokes = (
  rocket: IRocket,
  age: number,
  index: number,
): IFireworkStroke[] => {
  const climb = (time: number) => {
    const f = Math.max(0, Math.min(1, time / ROCKET_CLIMB));
    return (
      rocket.launchY + (rocket.burstY - rocket.launchY) * (1 - (1 - f) ** 2)
    );
  };
  /**
   * A TRAIL CANNOT REACH BACK PAST THE LAUNCH.
   *
   * Sampling at a fixed time behind the head and clamping the time at zero
   * puts every early piece on the deck, so the first frames after a launch
   * drew a line from the road to the rocket — which on a full screen is a
   * streak the height of the window. The trail grows to its length
   * instead.
   */
  const reachBack = (step: number) => Math.min(0.055 * step, age);
  // The trail in four pieces behind the head, each fainter and cooler, so
  // the rocket leaves a streak of sparks rather than a drawn line.
  const strokes: IFireworkStroke[] = [];
  for (let step = 4; step >= 1; step -= 1) {
    const from = climb(age - reachBack(step + 1));
    const to = climb(age - reachBack(step));
    const sway = Math.sin(age * 34 + index + step) * 1.4;
    strokes.push({
      segments: [
        [
          [rocket.x + sway, from],
          [rocket.x - sway, to],
        ],
      ],
      hue: EMBER_HUE,
      lightness: 52 + (4 - step) * 6,
      alpha: 0.16 + (4 - step) * 0.14,
      width: 1 + (4 - step) * 0.5,
    });
  }
  strokes.push({
    segments: [
      [
        [rocket.x, climb(age - Math.min(0.03, age))],
        [rocket.x, climb(age)],
      ],
    ],
    hue: rocket.hue,
    lightness: 92,
    alpha: 0.95,
    width: 3,
    round: true,
  });
  return strokes;
};

/**
 * Every rocket's drawing for this frame, as numbers.
 *
 * `horizon` is the waterline in the same space as the rest; a burst above
 * it gets a reflection. `level` is how loud the music is, so a shell over
 * a loud passage burns brighter than one over a quiet bar.
 */
export const fireworkLayout = (
  rockets: readonly IRocket[],
  seconds: number,
  sizeHeight: number,
  horizon: number,
  level: number,
): IFireworkLayout[] => {
  const fireworks: IFireworkLayout[] = [];
  rockets.forEach((rocket, index) => {
    const age = seconds - rocket.at;
    if (age < 0) {
      return;
    }
    const shell = SHELLS[rocket.kind];
    if (age < ROCKET_CLIMB) {
      fireworks.push({
        strokes: climbStrokes(rocket, age, index),
        ringWidth: 0,
        ringAlpha: 0,
        reflectionAlpha: 0,
        climbing: true,
      });
      return;
    }
    const t = age - ROCKET_CLIMB;
    const remaining = 1 - t / shell.life;
    if (remaining <= 0) {
      return;
    }
    const spent = 1 - remaining;
    const reach = sizeHeight * (0.16 + rocket.strength * 0.24) * shell.speed;
    const gravity = sizeHeight * shell.gravity;
    const glow = remaining * (0.7 + level * 0.3);

    const flash =
      t < 0.15
        ? {
            x: rocket.x,
            y: rocket.burstY,
            r: reach * 0.3 * (1 - t / 0.15) + 3,
          }
        : undefined;
    // The break: a ring of light leaving the flash. This is the thing that
    // reads as an explosion — without it a shell fades up out of nothing.
    let ring: { x: number; y: number; r: number } | undefined;
    let ringWidth = 0;
    let ringAlpha = 0;
    if (t < 0.18) {
      const f = t / 0.18;
      ring = { x: rocket.x, y: rocket.burstY, r: reach * (0.12 + f * 0.75) };
      ringWidth = Math.max(0.6, 4 * (1 - f));
      ringAlpha = 0.7 * (1 - f) ** 1.5;
    }

    // One set of segments per tail piece plus the head, so the burst can be
    // painted as a colour ramp instead of one flat hue.
    const pieces: TSegment[][] = [];
    for (let step = 0; step <= TAIL_STEPS; step += 1) {
      pieces.push([]);
    }
    const twinkle: TSegment[] | undefined = shell.twinkle ? [] : undefined;
    const reflection: TSegment[] | undefined =
      rocket.burstY < horizon ? [] : undefined;
    for (let spark = 0; spark < shell.sparks; spark += 1) {
      // Palm throws its arms upward; everything else all round.
      const angle =
        rocket.kind === 'palm'
          ? -Math.PI * 0.85 + (spark / (shell.sparks - 1)) * Math.PI * 0.7
          : (spark / shell.sparks) * Math.PI * 2 + index * 0.37;
      const speed =
        reach * (1 - shell.spread + noise(spark * 7 + index) * shell.spread);
      // Air drag: the burst slows as it spreads, so a shell stays a shell.
      const at = (time: number): Projected => {
        const drag = 1 - Math.exp(-Math.max(0, time) * 2.2);
        return [
          rocket.x + Math.cos(angle) * speed * drag,
          rocket.burstY +
            Math.sin(angle) * speed * drag +
            0.5 * gravity * Math.max(0, time) ** 2,
        ];
      };
      // A twinkling spark is lit only some frames: on when its seed and
      // the time agree, off otherwise, so the shell glitters.
      const lit = !twinkle || noise(spark * 3 + Math.floor(t * 24)) > 0.5;
      /**
       * Sampled back along the trajectory, so drag and gravity bend the
       * tail instead of it being a straight stub behind the head.
       *
       * The tail can only be as long as the shell is old. Sampling a fixed
       * time back and clamping at the break put every piece at the centre
       * of the burst for the first fraction of a second, which drew a
       * straight ray from every spark to the middle — a starburst of hard
       * lines, and the longer the shell's tail the worse it was.
       */
      const span = Math.min(shell.tail, t);
      let previous = at(t);
      for (let step = 0; lit && step <= TAIL_STEPS; step += 1) {
        const back = at(t - (span * (step + 1)) / TAIL_STEPS);
        pieces[step].push([previous, back]);
        if (step === 0) {
          twinkle?.push([previous, [previous[0] + 0.5, previous[1] + 0.5]]);
          // Every other spark only: the water is a broken mirror and
          // nobody counts them, and it halves the second copy of the burst.
          if (reflection && spark % 2 === 0) {
            // Mirrored about the waterline and squashed, with a slow
            // sideways wobble: the sea is not a mirror, it is water.
            const wobble = Math.sin(previous[1] * 0.05 + seconds * 2.2) * 3;
            const mirror = (p: Projected): Projected => [
              p[0] + wobble,
              horizon + (horizon - p[1]) * REFLECTION_SQUASH,
            ];
            reflection.push([mirror(previous), mirror(back)]);
          }
        }
        previous = back;
      }
    }

    // Back to front: the coolest, faintest piece of the tail first and the
    // white-hot head last.
    const strokes: IFireworkStroke[] = [];
    for (let step = TAIL_STEPS; step >= 1; step -= 1) {
      const along = step / TAIL_STEPS;
      strokes.push({
        segments: pieces[step],
        hue: mixHue(
          mixHue(rocket.hue, rocket.hue + shell.shift, along),
          EMBER_HUE,
          along * 0.55,
        ),
        lightness: 66 - along * 22 - spent * 14,
        alpha: glow * (0.34 - along * 0.2),
        width: Math.max(0.5, shell.width * (0.85 - along * 0.5)),
      });
    }
    /**
     * The head twice: a soft glow, then a thin core that cools from white
     * through the shell's colour as the shell dies.
     *
     * The glow is under two pixels wider than the core rather than three
     * times it. Width times length is what a stroke costs to raster, and a
     * sky of shells at three times the width was most of what put this
     * scene over the frame budget; carried at a higher alpha instead, the
     * halo reads the same.
     */
    strokes.push({
      segments: pieces[0],
      hue: rocket.hue,
      lightness: 58,
      alpha: glow * 0.55,
      width: shell.width + 1.8,
      round: true,
    });
    strokes.push({
      segments: pieces[0],
      hue: mixHue(rocket.hue, EMBER_HUE, spent * 0.4),
      lightness: 96 - spent * 34,
      alpha: glow,
      width: shell.width,
      round: true,
    });

    fireworks.push({
      strokes,
      twinkle,
      flash,
      ring,
      ringWidth,
      ringAlpha: ringAlpha * (0.7 + level * 0.3),
      reflection,
      reflectionAlpha: glow * 0.3,
      climbing: false,
    });
  });
  return fireworks;
};

/** Segments, each its own subpath, as one path. */
const segmentsPath = (segments: readonly TSegment[]) => {
  const path = new Path2D();
  segments.forEach(([[fromX, fromY], [toX, toY]]) => {
    path.moveTo(fromX, fromY);
    path.lineTo(toX, toY);
  });
  return path;
};

/** Every rocket's drawing for this frame, as paths for a canvas. */
export const createFireworkPaths = (
  layout: readonly IFireworkLayout[],
): IFirework[] =>
  layout.map((firework) => {
    let flash: Path2D | undefined;
    if (firework.flash) {
      const { x, y, r } = firework.flash;
      flash = new Path2D();
      flash.moveTo(x + r, y);
      flash.arc(x, y, r, 0, Math.PI * 2);
    }
    let ring: Path2D | undefined;
    if (firework.ring) {
      const { x, y, r } = firework.ring;
      ring = new Path2D();
      ring.moveTo(x + r, y);
      ring.arc(x, y, r, 0, Math.PI * 2);
    }
    return {
      bands: firework.strokes.map(({ segments, ...stroke }) => ({
        ...stroke,
        path: segmentsPath(segments),
      })),
      twinkle: firework.twinkle && segmentsPath(firework.twinkle),
      flash,
      ring,
      ringWidth: firework.ringWidth,
      ringAlpha: firework.ringAlpha,
      reflection: firework.reflection && segmentsPath(firework.reflection),
      reflectionAlpha: firework.reflectionAlpha,
      climbing: firework.climbing,
    };
  });
