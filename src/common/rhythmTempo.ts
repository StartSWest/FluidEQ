/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The tempo and where the beat is, from the onset history (`sceneRhythm.ts`):
 * pure functions of that history, so each can be held on its own.
 */

/** The onset history's resolution: a hundred values a second. */
export const OSS_HOP_MS = 10;
/** The tempos looked for. Dance music lives well inside them. */
export const MIN_TEMPO = 60;
export const MAX_TEMPO = 200;
/** No tempo is guessed from less than this many hops: three seconds. */
const OSS_MIN = 300;

/**
 * Where the looking starts when nothing says otherwise: the middle of pop and
 * dance. Autocorrelation cannot tell 70 from 140 on its own, and a scene that
 * dances at half speed looks bored, at double speed frantic.
 */
const PREFERRED_TEMPO = 120;

/**
 * How much the estimate leans towards the tempo already kept. A song keeps
 * its tempo, and its onsets always also fit half, double, two-thirds and
 * three-halves of it: measured on fifteen songs, an estimate with no memory
 * wandered between those mid-song - Take On Me from 169 to 85 to 113,
 * Firework from 124 to 83 - and a dancer changed speed with it.
 */
const CONTINUITY = 0.35;
/** How narrow that lean is, in octaves: about two percent of the tempo. */
const CONTINUITY_WIDTH = 0.03;

/**
 * The multiples of a period the comb looks at, and how much each counts: the
 * beat, two beats, three, and the bar of four, which counts as much as the
 * beat. Music repeats every bar more surely than anywhere else, and the bar is
 * what tells a beat from two-thirds or three-halves of it, whose four land a
 * fraction of a bar away. Say You Won't Let Go (96, by its sheet music) picks
 * its guitar in threes and threes and a two across each bar, so it repeats
 * every three eighths as well as every beat: counted at a quarter, the bar
 * lost, and the song was heard at 64 half the time; counted in full, never.
 * Over the 22 real songs, 87% on the tempo became 89%, and 97% on it or an
 * octave of it 99%.
 */
const COMB = [1, 0.5, 1 / 3, 1];

/**
 * The periods tried, each this much longer than the last: half a percent, a
 * tenth of the four percent a tempo is allowed to be off by.
 */
const LAG_STEP = 0.005;

/**
 * How much the half of a period counts beside its multiples. Music whose
 * every part runs in even eighths - Take On Me's riff, bass and drums alike -
 * repeats as well every two eighths as every three or four, and the comb
 * scored 169, 113 and 85 within 2% of each other; what the preference for
 * 120 then picked was 113, which no one taps. What tells them apart is that
 * a beat splits in two: half of 169's beat is an eighth, where the music
 * repeats (+0.6), and half of 113's falls between two (-0.5).
 */
const HALF_SHARE = 0.5;

/**
 * The tempos a song's onsets always also fit, as ratios to the true one.
 * Moving to one of these is counting the same music differently, and takes
 * far more agreement than moving to anything else.
 */
const RELATED_RATIOS = [0.5, 2 / 3, 0.75, 4 / 3, 1.5, 2];

export const isRelated = (ratio: number) =>
  RELATED_RATIOS.some((related) => Math.abs(ratio / related - 1) < 0.04);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * The tempo the onsets keep, and how clearly: the lag at which the onset
 * history most resembles itself, weighted towards PREFERRED_TEMPO so the
 * octave is the one a listener would tap, and scored as a comb - the lag, its
 * double, its triple and its quadruple - so the true beat, whose every
 * multiple lines up, wins over two-thirds of it, which lines up only on
 * every other one. Leans towards `held`, the tempo already kept.
 */
