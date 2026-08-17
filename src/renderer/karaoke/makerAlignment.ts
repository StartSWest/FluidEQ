/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  karaokeMakerId,
  karaokeMakerLineIsSection,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import {
  IKaraokeMakerAnalysisNote,
  karaokeMakerAnalysisOffsetMs,
  karaokeMakerVocalPhrases,
} from './makerAnalysis';

/**
 * Fitting words to the audio that has already been measured.
 *
 * The upper half of what was one file. Below it, makerAnalysis decodes the
 * audio, extracts a waveform and finds where the singing is. This takes those
 * answers and decides which word belongs at which moment — a different problem,
 * and the one where being wrong is visible to the user rather than merely
 * inaccurate.
 *
 * Three things cross the boundary and all of them go one way: the note shape,
 * where the analysis starts relative to the project, and the phrases. Nothing
 * down there needs anything from up here.
 *
 * The protections are the reason this is worth reading on its own. An automatic
 * pass must never overwrite timing a person put in by hand, and the rules that
 * enforce that — the protected-timing check, the overlap test, the safe run —
 * were spread through a file that was mostly about decoding audio.
 */
const partitionContiguous = <T>(
  items: readonly T[],
  groupWeights: readonly number[],
): T[][] => {
  if (!groupWeights.length) {
    return [];
  }
  const totalWeight = groupWeights.reduce(
    (total, weight) => total + Math.max(1, weight),
    0,
  );
  let consumedWeight = 0;
  let cursor = 0;
  return groupWeights.map((weight, groupIndex) => {
    consumedWeight += Math.max(1, weight);
    const groupsLeft = groupWeights.length - groupIndex - 1;
    const idealEnd = Math.round((consumedWeight / totalWeight) * items.length);
    const end =
      groupIndex === groupWeights.length - 1
        ? items.length
        : Math.max(cursor + 1, Math.min(items.length - groupsLeft, idealEnd));
    const group = items.slice(cursor, end);
    cursor = end;
    return group;
  });
};

const tokenWeight = (token: { text: string }): number =>
  Math.max(1, Array.from(token.text).length);

interface IKaraokeMakerTimingInterval {
  startMs: number;
  endMs: number;
}

const timingIntervalsOverlap = (
  left: IKaraokeMakerTimingInterval,
  right: IKaraokeMakerTimingInterval,
): boolean => left.startMs < right.endMs && right.startMs < left.endMs;

const tokenHasProtectedTiming = (
  token: IKaraokeMakerProject['lyrics']['lines'][number]['tokens'][number],
): boolean =>
  token.startMs !== undefined &&
  token.endMs !== undefined &&
  token.endMs > token.startMs &&
  (token.timingLocked === true ||
    token.source === 'manual' ||
    token.source === 'auto-align');

/** Pick the longest note run that does not cross a protected/assigned word. */
const safeAlignmentRun = (
  notes: readonly IKaraokeMakerAnalysisNote[],
  occupied: readonly IKaraokeMakerTimingInterval[],
): IKaraokeMakerAnalysisNote[] => {
  const runs: IKaraokeMakerAnalysisNote[][] = [];
  let current: IKaraokeMakerAnalysisNote[] = [];
  [...notes]
    .filter((note) => note.endMs > note.startMs)
    .sort((left, right) => left.startMs - right.startMs)
    .forEach((note) => {
      const noteCollides = occupied.some((interval) =>
        timingIntervalsOverlap(note, interval),
      );
      const proposed = current.length
        ? { startMs: current[0].startMs, endMs: note.endMs }
        : note;
      const runCrossesOccupied = occupied.some((interval) =>
        timingIntervalsOverlap(proposed, interval),
      );
      if (noteCollides || runCrossesOccupied) {
        if (current.length) {
          runs.push(current);
          current = [];
        }
        return;
      }
      current.push(note);
    });
  if (current.length) {
    runs.push(current);
  }
  return (
    runs.sort(
      (left, right) =>
        right.reduce((sum, note) => sum + note.endMs - note.startMs, 0) -
          left.reduce((sum, note) => sum + note.endMs - note.startMs, 0) ||
        left[0].startMs - right[0].startMs,
    )[0] ?? []
  );
};

/**
 * Assign sequential words to the discovered voiced regions.
 *
 * This is the deterministic offline fallback used before/without Whisper. It
 * never claims to have recognised a word; it only distributes the lyrics the
 * user supplied across detected melody, and every result remains editable.
 */
