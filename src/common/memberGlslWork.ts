/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILoop } from './memberGlslLoops';
import {
  functionBodies,
  skipSpace,
  type ISourceIndex,
} from './memberGlslSource';

/**
 * The work one pixel may do: every loop turn, and every call of the scene's
 * own functions, counted from `sceneColour` down — nested loops multiply, and
 * a helper called in a loop costs its own work on every turn.
 *
 * A cap on each loop alone let three nested 128-turn loops run two million
 * turns a pixel, two trillion on a 1920x1080 picture: minutes of GPU time,
 * where Windows resets the driver after two seconds. This cuts that to a
 * ceiling a scene cannot argue with.
 *
 * A unit is about one noise turn: a turn and every call cost one, and each
 * span's own arithmetic, tests and built-in calls one per
 * OPERATIONS_PER_UNIT besides. Counted that way on 2026-09-13, the heaviest
 * of the 77 official scenes and Studio projects on this machine (Coral as a
 * member gets it in the Studio, with its helpers) does 8579, and every one
 * of them passes.
 *
 * WHAT THIS NUMBER DOES NOT DO, measured on 2026-09-17 and written here
 * because it used to claim the opposite. It said this budget keeps a whole
 * 1920x1080 frame under two seconds on the slowest GPU. It does not. Timed on
 * this machine's integrated chip, the heaviest thing these rules accept — one
 * 128-turn loop holding 104 texture fetches, each reading an address the last
 * one returned, 13,312 a pixel — comes to 3.74 seconds for one 1920x1080
 * frame. Nothing built of arithmetic gets near it: the same loop full of sums
 * runs out of MAX_MEMBER_SOURCE_BYTES first, at 0.27 s, and one doing almost
 * nothing per turn at 0.54 s.
 *
 * Nor can the number be shaved until it does. A static count says what a
 * source COULD run and a GPU runs what its branches allow, and the gap is
 * enormous in both directions: Coral is charged 8,579 units, over half this
 * ceiling, and actually draws a 1920x1080 frame in 63 ms — a sixtieth of what
 * the budget thinks it is buying. Weighing a sampler at two instead of one
 * refuses Coral AND still leaves 2.05 s on the table; three, four, six and
 * eight all refuse Coral too. There is no pair of numbers here that admits
 * the scenes Ivan has already made and refuses this shape.
 *
 * So this is a cheap first filter — it costs the signing server nothing and
 * it turns away the obvious — and it is NOT what keeps somebody's driver
 * alive. That is done where the work actually happens, by measurement rather
 * than by counting: a member's scene on the graph starts at the smallest
 * picture the listener allows and climbs only after twelve smooth frames,
 * never more than four times the pixels it has already drawn
 * (`sceneWarmup.ts`); a kept picture is timed small, extrapolated, refused
 * over thirty seconds and otherwise drawn in bands no longer than a
 * quarter-second each (`sceneStill.worker.ts`); and a scene whose frame held
 * the GPU past half a second when the context went is blamed for it and never
 * loaded again. Do not weaken any of those on the strength of this number.
 *
 * Two corrections to what that paragraph said when it was written, both from
 * reading the code rather than trusting it. The climb does NOT start at an
 * eighth of the panel: it starts at the listener's floor, 0.35 by default
 * since 2026-09-16, so the worst shape here submits a first frame of about
 * 1.8 seconds on a 4K panel rather than a tenth of that — inside Windows' two
 * only on the GPU it was measured on. And the climb's judgement of "smooth"
 * was, until `judgedIntervalMs` (`frameCadence.ts`), made against the gap
 * between the frames the scene itself paced, so it read smooth at any cost
 * and climbed to full size regardless. The bound above is only as good as
 * that judgement.
 */
export const MAX_MEMBER_PIXEL_WORK = 16384;

/** Deeper than any scene calls and nests; past it a pixel is over budget. */
const MAX_WORK_DEPTH = 64;

/** What a turn's own arithmetic, tests and calls are counted by. */
const OPERATION_MARKS = '+-*/%<>=!&|^?(';

/**
 * Operations worth one unit of work. Counted by turns and calls alone, a
 * loop of 128 by 127 turns with fifteen hundred statements in each turn
 * passed the budget at seventy million operations a pixel; weighing each
 * turn by what it does closes that without moving any scene written to be
 * looked at — see the measurement at MAX_MEMBER_PIXEL_WORK.
 */
const OPERATIONS_PER_UNIT = 32;

