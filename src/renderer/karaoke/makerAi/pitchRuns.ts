/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerAnalysisNote } from '../makerAnalysis';
import { IKaraokeMakerToken } from '../../../common/karaoke/makerProject';

const melodyCandidateScore = (
  note: IKaraokeMakerAnalysisNote,
  startMs: number,
  endMs: number,
  previousMidi?: number,
): number => {
  const overlapMs = Math.max(
    0,
    Math.min(endMs, note.endMs) - Math.max(startMs, note.startMs),
  );
  const segmentDurationMs = Math.max(1, endMs - startMs);
  const noteDurationMs = Math.max(1, note.endMs - note.startMs);
  const coverage = overlapMs / segmentDurationMs;
  const onsetDistanceMs = Math.abs(note.startMs - startMs);
  const onsetBonus = Math.max(0, 1 - onsetDistanceMs / 260) * 0.26;
  const sustainedAccompanimentPenalty =
    noteDurationMs > 1_600
      ? Math.min(0.42, (noteDurationMs - 1_600) / 6_000)
      : 0;
  const continuityPenalty =
    previousMidi === undefined
      ? 0
      : Math.min(0.35, Math.abs(note.targetMidi - previousMidi) * 0.018);
  return (
    coverage * (0.52 + note.confidence * 0.48) +
    onsetBonus -
    sustainedAccompanimentPenalty -
    continuityPenalty
  );
};

export const KARAOKE_GUIDE_FRAME_MS = 50;
export const KARAOKE_GUIDE_MIN_NOTE_MS = 70;
export const KARAOKE_GUIDE_STABLE_CHANGE_MS = 90;
export const KARAOKE_GUIDE_MAX_NOTES_PER_TOKEN = 3;

export interface IKaraokeMakerPitchRun {
  startMs: number;
  endMs: number;
  targetMidi: number;
  confidence: number;
}

interface IKaraokeMakerPitchFrameOption {
  candidate: IKaraokeMakerAnalysisNote;
  roundedMidi: number;
  emissionScore: number;
}

/**
 * Basic Pitch is polyphonic, so a mixed master can expose bass, chord and vocal
 * candidates at the same instant. Choose one continuous path across the word
 * instead of independently taking the loudest candidate in every frame.
 */
export const traceVocalPitchFrames = (
  token: IKaraokeMakerToken & { startMs: number; endMs: number },
  candidates: readonly IKaraokeMakerAnalysisNote[],
  previousMidi?: number,
): IKaraokeMakerPitchRun[] => {
  const tokenDurationMs = token.endMs - token.startMs;
  const frameCount = Math.max(
    1,
    Math.ceil(tokenDurationMs / KARAOKE_GUIDE_FRAME_MS),
  );
  const overlappingCandidates = candidates.filter(
    (candidate) =>
      candidate.startMs < token.endMs && candidate.endMs > token.startMs,
  );
  if (!overlappingCandidates.length) {
    return [];
  }

  const anchorCandidate = overlappingCandidates.reduce<
    IKaraokeMakerAnalysisNote | undefined
  >((best, candidate) => {
    if (!best) {
      return candidate;
    }
    const score = melodyCandidateScore(
      candidate,
      token.startMs,
      token.endMs,
      previousMidi,
    );
    const bestScore = melodyCandidateScore(
      best,
      token.startMs,
      token.endMs,
      previousMidi,
    );
    return score > bestScore ? candidate : best;
  }, undefined);
  const anchorMidi = Math.round(
    anchorCandidate?.targetMidi ?? previousMidi ?? 60,
  );
  const optionsByFrame: IKaraokeMakerPitchFrameOption[][] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameStartMs =
      token.startMs + (tokenDurationMs * frameIndex) / frameCount;
    const frameEndMs =
      token.startMs + (tokenDurationMs * (frameIndex + 1)) / frameCount;
    const options = overlappingCandidates
      .filter(
        (candidate) =>
          candidate.startMs < frameEndMs && candidate.endMs > frameStartMs,
      )
      .map((candidate): IKaraokeMakerPitchFrameOption => {
        const roundedMidi = Math.round(candidate.targetMidi);
        let vocalRangePenalty = 0;
        if (roundedMidi < 42) {
          vocalRangePenalty = (42 - roundedMidi) * 0.07;
        } else if (roundedMidi > 84) {
          vocalRangePenalty = (roundedMidi - 84) * 0.07;
        }
        const anchorPenalty = Math.min(
          0.72,
          Math.abs(roundedMidi - anchorMidi) * 0.055,
        );
        return {
          candidate,
          roundedMidi,
          emissionScore:
            melodyCandidateScore(
              candidate,
              frameStartMs,
              frameEndMs,
              previousMidi,
            ) -
            vocalRangePenalty -
            anchorPenalty,
        };
      })
      .filter((option) => option.emissionScore >= 0.1)
      .sort((left, right) => right.emissionScore - left.emissionScore)
      .slice(0, 8);
    optionsByFrame.push(options);
  }

  const scores: number[][] = [];
  const parents: number[][] = [];
  optionsByFrame.forEach((options, frameIndex) => {
    scores[frameIndex] = [];
    parents[frameIndex] = [];
    options.forEach((option, optionIndex) => {
      if (frameIndex === 0 || !optionsByFrame[frameIndex - 1].length) {
        const entryPenalty =
          previousMidi === undefined
            ? 0
            : Math.min(0.7, Math.abs(option.roundedMidi - previousMidi) * 0.06);
        scores[frameIndex][optionIndex] = option.emissionScore - entryPenalty;
        parents[frameIndex][optionIndex] = -1;
        return;
      }
      let bestScore = Number.NEGATIVE_INFINITY;
      let bestParent = -1;
      optionsByFrame[frameIndex - 1].forEach((prior, priorIndex) => {
        const distance = Math.abs(option.roundedMidi - prior.roundedMidi);
        const transitionPenalty =
          distance <= 2 ? distance * 0.035 : 0.12 + (distance - 2) * 0.105;
        const score =
          (scores[frameIndex - 1][priorIndex] ?? Number.NEGATIVE_INFINITY) +
          option.emissionScore -
          transitionPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestParent = priorIndex;
        }
      });
      scores[frameIndex][optionIndex] = bestScore;
      parents[frameIndex][optionIndex] = bestParent;
    });
  });

  const selectedByFrame = new Array<IKaraokeMakerPitchFrameOption | undefined>(
    frameCount,
  );
  let lastFrameIndex = frameCount - 1;
  while (lastFrameIndex >= 0 && !optionsByFrame[lastFrameIndex].length) {
    lastFrameIndex -= 1;
  }
  if (lastFrameIndex < 0) {
    return [];
  }
  let selectedIndex = scores[lastFrameIndex].reduce(
    (bestIndex, score, index) =>
      score > scores[lastFrameIndex][bestIndex] ? index : bestIndex,
    0,
  );
  for (let frameIndex = lastFrameIndex; frameIndex >= 0; frameIndex -= 1) {
    if (optionsByFrame[frameIndex].length) {
      selectedByFrame[frameIndex] = optionsByFrame[frameIndex][selectedIndex];
      selectedIndex = parents[frameIndex][selectedIndex] ?? -1;
      if (selectedIndex < 0 && frameIndex > 0) {
        const previousScores = scores[frameIndex - 1];
        selectedIndex = previousScores.length
          ? previousScores.reduce(
              (bestIndex, score, index) =>
                score > previousScores[bestIndex] ? index : bestIndex,
              0,
            )
          : 0;
      }
    }
  }

  return selectedByFrame.flatMap((selected, frameIndex) => {
    if (!selected) {
      return [];
    }
    return [
      {
        startMs: token.startMs + (tokenDurationMs * frameIndex) / frameCount,
        endMs:
          token.startMs + (tokenDurationMs * (frameIndex + 1)) / frameCount,
        targetMidi: selected.roundedMidi,
        confidence: selected.candidate.confidence,
      },
    ];
  });
};

