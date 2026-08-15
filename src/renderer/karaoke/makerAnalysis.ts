/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  karaokeMakerId,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import analysisWorkerUrl from './maker-analysis.worklet';

const ANALYSIS_SAMPLE_RATE = 12_000;
const MAX_ANALYSIS_SECONDS = 30 * 60;
const MAX_ANALYSIS_BYTES = 1024 * 1024 * 1024;
const DEFAULT_WAVEFORM_PEAKS = 2_048;

export interface IKaraokeMakerPitchFrame {
  timeMs: number;
  frequencyHz?: number;
  midi?: number;
  confidence: number;
  rms: number;
}

export interface IKaraokeMakerAnalysisNote {
  startMs: number;
  endMs: number;
  targetMidi: number;
  confidence: number;
}

export interface IKaraokeMakerAnalysisResult {
  waveform: number[];
  frames: IKaraokeMakerPitchFrame[];
  notes: IKaraokeMakerAnalysisNote[];
}

const validateAnalysisFile = (file: File) => {
  if (file.size > MAX_ANALYSIS_BYTES) {
    throw new Error(
      'Karaoke analysis is limited to audio files of 1 GB or less.',
    );
  }
};

const validateAnalysisDuration = (durationSeconds: number) => {
  if (durationSeconds > MAX_ANALYSIS_SECONDS) {
    throw new Error(
      'Karaoke analysis is limited to recordings under 30 minutes.',
    );
  }
};

/**
 * Decode only enough information to paint the Maker's overview waveform.
 * Pitch detection remains an explicit action; opening the editor should still
 * reveal the song shape immediately without running autocorrelation or AI.
 */
export const extractKaraokeMakerWaveform = async (
  file: File,
  peakCount = DEFAULT_WAVEFORM_PEAKS,
): Promise<{ waveform: number[]; durationMs: number }> => {
  validateAnalysisFile(file);
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    validateAnalysisDuration(buffer.duration);
    const count = Math.max(32, Math.min(8_192, Math.round(peakCount)));
    const peaks = new Array<number>(count).fill(0);
    const stride = Math.max(1, Math.ceil(buffer.length / count));
    const samplesPerPeak = 512;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const samples = buffer.getChannelData(channel);
      for (let peakIndex = 0; peakIndex < count; peakIndex += 1) {
        const start = peakIndex * stride;
        const end = Math.min(samples.length, start + stride);
        const sampleStep = Math.max(
          1,
          Math.floor(Math.max(1, end - start) / samplesPerPeak),
        );
        let peak = peaks[peakIndex];
        for (
          let sampleIndex = start;
          sampleIndex < end;
          sampleIndex += sampleStep
        ) {
          peak = Math.max(peak, Math.abs(samples[sampleIndex] ?? 0));
        }
        peaks[peakIndex] = peak;
      }
    }
    const maximum = Math.max(0.001, ...peaks);
    return {
      waveform: peaks.map((peak) => peak / maximum),
      durationMs: buffer.duration * 1_000,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
};

interface IKaraokeMakerVocalPhrase {
  startMs: number;
  endMs: number;
  notes: IKaraokeMakerAnalysisNote[];
}

/**
 * Audio analysis already uses the complete decoded file, so its timestamps are
 * absolute song time. UltraStar/LRC importers have already applied provider
 * offsets to their canonical tokens; adding GAP here a second time moves every
 * detected vocal into a later instrumental section.
 */
export const karaokeMakerAnalysisOffsetMs = (
  _project: IKaraokeMakerProject,
  _earliestStartMs: number,
): number => 0;

interface IKaraokeMakerWorkerMessage {
  id: string;
  type: 'progress' | 'complete' | 'error';
  progress?: number;
  result?: IKaraokeMakerAnalysisResult;
  message?: string;
}

const downsample = (
  source: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array => {
  if (sourceRate <= targetRate) {
    return source.slice();
  }
  const ratio = sourceRate / targetRate;
  const target = new Float32Array(Math.ceil(source.length / ratio));
  for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
    const start = Math.floor(targetIndex * ratio);
    const end = Math.min(source.length, Math.floor((targetIndex + 1) * ratio));
    let total = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      total += source[sourceIndex];
    }
    target[targetIndex] = total / Math.max(1, end - start);
  }
  return target;
};

