/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { TranslationKey } from '../../common/i18n';
import { karaokeLeadNoteShape } from '../../common/karaoke/melodyArticulation';
import {
  KARAOKE_CANONICAL_CENTER_MIDI,
  projectSingerPitchToTarget,
  TKaraokePitchOctavePolicy,
} from '../../common/karaoke/pitch';
import { IKaraokeToken } from '../../common/karaoke/types';

/**
 * The arithmetic behind the pitch lane, and the shapes it works on.
 *
 * Five hundred lines of KaraokePitchLane.tsx that never touched React: easing a
 * singer's trace, building the melody guide, finding where a performance went
 * wrong, grouping words into lanes. All of it is a function of the notes and the
 * samples, and all of it was already exported for tests — it was living in a
 * component file for no reason beyond where it was first written.
 *
 * The tuning constants come too. They are not the component's settings; they are
 * this arithmetic's, and several of them only make sense read next to the
 * function that uses them.
 */
export interface IKaraokePitchPoint {
  midi: number;
  songTimeMs: number;
  wallTimeMs: number;
  energy: number;
  confidence: number;
  voiced: boolean;
}

export type TKaraokePitchIssueKind = 'high' | 'low' | 'missed';

export interface IKaraokePitchIssue {
  id: string;
  kind: TKaraokePitchIssueKind;
  startMs: number;
  endMs: number;
  averageCents: number;
  sampleCount: number;
}

export interface IKaraokeMelodyGuidePoint {
  songTimeMs: number;
  midi: number;
  startsPhrase: boolean;
}

export interface IKaraokeVisualPitchSample {
  midi: number;
  timeMs: number;
  voiced: boolean;
}

export const WINDOW_PAST_MS = 1_600;
export const WINDOW_FUTURE_MS = 6_400;
export const LIVE_WINDOW_MS = WINDOW_PAST_MS + WINDOW_FUTURE_MS;
export const TRACE_HISTORY_MS = 6_000;
export const MATCH_TOLERANCE_SEMITONES = 0.5;
export const MATCH_FRESHNESS_MS = 180;
export const NOTE_APPROACH_MS = 700;
export const PERFORMANCE_BUCKET_MS = 50;
export const PERFORMANCE_ISSUE_REFRESH_MS = 260;
export const PERFORMANCE_ISSUE_GAP_MS = 240;
export const MINIMUM_ISSUE_SAMPLES = 3;
export const MELODY_GUIDE_SAMPLE_MS = 35;
export const MELODY_GUIDE_TRANSITION_MS = 90;
export const MELODY_GUIDE_MAX_GAP_MS = 90;
export const VISUAL_PITCH_SAMPLE_COUNT = 3;
export const VISUAL_PITCH_RESET_MS = 320;
export const VISUAL_PITCH_SILENCE_HOLD_MS = 180;
export const VISUAL_PITCH_EASE_MS = 105;
export const VISUAL_PITCH_LARGE_MOVE_EASE_MS = 180;
export const VISUAL_PITCH_SILENCE_EASE_MS = 760;
export const VISUAL_PITCH_DEADBAND = 0.025;
export const MINIMUM_VISIBLE_SEMITONES = 24;
export const VIEWPORT_PADDING_SEMITONES = 4;
export const PLOT_LEFT = 46;
export const PLOT_RIGHT = 14;
export const PITCH_WORD_LANES = 3;
export const PLOT_TOP = 52;
export const PLOT_BOTTOM = 52;

export const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Translate a horizontal lane drag into the same eight-second game window. */
export const karaokePitchScrubTime = (
  startTimeMs: number,
  deltaX: number,
  plotWidth: number,
  durationMs: number,
): number =>
  clamp(
    startTimeMs - (deltaX / Math.max(1, plotWidth)) * LIVE_WINDOW_MS,
    0,
    Math.max(0, durationMs),
  );

/** Where a song time sits along the lane: the axis the ruler and notes use. */
export const karaokePitchSongTimeX = (
  timeMs: number,
  playheadMs: number,
  plotWidth: number,
): number =>
  PLOT_LEFT +
  ((timeMs - (playheadMs - WINDOW_PAST_MS)) / LIVE_WINDOW_MS) * plotWidth;

export interface IKaraokeTraceAxis {
  /** The playhead this frame, read from the audio clock. */
  playheadMs: number;
  /** `performance.now()` for this frame. */
  nowMs: number;
  plotWidth: number;
  /** False when no song is loaded and the lane is a bare microphone monitor. */
  hasSongClock: boolean;
  /** True when the drawn trace is the attempt persisted against the song. */
  usesSongTime: boolean;
}

