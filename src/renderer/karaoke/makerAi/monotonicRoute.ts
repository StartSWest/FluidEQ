/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** What the route needs of a candidate: when it sounds, and what it is worth. */
export interface IKaraokeMakerRouteCandidate {
  endMs: number;
  score: number;
  startMs: number;
}

interface IRouteNode<TCandidate> {
  candidate: TCandidate;
  coveredLines: number;
  previous?: IRouteNode<TCandidate>;
  score: number;
  /**
   * Position in the order the nodes were built.
   *
   * The last tie-break, and the reason the comparison is a strict total order.
   * Without it, two routes level on all three musical keys are separated by
   * whichever the search structure happened to reach first, so the answer
   * depends on how the predecessor is looked up rather than on the song.
   * Measured: bisecting the search without this re-routed 225 of 4,000 random
   * songs against the answer the suite was written for, seconds apart.
   */
  sequence: number;
}

/**
 * Whisper word boundaries touch: 40 ms of overlap between a line's last word
 * and the next line's first is a shared consonant, not a second voice.
 */
const ROUTE_OVERLAP_TOLERANCE_MS = 40;

/**
 * Thin one line's candidates, keeping its reach across the song.
 *
 * Never a top-K by score, which is the obvious thing and is wrong here. On a
 * song that repeats one line, every performance of it scores the same, so a
 * top-K keeps K candidates from one stretch and leaves the rest of the song
 * with none: measured on a hundred identical lines, the route chooses score
 * ranks 2, 4, 6 … 199 of 199, and a top-100 by score timed fifty lines of the
 * hundred — silently, which a timing-only test would have called a pass.
 * Sliced by time instead, each equal part of the line's start-ordered
 * candidates keeps its best, so every stretch keeps a representative.
 *
 * `candidates` must be ordered by `startMs`, which is what the caller returns.
 */
export const limitRouteCandidates = <
  TCandidate extends IKaraokeMakerRouteCandidate,
>(
  candidates: readonly TCandidate[],
  limit: number,
): readonly TCandidate[] => {
  if (candidates.length <= limit || limit < 1) {
    return candidates;
  }
  const kept: TCandidate[] = [];
  for (let slice = 0; slice < limit; slice += 1) {
    const from = Math.floor((slice * candidates.length) / limit);
    const to = Math.max(
      from + 1,
      Math.floor(((slice + 1) * candidates.length) / limit),
    );
    let best = candidates[from];
    for (let index = from + 1; index < to; index += 1) {
      if (candidates[index].score > best.score) {
        best = candidates[index];
      }
    }
    kept.push(best);
  }
  return kept;
};

/**
 * The best chronological route through one candidate list per lyric line.
 *
 * Every line offers at most one candidate and a candidate may only follow one
 * that has already finished, so this is a longest path through a graph ordered
 * by time. Routes are compared on lines covered, then total score, then the
 * earlier start, then the order they were built.
 *
 * The predecessor of a candidate is the best route among the nodes ending
 * before it begins — a prefix of the nodes ordered by end time. Extending a
 * route adds one covered line and the same score whichever predecessor is
 * taken, so the ranking of predecessors is the ranking of the routes they
 * produce, and a segment tree of prefix minima answers it in logarithmic time.
 *
 * Rescanning the accumulated nodes for every candidate instead cost O(n²): on
 * a song repeating one three-word line 144 times that is 55,000 nodes and 49
 * seconds, synchronously on the renderer thread, after the progress bar had
 * already said the transcription was complete. The same song routes in 0.3 s.
 */
export const solveMonotonicRoute = <
  TCandidate extends IKaraokeMakerRouteCandidate,
>(
  lines: readonly (readonly TCandidate[])[],
): readonly TCandidate[] => {
  const endTimes = [
    ...new Set(lines.flatMap((line) => line.map(({ endMs }) => endMs))),
  ].sort((left, right) => left - right);
  if (!endTimes.length) {
    return [];
  }
  const endPositions = new Map(endTimes.map((endMs, index) => [endMs, index]));

  const compareRoutes = (
    left: IRouteNode<TCandidate>,
    right: IRouteNode<TCandidate>,
  ): number =>
    right.coveredLines - left.coveredLines ||
    right.score - left.score ||
    left.candidate.startMs - right.candidate.startMs ||
    left.sequence - right.sequence;

  const isBetter = (
    left: IRouteNode<TCandidate>,
    right: IRouteNode<TCandidate> | undefined,
  ): boolean => !right || compareRoutes(left, right) < 0;

  // Segment tree over the distinct end times, leaves at [width, 2 * width).
  let width = 1;
  while (width < endTimes.length) {
    width *= 2;
  }
  const tree: (IRouteNode<TCandidate> | undefined)[] = new Array(
    width * 2,
  ).fill(undefined);

  const record = (position: number, node: IRouteNode<TCandidate>) => {
    let slot = width + position;
    if (!isBetter(node, tree[slot])) {
      return;
    }
    tree[slot] = node;
    slot = Math.floor(slot / 2);
    while (slot >= 1) {
      const left = tree[slot * 2];
      const right = tree[slot * 2 + 1];
      tree[slot] = left && isBetter(left, right) ? left : (right ?? left);
      slot = Math.floor(slot / 2);
    }
  };

  /** Largest index whose end time is at or before `limitMs`, or -1. */
  const positionEndingBy = (limitMs: number): number => {
    let low = 0;
    let high = endTimes.length - 1;
    let position = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (endTimes[middle] <= limitMs) {
        position = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return position;
  };

  /** Best node whose end time is at or before `limitMs`. */
  const bestEndingBy = (
    limitMs: number,
  ): IRouteNode<TCandidate> | undefined => {
    const position = positionEndingBy(limitMs);
    if (position < 0) {
      return undefined;
    }
    let best: IRouteNode<TCandidate> | undefined;
    let slot = 1;
    let from = 0;
    let to = width - 1;
    while (from < to) {
      const middle = Math.floor((from + to) / 2);
      if (position <= middle) {
        slot *= 2;
        to = middle;
      } else {
        const covered = tree[slot * 2];
        if (covered && isBetter(covered, best)) {
          best = covered;
        }
        slot = slot * 2 + 1;
        from = middle + 1;
      }
    }
    const leaf = tree[slot];
    return leaf && isBetter(leaf, best) ? leaf : best;
  };

  let sequence = 0;
  let bestRoute: IRouteNode<TCandidate> | undefined;
  lines.forEach((candidates) => {
    const added = candidates.map((candidate) => {
      const previous = bestEndingBy(
        candidate.startMs + ROUTE_OVERLAP_TOLERANCE_MS,
      );
      sequence += 1;
      return {
        candidate,
        coveredLines: (previous?.coveredLines ?? 0) + 1,
        previous,
        score: candidate.score + (previous?.score ?? 0),
        sequence,
      };
    });
    added.forEach((node) => {
      if (isBetter(node, bestRoute)) {
        bestRoute = node;
      }
    });
    // Recorded only once the whole line is built, so no line can chain to
    // another candidate of itself.
    added.forEach((node) => {
      const position = endPositions.get(node.candidate.endMs);
      if (position !== undefined) {
        record(position, node);
      }
    });
  });

  const route: TCandidate[] = [];
  let node: IRouteNode<TCandidate> | undefined = bestRoute;
  while (node) {
    route.push(node.candidate);
    node = node.previous;
  }
  return route;
};