export const autoAlignKaraokeMakerProject = (
  project: IKaraokeMakerProject,
  incomingNotes: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerProject => {
  const lines = project.lyrics.lines.map((line) => ({
    ...line,
    tokens: line.tokens.map((token) => ({ ...token })),
  }));
  const tokens = lines.flatMap((line) => line.tokens);
  const protectedTokens = tokens.filter(tokenHasProtectedTiming);
  const protectedTokenIds = new Set(protectedTokens.map((token) => token.id));
  const nonEmptyLines = lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .map((line) => ({
      ...line,
      tokens: line.tokens.filter((token) => !protectedTokenIds.has(token.id)),
    }))
    .filter((line) => line.tokens.length);
  if (!tokens.length || !incomingNotes.length) {
    return project;
  }
  if (!nonEmptyLines.length) {
    return project;
  }
  const timingOffsetMs = karaokeMakerAnalysisOffsetMs(
    project,
    Math.min(...incomingNotes.map((note) => note.startMs)),
  );
  const alignedIncomingNotes = incomingNotes.map((note) => ({
    ...note,
    startMs: note.startMs + timingOffsetMs,
    endMs: note.endMs + timingOffsetMs,
  }));
  const occupied: IKaraokeMakerTimingInterval[] = protectedTokens.map(
    (token) => ({
      startMs: token.startMs as number,
      endMs: token.endMs as number,
    }),
  );
  project.melody.notes
    .filter((note) => note.source === 'manual')
    .forEach((note) =>
      occupied.push({ startMs: note.startMs, endMs: note.endMs }),
    );
  const availableIncomingNotes = alignedIncomingNotes.filter(
    (note) =>
      !occupied.some((interval) => timingIntervalsOverlap(note, interval)),
  );
  const phrases = karaokeMakerVocalPhrases(availableIncomingNotes);
  if (!phrases.length) {
    return project;
  }
  const lineWeights = nonEmptyLines.map((line) =>
    line.tokens.reduce((total, token) => total + tokenWeight(token), 0),
  );
  const phraseWeights = phrases.map((phrase) =>
    Math.max(
      1,
      phrase.notes.reduce(
        (duration, note) => duration + Math.max(40, note.endMs - note.startMs),
        0,
      ),
    ),
  );
  const alignmentUnits: Array<{
    tokens: IKaraokeMakerProject['lyrics']['lines'][number]['tokens'];
    notes: IKaraokeMakerAnalysisNote[];
  }> = [];
  if (phrases.length >= nonEmptyLines.length) {
    const phraseGroups = partitionContiguous(phrases, lineWeights);
    nonEmptyLines.forEach((line, index) => {
      const linePhrases = phraseGroups[index] ?? [];
      if (linePhrases.length <= line.tokens.length) {
        const tokenGroups = partitionContiguous(
          line.tokens,
          linePhrases.map((phrase) =>
            phrase.notes.reduce(
              (duration, note) =>
                duration + Math.max(40, note.endMs - note.startMs),
              0,
            ),
          ),
        );
        linePhrases.forEach((phrase, phraseIndex) =>
          alignmentUnits.push({
            tokens: tokenGroups[phraseIndex] ?? [],
            notes: phrase.notes,
          }),
        );
      } else {
        const phrasesByToken = partitionContiguous(
          linePhrases,
          line.tokens.map(tokenWeight),
        );
        line.tokens.forEach((token, tokenIndex) =>
          alignmentUnits.push({
            tokens: [token],
            notes: (phrasesByToken[tokenIndex] ?? []).flatMap(
              (phrase) => phrase.notes,
            ),
          }),
        );
      }
    });
  } else {
    const lineGroups = partitionContiguous(nonEmptyLines, phraseWeights);
    phrases.forEach((phrase, index) =>
      alignmentUnits.push({
        tokens: (lineGroups[index] ?? []).flatMap((line) => line.tokens),
        notes: phrase.notes,
      }),
    );
  }
  const grouped = new Map<string, IKaraokeMakerAnalysisNote[]>();
  alignmentUnits.forEach((unit) => {
    if (unit.tokens.length > unit.notes.length && unit.notes.length) {
      const phraseStartMs = unit.notes[0].startMs;
      const phraseEndMs = unit.notes[unit.notes.length - 1].endMs;
      const phraseDurationMs = Math.max(1, phraseEndMs - phraseStartMs);
      const totalWeight = unit.tokens.reduce(
        (total, token) => total + tokenWeight(token),
        0,
      );
      let consumedWeight = 0;
      unit.tokens.forEach((token) => {
        const startProgress = consumedWeight / totalWeight;
        consumedWeight += tokenWeight(token);
        const endProgress = consumedWeight / totalWeight;
        const startMs = Math.round(
          phraseStartMs + phraseDurationMs * startProgress,
        );
        const endMs = Math.max(
          startMs + 1,
          Math.round(phraseStartMs + phraseDurationMs * endProgress),
        );
        const midpointMs = (startMs + endMs) / 2;
        const guide = [...unit.notes].sort((left, right) => {
          const leftMidpoint = (left.startMs + left.endMs) / 2;
          const rightMidpoint = (right.startMs + right.endMs) / 2;
          return (
            Math.abs(leftMidpoint - midpointMs) -
            Math.abs(rightMidpoint - midpointMs)
          );
        })[0];
        grouped.set(token.id, [
          {
            startMs,
            endMs,
            targetMidi: guide.targetMidi,
            confidence: guide.confidence,
          },
        ]);
      });
      return;
    }
    const totalWeight = unit.tokens.reduce(
      (total, token) => total + tokenWeight(token),
      0,
    );
    const cumulativeWeights: number[] = [];
    let weight = 0;
    unit.tokens.forEach((token) => {
      weight += tokenWeight(token);
      cumulativeWeights.push(weight / totalWeight);
    });
    const totalNoteDuration = unit.notes.reduce(
      (total, note) => total + Math.max(40, note.endMs - note.startMs),
      0,
    );
    let elapsedNoteDuration = 0;
    unit.notes.forEach((note) => {
      const noteDuration = Math.max(40, note.endMs - note.startMs);
      const progress =
        (elapsedNoteDuration + noteDuration / 2) / totalNoteDuration;
      elapsedNoteDuration += noteDuration;
      const foundIndex = cumulativeWeights.findIndex(
        (boundary) => progress <= boundary,
      );
      const tokenIndex = foundIndex < 0 ? unit.tokens.length - 1 : foundIndex;
      const token = unit.tokens[tokenIndex];
      if (!token) {
        return;
      }
      const notes = grouped.get(token.id) ?? [];
      notes.push(note);
      grouped.set(token.id, notes);
    });
  });
  const generatedNotes: IKaraokeMakerNote[] = [];
  const alignedTokenIds = new Set<string>();
  tokens.forEach((token) => {
    if (protectedTokenIds.has(token.id)) {
      return;
    }
    const tokenNotes = safeAlignmentRun(grouped.get(token.id) ?? [], occupied);
    if (!tokenNotes.length) {
      return;
    }
    const interval = {
      startMs: tokenNotes[0].startMs,
      endMs: tokenNotes[tokenNotes.length - 1].endMs,
    };
    if (
      occupied.some((existing) => timingIntervalsOverlap(interval, existing))
    ) {
      return;
    }
    occupied.push(interval);
    alignedTokenIds.add(token.id);
    token.startMs = interval.startMs;
    token.endMs = interval.endMs;
    token.confidence =
      tokenNotes.reduce((total, note) => total + note.confidence, 0) /
      tokenNotes.length;
    token.source = 'auto-align';
    tokenNotes.forEach((note) =>
      generatedNotes.push({
        id: karaokeMakerId('note'),
        tokenId: token.id,
        startMs: note.startMs,
        endMs: note.endMs,
        targetMidi: note.targetMidi,
        kind: 'normal',
        confidence: note.confidence,
        source: 'pitch-analysis',
      }),
    );
  });
  const preservedNotes = project.melody.notes.filter(
    (note) =>
      note.source === 'manual' ||
      (note.tokenId !== undefined && protectedTokenIds.has(note.tokenId)) ||
      (note.tokenId !== undefined && !alignedTokenIds.has(note.tokenId)),
  );
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...project,
      lyrics: { ...project.lyrics, source: 'auto-align', lines },
      melody: {
        ...project.melody,
        source: 'pitch-analysis',
        notes: [...preservedNotes, ...generatedNotes].sort(
          (left, right) =>
            left.startMs - right.startMs ||
            left.endMs - right.endMs ||
            left.id.localeCompare(right.id),
        ),
      },
    }),
  );
};