/**
 * Where one sample of the singer's trace is drawn along the lane.
 *
 * THE NEWEST SAMPLE BELONGS ON THE CURSOR. It used to be anchored to the right
 * edge of the plot whenever the song carried no note track, which is most
 * songs — only an imported UltraStar chart supplies notes. The ruler, the
 * blocks and the playhead were all on the song clock with the cursor a fifth
 * of the way in, and the singer's own line was on a wall clock pinned to the
 * far edge: on a thousand-pixel plot the head of the curve sat eight hundred
 * pixels from the cursor and moved to a different beat. There is no reading of
 * that picture in which it lines up with the song.
 *
 * One anchor and one age. While the song plays the two clocks are the same
 * number — both run at one second per second — so which one measures the age
 * only matters at the edges: the wall clock keeps the curve trailing while the
 * transport is paused, and the song clock is the only one that survives a
 * rewind, which is why the persisted attempt is measured with it.
 *
 * With no song there is no cursor to trail, so the bare monitor keeps its own
 * right-anchored scroll and uses the full width.
 */
export const karaokeTraceSampleX = (
  sample: Pick<IKaraokePitchPoint, 'songTimeMs' | 'wallTimeMs'>,
  axis: IKaraokeTraceAxis,
): number => {
  const ageMs = axis.usesSongTime
    ? axis.playheadMs - sample.songTimeMs
    : axis.nowMs - sample.wallTimeMs;
  const anchorX = axis.hasSongClock
    ? karaokePitchSongTimeX(axis.playheadMs, axis.playheadMs, axis.plotWidth)
    : PLOT_LEFT + axis.plotWidth;
  return anchorX - (ageMs / LIVE_WINDOW_MS) * axis.plotWidth;
};

/**
 * The part of a recorded attempt that is behind the cursor, in order.
 *
 * The upper bound is the playhead and not the end of the window. A rewind
 * leaves the previous attempt's samples in the map at song times the singer
 * has not reached again, and drawing those put a curve up to six seconds ahead
 * of the cursor — the trace looked like it had come loose from the song. What
 * was sung before the cursor is still worth seeing; what was sung after it is
 * not yet.
 */
export const karaokeTraceBehindPlayhead = (
  points: readonly IKaraokePitchPoint[],
  windowStartMs: number,
  playheadMs: number,
): IKaraokePitchPoint[] =>
  points
    .filter(
      (point) =>
        point.songTimeMs >= windowStartMs && point.songTimeMs <= playheadMs,
    )
    .sort((left, right) => left.songTimeMs - right.songTimeMs);

export const ISSUE_KEYS: Record<TKaraokePitchIssueKind, TranslationKey> = {
  high: 'karaoke.pitch.issueHigh',
  low: 'karaoke.pitch.issueLow',
  missed: 'karaoke.pitch.issueMissed',
};

export const isTimedTarget = (
  note: IKaraokeToken,
): note is IKaraokeToken & {
  startMs: number;
  endMs: number;
  targetMidi: number;
} =>
  note.startMs !== undefined &&
  note.endMs !== undefined &&
  note.targetMidi !== undefined;

/** Where the melody guide is at a moment, on the note's drawn shape. */
export const targetAtTime = (
  notes: readonly IKaraokeToken[],
  timeMs: number,
): number | undefined =>
  notes.find((note) => {
    if (!isTimedTarget(note)) {
      return false;
    }
    const shape = karaokeLeadNoteShape(note);
    return shape.startMs <= timeMs && shape.endMs >= timeMs;
  })?.targetMidi;

/**
 * How far outside a note the singer still counts as being on it.
 *
 * Measured elsewhere in this app and reused here: a gap of 220ms between
 * notes is where a human hears one karaoke line end and the next begin. A
 * hold just inside that lets the trace stay on the note across every join
 * within a phrase — singers arrive early and let go late on all of them —
 * while a real line break still releases it, because at a line break there is
 * no note to be near and pretending otherwise would be a lie about pitch.
 */
export const NOTE_ATTACH_HOLD_MS = 200;