/**
 * What a sampler costs, in units, beyond the one bracket mark it already
 * contributes. A unit is about one turn of noise — arithmetic — and a fetch
 * from a texture is not arithmetic.
 *
 * Every call weighed the same before: a `texture()` cost what a `+` costs, a
 * thirty-second of a unit. So a scene could pass this budget and still hold
 * the GPU long enough to reset the driver, and one was built to prove it — a
 * single 128-turn loop with 369 copies of a fetch whose address comes from
 * the LAST fetch. Accepted, at 47,232 dependent fetches a pixel. A fetch that
 * waits on the one before it cannot be hoisted, cannot be coalesced and
 * cannot run alongside its neighbours.
 *
 * ONE, and samplers only, both measured rather than reasoned. Transcendentals
 * are heavier than arithmetic too and were in this list first; Coral — the
 * heaviest real scene, and the one `MAX_MEMBER_PIXEL_WORK` is calibrated on —
 * went over the budget at a weight of one for `sin`, and over it again at a
 * sampler weight of two. A rule that refuses a scene somebody already made is
 * worse than the approximation it replaces. One is what all 40 scenes in the
 * Studio folder pass at.
 *
 * It is an improvement and not a wall, and the difference is worth writing
 * down: the attack above is refused, and the same shape at a sixth of its
 * size — 7,680 dependent fetches a pixel — is still accepted. Closing that
 * needs a weight of two, which Coral does not survive. What that really says
 * is that the budget itself wants measuring again against a GPU rather than
 * shaving: Coral sits at half of it while fetching inside loops, so the two
 * numbers are arguing about the same scene. That measurement needs a GPU and
 * a stopwatch, and is not something this file can decide alone.
 */
const COSTLY_CALLS = new Map<string, number>([
  ['texture', 1],
  ['textureLod', 1],
  ['textureProj', 1],
  ['textureOffset', 1],
  ['textureGrad', 1],
  ['texelFetch', 1],
]);

/**
 * Where the work one pixel can do first goes past the budget, or undefined
 * when it never does.
 *
 * Counted from `sceneColour` down: a loop costs its turns times one more
 * than its body, a call one more than the function it calls, and every span
 * its own operations over OPERATIONS_PER_UNIT besides — a nested loop's
 * operations are its own, counted once per turn inside it. Sums stop just
 * past the budget, so a loop that never turns cannot multiply a body past
 * any number into NaN and hide the work around it.
 */
export const overBudget = (
  source: ISourceIndex,
  loops: ReadonlyMap<number, ILoop>,
  entry: string,
): number | undefined => {
  const { code } = source;
  const bodies = functionBodies(source);
  const ceiling = MAX_MEMBER_PIXEL_WORK + 1;
  const known = new Map<string, number>();
  const operationsBefore = new Uint32Array(code.length + 1);
  for (let k = 0; k < code.length; k += 1) {
    operationsBefore[k + 1] =
      operationsBefore[k] + (OPERATION_MARKS.includes(code[k]) ? 1 : 0);
  }
  const operationsIn = (from: number, to: number) =>
    operationsBefore[to] - operationsBefore[from];
  // What the samplers before each position come to, counted once in the same
  // shape as the operations above, so asking a span is two reads.
  const samplersBefore = new Uint32Array(code.length + 1);
  const samplerWord = /[A-Za-z_]\w*/g;
  let samplerFound = samplerWord.exec(code);
  while (samplerFound) {
    const weight = COSTLY_CALLS.get(samplerFound[0]);
    if (
      weight !== undefined &&
      code[skipSpace(code, samplerFound.index + samplerFound[0].length)] === '('
    ) {
      samplersBefore[samplerFound.index + 1] += weight;
    }
    samplerFound = samplerWord.exec(code);
  }
  for (let k = 0; k < code.length; k += 1) {
    samplersBefore[k + 1] += samplersBefore[k];
  }
  const samplersIn = (from: number, to: number) =>
    samplersBefore[to] - samplersBefore[from];
  let over: number | undefined;
  const add = (work: number, more: number, at: number) => {
    const sum = Math.min(work + more, ceiling);
    if (sum >= ceiling && over === undefined) {
      over = at;
    }
    return sum;
  };

  const workOf = (from: number, to: number, depth: number): number => {
    if (depth > MAX_WORK_DEPTH) {
      return add(0, ceiling, from);
    }
    let work = 0;
    let operations = operationsIn(from, to);
    let samplers = samplersIn(from, to);
    const word = /[A-Za-z_]\w*/g;
    word.lastIndex = from;
    let found = word.exec(code);
    while (found && found.index < to) {
      const name = found[0];
      const loop = name === 'for' ? loops.get(found.index) : undefined;
      if (loop) {
        const body = workOf(loop.from, loop.to, depth + 1);
        work = add(
          work,
          Math.min(loop.turns * (1 + body), ceiling),
          found.index,
        );
        operations -= operationsIn(loop.from, loop.to);
        samplers -= samplersIn(loop.from, loop.to);
        word.lastIndex = loop.to;
      } else if (
        bodies.has(name) &&
        code[skipSpace(code, found.index + name.length)] === '('
      ) {
        let called = known.get(name);
        if (called === undefined) {
          // Recursion is a compile error; counted as nothing, it ends here.
          known.set(name, 0);
          called = Math.max(
            0,
            ...(bodies.get(name) ?? []).map(([start, end]) =>
              workOf(start, end, depth + 1),
            ),
          );
          known.set(name, called);
        }
        work = add(work, 1 + called, found.index);
      }
      found = word.exec(code);
    }
    return add(work, operations / OPERATIONS_PER_UNIT + samplers, from);
  };

  const total = Math.max(
    0,
    ...(bodies.get(entry) ?? []).map(([start, end]) => workOf(start, end, 0)),
  );
  return total >= ceiling ? (over ?? 0) : undefined;
};