/**
 * Whisper sometimes collapses a repeated line even though the pitch detector
 * still sees the second vocal phrase. Re-time only low-confidence Whisper
 * estimates against those vocal regions; recognized and manually edited words
 * are temporary anchors and are restored byte-for-byte afterwards.
 */
export const repairEstimatedWhisperTimingWithMelody = (
  project: IKaraokeMakerProject,
  incomingNotes: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerProject => {
  const repairableIds = new Set(
    project.lyrics.lines.flatMap((line) =>
      karaokeMakerLineIsSection(line)
        ? []
        : line.tokens.flatMap((token) =>
            !token.timingLocked &&
            token.source === 'whisper' &&
            (token.confidence ?? 0) < 0.7
              ? [token.id]
              : [],
          ),
    ),
  );
  if (!repairableIds.size || !incomingNotes.length) {
    return project;
  }
  const anchoredProject: IKaraokeMakerProject = {
    ...project,
    lyrics: {
      ...project.lyrics,
      lines: project.lyrics.lines.map((line) => ({
        ...line,
        tokens: line.tokens.map((token) => {
          if (repairableIds.has(token.id)) {
            return { ...token, startMs: undefined, endMs: undefined };
          }
          if (token.startMs !== undefined && token.endMs !== undefined) {
            return { ...token, timingLocked: true };
          }
          return token;
        }),
      })),
    },
    melody: {
      ...project.melody,
      notes: project.melody.notes.filter((note) => note.source === 'manual'),
    },
  };
  const repaired = autoAlignKaraokeMakerProject(anchoredProject, incomingNotes);
  const repairedTokens = new Map(
    repaired.lyrics.lines.flatMap((line) =>
      line.tokens.map((token) => [token.id, token] as const),
    ),
  );
  const orderedTokens = project.lyrics.lines.flatMap((line) =>
    karaokeMakerLineIsSection(line) ? [] : line.tokens,
  );
  const safeRepairBounds = new Map<
    string,
    { lowerBoundMs: number; upperBoundMs: number }
  >();
  orderedTokens.forEach((token, tokenIndex) => {
    if (!repairableIds.has(token.id)) {
      return;
    }
    const previous = [...orderedTokens.slice(0, tokenIndex)]
      .reverse()
      .find(
        (candidate) =>
          !repairableIds.has(candidate.id) && candidate.endMs !== undefined,
      );
    const next = orderedTokens
      .slice(tokenIndex + 1)
      .find(
        (candidate) =>
          !repairableIds.has(candidate.id) && candidate.startMs !== undefined,
      );
    safeRepairBounds.set(token.id, {
      lowerBoundMs: previous?.endMs ?? 0,
      upperBoundMs:
        next?.startMs ?? project.audio.durationMs ?? Number.MAX_SAFE_INTEGER,
    });
  });
  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      lines: project.lyrics.lines.map((line) => ({
        ...line,
        tokens: line.tokens.map((token) => {
          if (!repairableIds.has(token.id)) {
            return token;
          }
          const repairedToken = repairedTokens.get(token.id);
          const bounds = safeRepairBounds.get(token.id);
          return repairedToken?.startMs !== undefined &&
            repairedToken.endMs !== undefined &&
            bounds !== undefined &&
            repairedToken.startMs >= bounds.lowerBoundMs &&
            repairedToken.endMs <= bounds.upperBoundMs
            ? {
                ...token,
                startMs: repairedToken.startMs,
                endMs: repairedToken.endMs,
                confidence: Math.max(
                  token.confidence ?? 0,
                  repairedToken.confidence ?? 0,
                ),
                source: 'auto-align' as const,
              }
            : token;
        }),
      })),
    },
  };
};