/**
 * The note the singer is on at a moment, by the timing they were given.
 *
 * `targetAtTime` above answers a different question and must not be used for
 * this one. It reports where the *guide* is, on a window that is deliberately
 * short — the gate ends each note before its syllable does so that consecutive
 * blocks read as separate. Asked instead which note a singer is on, it was
 * wrong on every note in the song: the trace came unstuck for the last fifth
 * of each syllable and drifted at absolute pitch until the next one began, and
 * while the cue was also capped at 1.45 seconds it came unstuck two and a half
 * seconds into a four-second held vowel. The attachment that is the whole
 * point of this lane was therefore off most of the time it was needed.
 *
 * The authored range is the syllable the singer was asked to sing, so that,
 * widened by the hold above, is what they are on.
 *
 * Freestyle notes are excluded. UltraStar's `F` marks a passage with no pitch
 * requirement and its written pitch is filler; attaching to it would draw the
 * singer as sharp or flat against a number nobody chose.
 */
export const singerTargetAtTime = (
  notes: readonly IKaraokeToken[],
  timeMs: number,
  holdMs = NOTE_ATTACH_HOLD_MS,
): number | undefined => {
  let nearestMidi: number | undefined;
  let nearestDistanceMs = Number.POSITIVE_INFINITY;
  notes.forEach((note) => {
    if (!isTimedTarget(note) || note.kind === 'free') {
      return;
    }
    const distanceMs =
      timeMs < note.startMs
        ? note.startMs - timeMs
        : Math.max(0, timeMs - note.endMs);
    if (distanceMs <= holdMs && distanceMs < nearestDistanceMs) {
      nearestDistanceMs = distanceMs;
      nearestMidi = note.targetMidi;
    }
  });
  return nearestMidi;
};

const smoothStep = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * How far off the note the singer can be before the curve stops moving away.
 *
 * Two semitones is a whole tone — comfortably past "slightly flat" and into
 * "singing a different note". There is nothing useful left to show beyond it:
 * whether somebody is two semitones or nine semitones out, the answer is the
 * same and it is not on this note.
 */
const ATTACH_VISIBLE_SEMITONES = 2;

/**
 * The furthest the curve is ever drawn from the note's own line.
 *
 * A shade over one semitone, which is a little more than the height of a note
 * block. That is the whole point: however wrong the singing, the line stays
 * beside the note it belongs to instead of wandering into open lane, so it
 * always reads as "above this note", "below this note" or "on it".
 */
const ATTACH_MAX_OFFSET_SEMITONES = 1.1;

/**
 * Draw the singer against the note rather than against the whole octave.
 *
 * THE CURVE USED TO BE PLOTTED AT ABSOLUTE PITCH, which is honest and reads
 * badly. A singer a tone under the melody produced a line drifting somewhere
 * between two note blocks, belonging to neither, and the eye had to measure a
 * gap to work out what was wrong. What a singer needs from this lane is one
 * fact — am I on the note, over it, or under it — and that fact is a position
 * relative to the note, not a position in the octave.
 *
 * COMPRESSED, NOT SNAPPED, and the difference is the whole design. Snapping to
 * the nearest note would make being a quarter-tone flat look identical to
 * being perfect, which throws away the only thing the lane is for. Instead the
 * error is squashed through `smoothStep` and capped: small errors stay small
 * and near the middle of the note, a full semitone shows as roughly half a
 * semitone of visible offset, and anything past a whole tone pins just outside
 * the block. The tune is still legible — sharp still looks sharp — but it is
 * legible *at* the note.
 *
 * The easing pass runs after this one, which is what makes the handover at a
 * note boundary a curve rather than a step: nothing here has to blend, because
 * `easeKaraokeSingerTrace` is already smoothing the series it produces.
 *
 * With no note sounding there is nothing to attach to, so the raw pitch is
 * returned and the line floats — which is correct between phrases, where there
 * is no right answer to be near.
 */
export const attachKaraokePitchToNote = (
  singerMidi: number,
  targetMidi: number | undefined,
): number => {
  if (targetMidi === undefined || !Number.isFinite(singerMidi)) {
    return singerMidi;
  }
  const deviation = singerMidi - targetMidi;
  const magnitude = Math.abs(deviation);
  const eased = smoothStep(magnitude / ATTACH_VISIBLE_SEMITONES);
  return (
    targetMidi + Math.sign(deviation) * ATTACH_MAX_OFFSET_SEMITONES * eased
  );
};

/**
 * Ease only the curve the singer sees.
 *
 * Pitch detection naturally produces small frame-to-frame wobble and the
 * occasional one-frame octave error. A three-sample median removes that spike;
 * a time-based low-pass then makes real movement flow instead of stepping.
 * Raw samples remain unchanged for scoring and performance review.
 */