export const mergePitchRuns = (
  incoming: readonly IKaraokeMakerPitchRun[],
): IKaraokeMakerPitchRun[] => {
  const merged: IKaraokeMakerPitchRun[] = [];
  incoming.forEach((run) => {
    const previous = merged[merged.length - 1];
    if (previous && previous.targetMidi === run.targetMidi) {
      const previousDuration = previous.endMs - previous.startMs;
      const runDuration = run.endMs - run.startMs;
      previous.endMs = run.endMs;
      previous.confidence =
        (previous.confidence * previousDuration +
          run.confidence * runDuration) /
        Math.max(1, previousDuration + runDuration);
      return;
    }
    merged.push({ ...run });
  });
  return merged;
};

export const absorbPitchRun = (
  runs: IKaraokeMakerPitchRun[],
  index: number,
) => {
  const current = runs[index];
  const left = runs[index - 1];
  const right = runs[index + 1];
  if (!current || (!left && !right)) {
    return;
  }
  const mergeLeft =
    !right ||
    (left !== undefined &&
      Math.abs(left.targetMidi - current.targetMidi) <=
        Math.abs(right.targetMidi - current.targetMidi));
  if (mergeLeft && left) {
    left.endMs = current.endMs;
  } else if (right) {
    right.startMs = current.startMs;
  }
  runs.splice(index, 1);
};

export const splitLongestPitchRun = (runs: IKaraokeMakerPitchRun[]) => {
  const index = runs.reduce(
    (longestIndex, run, runIndex) =>
      run.endMs - run.startMs >
      runs[longestIndex].endMs - runs[longestIndex].startMs
        ? runIndex
        : longestIndex,
    0,
  );
  const run = runs[index];
  const midpoint = Math.round((run.startMs + run.endMs) / 2);
  runs.splice(
    index,
    1,
    { ...run, endMs: midpoint },
    { ...run, startMs: midpoint },
  );
};

export const splitPitchRunAt = (
  runs: IKaraokeMakerPitchRun[],
  boundaryMs: number,
): boolean => {
  const index = runs.findIndex(
    (run) =>
      boundaryMs - run.startMs >= KARAOKE_GUIDE_MIN_NOTE_MS / 2 &&
      run.endMs - boundaryMs >= KARAOKE_GUIDE_MIN_NOTE_MS / 2,
  );
  if (index < 0) {
    return false;
  }
  const run = runs[index];
  runs.splice(
    index,
    1,
    { ...run, endMs: boundaryMs },
    { ...run, startMs: boundaryMs },
  );
  return true;
};