const mixAnalysisChannel = (buffer: AudioBuffer): Float32Array => {
  const mixed = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < mixed.length; index += 1) {
      mixed[index] += samples[index] / buffer.numberOfChannels;
    }
  }
  // One-pole high-pass removes rumble that otherwise wins autocorrelation.
  const cutoff = 75;
  const rc = 1 / (Math.PI * 2 * cutoff);
  const dt = 1 / buffer.sampleRate;
  const alpha = rc / (rc + dt);
  let previousInput = 0;
  let previousOutput = 0;
  for (let index = 0; index < mixed.length; index += 1) {
    const input = mixed[index];
    const output = alpha * (previousOutput + input - previousInput);
    mixed[index] = output;
    previousInput = input;
    previousOutput = output;
  }
  return mixed;
};

export const decodeKaraokeMakerAudio = async (
  file: File,
): Promise<{
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
}> => {
  validateAnalysisFile(file);
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    validateAnalysisDuration(buffer.duration);
    return {
      samples: downsample(
        mixAnalysisChannel(buffer),
        buffer.sampleRate,
        ANALYSIS_SAMPLE_RATE,
      ),
      sampleRate: Math.min(buffer.sampleRate, ANALYSIS_SAMPLE_RATE),
      durationMs: buffer.duration * 1_000,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
};

export const analyzeKaraokeMakerAudio = async (
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<IKaraokeMakerAnalysisResult & { durationMs: number }> => {
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.01);
  const decoded = await decodeKaraokeMakerAudio(file);
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.08);
  return new Promise((resolve, reject) => {
    const worker = new Worker(analysisWorkerUrl);
    const id = karaokeMakerId('analysis');
    const stop = () => worker.terminate();
    const onAbort = () => {
      stop();
      reject(new DOMException('Analysis cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onerror = (event) => {
      signal?.removeEventListener('abort', onAbort);
      stop();
      reject(new Error(event.message || 'Karaoke analysis failed.'));
    };
    worker.onmessage = (event: MessageEvent<IKaraokeMakerWorkerMessage>) => {
      if (event.data.id !== id) {
        return;
      }
      if (event.data.type === 'progress') {
        onProgress(0.08 + (event.data.progress ?? 0) * 0.92);
        return;
      }
      signal?.removeEventListener('abort', onAbort);
      stop();
      if (event.data.type === 'error' || !event.data.result) {
        reject(new Error(event.data.message || 'Karaoke analysis failed.'));
        return;
      }
      onProgress(1);
      resolve({ ...event.data.result, durationMs: decoded.durationMs });
    };
    worker.postMessage(
      { id, samples: decoded.samples, sampleRate: decoded.sampleRate },
      [decoded.samples.buffer],
    );
  });
};

const median = (values: readonly number[]): number => {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Split detected melody into phrases at adaptive no-voice gaps. */
export const karaokeMakerVocalPhrases = (
  incomingNotes: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerVocalPhrase[] => {
  const notes = incomingNotes
    .filter(
      (note) =>
        Number.isFinite(note.startMs) &&
        Number.isFinite(note.endMs) &&
        note.endMs > note.startMs,
    )
    .sort((left, right) => left.startMs - right.startMs);
  if (!notes.length) {
    return [];
  }
  const gaps = notes
    .slice(1)
    .map((note, index) => Math.max(0, note.startMs - notes[index].endMs));
  const ordinaryGaps = gaps.filter((gap) => gap <= 650);
  const ordinaryGapMs = median(ordinaryGaps) || 120;
  const phraseGapMs = Math.max(420, Math.min(1_200, ordinaryGapMs * 3.5));
  const phrases: IKaraokeMakerVocalPhrase[] = [];
  let current: IKaraokeMakerAnalysisNote[] = [];
  notes.forEach((note) => {
    const previous = current[current.length - 1];
    if (previous && note.startMs - previous.endMs >= phraseGapMs) {
      phrases.push({
        startMs: current[0].startMs,
        endMs: previous.endMs,
        notes: current,
      });
      current = [];
    }
    current.push(note);
  });
  if (current.length) {
    phrases.push({
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
      notes: current,
    });
  }
  return phrases;
};

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