export const easeKaraokeSingerTrace = (
  samples: readonly IKaraokeVisualPitchSample[],
  fallbackMidi: number,
): number[] => {
  const safeFallback = Number.isFinite(fallbackMidi)
    ? fallbackMidi
    : KARAOKE_CANONICAL_CENTER_MIDI;
  const recentMidis: number[] = [];
  let displayedMidi: number | undefined;
  let lastSampleAt: number | undefined;
  let lastVoicedAt: number | undefined;

  return samples.map((sample) => {
    const sampleTime = Number.isFinite(sample.timeMs)
      ? sample.timeMs
      : (lastSampleAt ?? 0);
    const elapsedMs = clamp(sampleTime - (lastSampleAt ?? sampleTime), 16, 140);
    const isVoiced = sample.voiced && Number.isFinite(sample.midi);

    if (isVoiced) {
      const voiceGapMs = sampleTime - (lastVoicedAt ?? sampleTime);
      if (lastVoicedAt === undefined || voiceGapMs > VISUAL_PITCH_RESET_MS) {
        recentMidis.length = 0;
      }
      recentMidis.push(sample.midi);
      if (recentMidis.length > VISUAL_PITCH_SAMPLE_COUNT) {
        recentMidis.shift();
      }
      const ordered = [...recentMidis].sort((left, right) => left - right);
      const middle = Math.floor(ordered.length / 2);
      const robustMidi =
        ordered.length % 2 === 0
          ? (ordered[middle - 1] + ordered[middle]) / 2
          : ordered[middle];

      if (
        displayedMidi === undefined ||
        lastVoicedAt === undefined ||
        voiceGapMs > VISUAL_PITCH_RESET_MS
      ) {
        // A new phrase should begin where the singer begins; easing across a
        // breath would draw a pitch transition that was never sung.
        displayedMidi = robustMidi;
      } else {
        const difference = robustMidi - displayedMidi;
        if (Math.abs(difference) > VISUAL_PITCH_DEADBAND) {
          const easingMs =
            Math.abs(difference) > 3
              ? VISUAL_PITCH_LARGE_MOVE_EASE_MS
              : VISUAL_PITCH_EASE_MS;
          const amount = 1 - Math.exp(-elapsedMs / easingMs);
          displayedMidi += difference * amount;
        }
      }
      lastVoicedAt = sampleTime;
    } else if (displayedMidi === undefined) {
      displayedMidi = safeFallback;
    } else if (
      lastVoicedAt !== undefined &&
      sampleTime - lastVoicedAt > VISUAL_PITCH_SILENCE_HOLD_MS
    ) {
      // Silence no longer dives to the centre line in one frame. It rests for
      // a moment, then settles gently so a breath cannot look like a bad note.
      const amount = 1 - Math.exp(-elapsedMs / VISUAL_PITCH_SILENCE_EASE_MS);
      displayedMidi += (safeFallback - displayedMidi) * amount;
    }

    lastSampleAt = sampleTime;
    return displayedMidi ?? safeFallback;
  });
};

/**
 * Turn normalized lead notes into an ideal singer-like pitch trace.
 * Short neighboring notes glide into one another; real phrase gaps remain
 * separate so the guide never invents pitch while the singer should breathe.
 */