export const estimateTempo = (
  history: Float32Array,
  held = 0,
): { tempo: number; clarity: number } | undefined => {
  const count = history.length;
  if (count < OSS_MIN) {
    return undefined;
  }
  // A little smoothing, so a hit's timing wobble of a hop or two is not a
  // rhythm of its own.
  const smooth = new Float32Array(count);
  let mean = 0;
  for (let at = 0; at < count; at += 1) {
    let sum = 0;
    let weight = 0;
    for (let near = -2; near <= 2; near += 1) {
      const value = history[at + near];
      if (value !== undefined) {
        const share = 3 - Math.abs(near);
        sum += share * value;
        weight += share;
      }
    }
    smooth[at] = sum / weight;
    mean += smooth[at];
  }
  mean /= count;
  let energy = 0;
  for (let at = 0; at < count; at += 1) {
    smooth[at] -= mean;
    energy += smooth[at] * smooth[at];
  }
  energy /= count;
  if (energy < 1e-12) {
    return undefined;
  }
  const shortest = 60_000 / MAX_TEMPO / OSS_HOP_MS;
  const longest = 60_000 / MIN_TEMPO / OSS_HOP_MS;
  const reach = Math.floor(count / 2) + 1;
  const correlations = new Float32Array(reach + 1);
  for (let lag = 0; lag <= reach; lag += 1) {
    let sum = 0;
    for (let at = lag; at < count; at += 1) {
      sum += smooth[at] * smooth[at - lag];
    }
    correlations[lag] = sum / (count - lag) / energy;
  }
  // Read between two lags where a multiple falls between them. Read at the
  // lag nearest each multiple, the error grew with every multiple - a fifth
  // of a hop at the first was four fifths at the fourth - and whichever
  // tempo happened to put its lag on a whole number of hops won: Take On Me
  // at 10 ms hops heard at two-thirds of its 169, whose lag of 53.2 hops
  // lined all four up while 169's own, 35.5, missed every one.
  const correlation = (lag: number) => {
    const whole = Math.floor(lag);
    const part = lag - whole;
    return (
      correlations[whole] * (1 - part) +
      (correlations[Math.min(reach, whole + 1)] ?? 0) * part
    );
  };
  // Each multiple counted only while half the history still overlaps it,
  // and the comb's weights shared out over the multiples that were counted,
  // so a slow tempo is not scored on fewer terms than a fast one.
  const comb = (lag: number) => {
    let sum = HALF_SHARE * correlation(lag / 2);
    let weight = HALF_SHARE;
    COMB.forEach((share, index) => {
      const multiple = lag * (index + 1);
      if (multiple <= count / 2) {
        sum += share * correlation(multiple);
        weight += share;
      }
    });
    return weight > 0 ? sum / weight : 0;
  };
  const scores: number[] = [];
  let best = -1;
  let bestScore = -Infinity;
  const lags: number[] = [];
  for (let lag = shortest; lag <= longest; lag *= 1 + LAG_STEP) {
    lags.push(lag);
  }
  lags.forEach((lag) => {
    const tempo = 60_000 / (lag * OSS_HOP_MS);
    const octaves = Math.log2(tempo / PREFERRED_TEMPO);
    const prior = Math.exp(-0.5 * octaves * octaves);
    const fromHeld = held > 0 ? Math.log2(tempo / held) / CONTINUITY_WIDTH : 0;
    const lean =
      held > 0 ? 1 + CONTINUITY * Math.exp(-0.5 * fromHeld * fromHeld) : 1;
    const score = comb(lag) * prior * lean;
    scores.push(score);
    if (score > bestScore) {
      bestScore = score;
      best = scores.length - 1;
    }
  });
  if (best < 0 || bestScore <= 0) {
    return undefined;
  }
  // Between two lags, where the peak really is - only with a neighbour on
  // each side: at the end of the range the missing one stood in as the peak
  // itself, and the shift always pushed half a lag outwards, outside the
  // range this looks in.
  const left = scores[best - 1];
  const right = scores[best + 1];
  let shift = 0;
  if (left !== undefined && right !== undefined) {
    const curve = left - 2 * bestScore + right;
    if (curve < 0) {
      shift = Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / curve));
    }
  }
  const lag = lags[best] * (1 + LAG_STEP) ** shift;
  return {
    tempo: Math.max(
      MIN_TEMPO,
      Math.min(MAX_TEMPO, 60_000 / (lag * OSS_HOP_MS)),
    ),
    clarity: clamp01((bestScore - 0.08) / 0.45),
  };
};

/** The history at a fractional hop, with a hop either side counted half, so a beat a hop early or late still lands. */
const around = (history: Float32Array, at: number) => {
  const whole = Math.floor(at);
  const part = at - whole;
  const here =
    (history[whole] ?? 0) * (1 - part) + (history[whole + 1] ?? 0) * part;
  return here + 0.5 * ((history[whole - 1] ?? 0) + (history[whole + 2] ?? 0));
};

/**
 * How well a beat grid of `period` hops fits the history with its last beat
 * `back` hops before the newest: the onsets under its beats, the recent ones
 * counted most.
 */
const gridFit = (history: Float32Array, period: number, back: number) => {
  let score = 0;
  let weight = 1;
  for (let at = history.length - 1 - back; at >= 1; at -= period) {
    score += weight * around(history, at);
    weight *= 0.9;
  }
  return score;
};

/**
 * How much better another offset has to fit before the grid leaves the one
 * the clock is on. Where two offsets fit almost alike - kicks syncopated
 * against a backbeat - the best of them changed from one estimate to the
 * next and the clock was sent back and forth between them.
 */
const KEEP_MARGIN = 1.15;

/**
 * Where the beat is: how many hops ago the last beat fell, found by laying a
 * beat grid of `period` hops over the whole history at every offset and
 * keeping the offset whose beats land on the most onsets - the recent ones
 * counted most. A grid fitted to seconds of music is not moved by one kick
 * heard wrong, or one early, which is what moving the clock onto each kick
 * as it landed was; `clarity` says how far the best offset stands above the
 * rest. `keep`, the offset the clock is on now, is kept unless another fits
 * clearly better.
 */
export const estimatePhase = (
  history: Float32Array,
  period: number,
  keep?: number,
): { back: number; clarity: number } | undefined => {
  const count = history.length;
  if (period < 2 || count < 3 * period) {
    return undefined;
  }
  const offsets = Math.ceil(period);
  const scores = new Float32Array(offsets);
  let best = 0;
  let bestScore = -Infinity;
  let total = 0;
  for (let back = 0; back < offsets; back += 1) {
    const score = gridFit(history, period, back);
    scores[back] = score;
    total += score;
    if (score > bestScore) {
      bestScore = score;
      best = back;
    }
  }
  const mean = total / offsets;
  if (bestScore <= 0 || mean <= 0) {
    return undefined;
  }
  if (keep !== undefined) {
    const kept = gridFit(history, period, keep);
    if (kept * KEEP_MARGIN >= bestScore) {
      return { back: keep, clarity: clamp01((kept / mean - 1) / 1.2) };
    }
  }
  // Round the circle of offsets: the one before 0 is the last.
  const left = scores[(best - 1 + offsets) % offsets];
  const right = scores[(best + 1) % offsets];
  const curve = left - 2 * bestScore + right;
  const shift =
    curve < 0
      ? Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / curve))
      : 0;
  return {
    back: best + shift,
    clarity: clamp01((bestScore / mean - 1) / 1.2),
  };
};