/** Convert already-positioned editor notes back to analysis-space timing. */
export const karaokeMakerAnalysisNotesFromMelody = (
  project: IKaraokeMakerProject,
): IKaraokeMakerAnalysisNote[] =>
  project.melody.notes.map((note) => ({
    startMs: note.startMs,
    endMs: note.endMs,
    targetMidi: note.targetMidi,
    confidence: note.confidence ?? 1,
  }));

/**
 * Align newly replaced lyrics while preserving the user's existing melody.
 * Melody notes are temporarily removed from collision protection, then
 * relinked to the newly timed word under their midpoint. Their IDs, pitch,
 * kind, source and manual edits remain untouched.
 */
export const autoAlignNewKaraokeMakerLyrics = (
  project: IKaraokeMakerProject,
  incomingNotes: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerProject => {
  const existingNotes = project.melody.notes;
  const aligned = autoAlignKaraokeMakerProject(
    {
      ...project,
      melody: { ...project.melody, notes: [] },
    },
    incomingNotes,
  );
  if (!existingNotes.length) {
    return aligned;
  }
  const timedTokens = aligned.lyrics.lines.flatMap((line) =>
    line.tokens.filter(
      (token) =>
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        token.endMs > token.startMs,
    ),
  );
  return touchKaraokeMakerProject({
    ...aligned,
    melody: {
      ...project.melody,
      notes: existingNotes.map((note) => {
        const midpointMs = (note.startMs + note.endMs) / 2;
        const token = timedTokens.find(
          (candidate) =>
            midpointMs >= (candidate.startMs as number) &&
            midpointMs < (candidate.endMs as number),
        );
        return { ...note, tokenId: token?.id };
      }),
    },
  });
};