export const buildKaraokeMelodyGuide = (
  notes: readonly IKaraokeToken[],
): IKaraokeMelodyGuidePoint[] => {
  const timedNotes = notes.filter(isTimedTarget).sort((left, right) => {
    return left.startMs - right.startMs;
  });
  const points: IKaraokeMelodyGuidePoint[] = [];
  const connects = (
    left: (typeof timedNotes)[number] | undefined,
    right: (typeof timedNotes)[number] | undefined,
  ) => {
    if (
      left === undefined ||
      right === undefined ||
      left.kind === 'free' ||
      right.kind === 'free'
    ) {
      return false;
    }
    const authoredGapMs = right.startMs - left.endMs;
    const articulatedGapMs = right.startMs - karaokeLeadNoteShape(left).endMs;
    const continuesSameWord = right.startsWord === false;
    return continuesSameWord
      ? authoredGapMs <= MELODY_GUIDE_MAX_GAP_MS
      : articulatedGapMs <= 18;
  };

  timedNotes.forEach((note, noteIndex) => {
    if (note.kind === 'free') {
      return;
    }
    const previous = timedNotes[noteIndex - 1];
    const next = timedNotes[noteIndex + 1];
    const connectsPrevious = connects(previous, note);
    const connectsNext = connects(note, next);
    const shape = karaokeLeadNoteShape(note);
    const noteEndMs = shape.endMs;
    const duration = shape.durationMs;
    const transitionMs = Math.min(MELODY_GUIDE_TRANSITION_MS, duration * 0.36);
    const sampleTimes: number[] = [note.startMs];
    for (
      let timeMs = note.startMs + MELODY_GUIDE_SAMPLE_MS;
      timeMs < noteEndMs;
      timeMs += MELODY_GUIDE_SAMPLE_MS
    ) {
      sampleTimes.push(timeMs);
    }
    sampleTimes.push(noteEndMs);

    sampleTimes.forEach((songTimeMs, sampleIndex) => {
      let midi = note.targetMidi;
      if (
        connectsPrevious &&
        previous &&
        songTimeMs <= note.startMs + transitionMs
      ) {
        const progress = smoothStep(
          (songTimeMs - (note.startMs - transitionMs)) / (transitionMs * 2),
        );
        midi =
          previous.targetMidi +
          (note.targetMidi - previous.targetMidi) * progress;
      } else if (
        connectsNext &&
        next &&
        songTimeMs >= noteEndMs - transitionMs
      ) {
        const progress = smoothStep(
          (songTimeMs - (noteEndMs - transitionMs)) / (transitionMs * 2),
        );
        midi = note.targetMidi + (next.targetMidi - note.targetMidi) * progress;
      }
      const previousPoint = points[points.length - 1];
      if (
        previousPoint?.songTimeMs === songTimeMs &&
        Math.abs(previousPoint.midi - midi) < 0.001
      ) {
        return;
      }
      points.push({
        songTimeMs,
        midi,
        startsPhrase: sampleIndex === 0 && !connectsPrevious,
      });
    });
  });
  return points;
};

/** Find contiguous latest-attempt regions that need another vocal pass. */
export const findKaraokePitchIssues = (
  points: readonly IKaraokePitchPoint[],
  notes: readonly IKaraokeToken[],
  octavePolicy: TKaraokePitchOctavePolicy,
  toleranceSemitones = MATCH_TOLERANCE_SEMITONES,
): IKaraokePitchIssue[] => {
  const issues: IKaraokePitchIssue[] = [];
  // Freestyle is excluded here for the same reason `singerTargetAtTime`
  // excludes it: UltraStar's `F` marks a passage with no pitch requirement and
  // its written pitch is filler. Scored against that number, a rap line came
  // back as flat, and staying quiet through one came back as a missed note —
  // the review told the singer to fix a passage the chart never asked them to
  // sing. It also left the strip disagreeing with the curve above it, which
  // floats free there rather than attaching.
  const timedNotes = notes
    .filter(isTimedTarget)
    .filter((note) => note.kind !== 'free')
    .sort((left, right) => {
      return left.startMs - right.startMs;
    });
  let noteIndex = 0;
  let current:
    | (IKaraokePitchIssue & {
        errorTotal: number;
        errorCount: number;
        lastSampleMs: number;
      })
    | undefined;

  const flush = () => {
    if (current && current.sampleCount >= MINIMUM_ISSUE_SAMPLES) {
      issues.push({
        id: `${current.kind}-${Math.round(current.startMs)}-${Math.round(
          current.endMs,
        )}`,
        kind: current.kind,
        startMs: current.startMs,
        endMs: current.endMs,
        averageCents: current.errorCount
          ? Math.round((current.errorTotal / current.errorCount) * 100)
          : 0,
        sampleCount: current.sampleCount,
      });
    }
    current = undefined;
  };

  [...points]
    .sort((left, right) => left.songTimeMs - right.songTimeMs)
    .forEach((point) => {
      while (
        noteIndex < timedNotes.length &&
        timedNotes[noteIndex].endMs < point.songTimeMs
      ) {
        noteIndex += 1;
      }
      const targetNote = timedNotes[noteIndex];
      if (
        !targetNote ||
        targetNote.startMs > point.songTimeMs ||
        targetNote.endMs < point.songTimeMs
      ) {
        flush();
        return;
      }
      const error = point.voiced
        ? projectSingerPitchToTarget(
            point.midi,
            targetNote.targetMidi,
            octavePolicy,
          ) - targetNote.targetMidi
        : 0;
      let kind: TKaraokePitchIssueKind | undefined;
      if (!point.voiced) {
        kind = 'missed';
      } else if (error > toleranceSemitones) {
        kind = 'high';
      } else if (error < -toleranceSemitones) {
        kind = 'low';
      }
      if (!kind) {
        flush();
        return;
      }

      const continuesCurrent =
        current?.kind === kind &&
        point.songTimeMs - current.lastSampleMs <= PERFORMANCE_ISSUE_GAP_MS;
      if (!continuesCurrent) {
        flush();
        current = {
          id: '',
          kind,
          startMs: targetNote.startMs,
          endMs: targetNote.endMs,
          averageCents: 0,
          sampleCount: 0,
          errorTotal: 0,
          errorCount: 0,
          lastSampleMs: point.songTimeMs,
        };
      }
      if (!current) {
        return;
      }
      current.startMs = Math.min(current.startMs, targetNote.startMs);
      current.endMs = Math.max(current.endMs, targetNote.endMs);
      current.lastSampleMs = point.songTimeMs;
      current.sampleCount += 1;
      if (point.voiced) {
        current.errorTotal += error;
        current.errorCount += 1;
      }
    });
  flush();
  return issues;
};

interface IKaraokePitchWord {
  text: string;
  startMs: number;
  endMs: number;
}

export type TKaraokeNoteTimingState = 'idle' | 'approaching' | 'active';

/** Timing-only state for the target block as it reaches the playhead. */
export const karaokeNoteTimingState = (
  startMs: number,
  endMs: number,
  playheadMs: number,
  approachMs = NOTE_APPROACH_MS,
): TKaraokeNoteTimingState => {
  if (playheadMs >= startMs && playheadMs <= endMs) {
    return 'active';
  }
  if (startMs > playheadMs && startMs - playheadMs <= approachMs) {
    return 'approaching';
  }
  return 'idle';
};

/** Join provider syllable tokens into readable words without losing timing. */
export const groupKaraokePitchWords = (
  notes: readonly IKaraokeToken[],
): IKaraokePitchWord[] => {
  const words: IKaraokePitchWord[] = [];
  let current: IKaraokePitchWord | undefined;
  const flush = () => {
    if (current?.text) {
      words.push(current);
    }
    current = undefined;
  };

  notes.filter(isTimedTarget).forEach((note) => {
    const rawText = note.text;
    const text = rawText.trim();
    const startsWord = note.startsWord ?? /^\s/.test(rawText);
    if (current && startsWord) {
      flush();
    }
    if (!text) {
      // A provider may encode a melisma as a silent text token. It still
      // belongs to the current word and must extend its visual duration.
      if (current) {
        current.endMs = note.endMs;
      }
      return;
    }
    if (!current) {
      current = {
        text,
        startMs: note.startMs,
        endMs: note.endMs,
      };
    } else {
      current.text += text;
      current.endMs = note.endMs;
    }
  });
  flush();
  return words;
};

/** Progressive lyric fill shared by the word label and its timing underline. */
export const karaokePitchWordProgress = (
  startMs: number,
  endMs: number,
  playheadMs: number,
): number => {
  if (playheadMs <= startMs) {
    return 0;
  }
  if (playheadMs >= endMs || endMs <= startMs) {
    return 1;
  }
  return clamp((playheadMs - startMs) / (endMs - startMs), 0, 1);
};

export const roundedRectPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  preferredRadius?: number,
) => {
  const radius = Math.min(preferredRadius ?? height / 2, height / 2, width / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
};

export const traceColor = (
  current: IKaraokePitchPoint,
  previous: IKaraokePitchPoint | undefined,
  notes: readonly IKaraokeToken[],
  octavePolicy: TKaraokePitchOctavePolicy,
): string => {
  if (!current.voiced) {
    return 'rgba(34, 224, 214, 0.38)';
  }
  // The same note the curve is drawn against, so the colour and the position
  // can never disagree about whether the singer is sharp.
  const targetMidi = singerTargetAtTime(notes, current.songTimeMs);
  const movement =
    targetMidi === undefined
      ? current.midi - (previous?.midi ?? current.midi)
      : projectSingerPitchToTarget(current.midi, targetMidi, octavePolicy) -
        targetMidi;
  if (movement > 0.35) {
    return '#9be348';
  }
  if (movement < -0.35) {
    return '#ff655d';
  }
  return '#f2d04f';
};
