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

import {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { TranslationKey } from '../../common/i18n';
import { formatKaraokeTime } from '../../common/karaoke/clock';
import {
  easeKaraokePitchViewport,
  IKaraokePitchViewport,
  KARAOKE_CANONICAL_CENTER_MIDI,
  karaokePitchViewportForTargets,
  midiToNoteName,
  projectSingerPitchToTarget,
  singerPitchMatchesTarget,
  TKaraokePitchOctavePolicy,
} from '../../common/karaoke/pitch';
import { IKaraokeToken, TKaraokePitchTarget } from '../../common/karaoke/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import {
  IKaraokeLivePitch,
  TKaraokeMicrophoneStatus,
  TKaraokePitchAnalysisStatus,
} from './useKaraokeMicrophone';

interface IKaraokePitchLaneProps {
  isActive: boolean;
  isPlaying?: boolean;
  pitch?: IKaraokeLivePitch;
  analysisStatus: TKaraokePitchAnalysisStatus;
  target?: TKaraokePitchTarget;
  playheadMs: number;
  durationMs?: number;
  readPlayheadMs?: () => number;
  microphoneStatus?: TKaraokeMicrophoneStatus;
  onToggleMicrophone?: () => void;
  onPracticeIssue?: (issue: IKaraokePitchIssue) => void;
  melodyToneEnabled?: boolean;
  melodyToneAvailable?: boolean;
  melodyToneVolume?: number;
  onToggleMelodyTone?: () => void;
  onMelodyToneVolume?: (volume: number) => void;
  onScrubStart?: () => void;
  onScrub?: (timeMs: number) => void;
  onScrubEnd?: (timeMs: number) => void;
}

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

interface IKaraokePitchViewportState {
  viewport: IKaraokePitchViewport;
  frameTimeMs: number;
}

interface IKaraokeIssueHitRegion {
  issue: IKaraokePitchIssue;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface IKaraokePitchScrubState {
  pointerId: number;
  startX: number;
  startTimeMs: number;
  lastTimeMs: number;
  moved: boolean;
}

const WINDOW_PAST_MS = 1_600;
const WINDOW_FUTURE_MS = 6_400;
const LIVE_WINDOW_MS = WINDOW_PAST_MS + WINDOW_FUTURE_MS;
const TRACE_HISTORY_MS = 6_000;
const MATCH_TOLERANCE_SEMITONES = 0.5;
const MATCH_FRESHNESS_MS = 180;
const NOTE_APPROACH_MS = 700;
const PERFORMANCE_BUCKET_MS = 50;
const PERFORMANCE_ISSUE_REFRESH_MS = 260;
const PERFORMANCE_ISSUE_GAP_MS = 240;
const MINIMUM_ISSUE_SAMPLES = 3;
const MELODY_GUIDE_SAMPLE_MS = 35;
const MELODY_GUIDE_TRANSITION_MS = 90;
const MELODY_GUIDE_MAX_GAP_MS = 90;
const VISUAL_PITCH_SAMPLE_COUNT = 3;
const VISUAL_PITCH_RESET_MS = 320;
const VISUAL_PITCH_SILENCE_HOLD_MS = 180;
const VISUAL_PITCH_EASE_MS = 105;
const VISUAL_PITCH_LARGE_MOVE_EASE_MS = 180;
const VISUAL_PITCH_SILENCE_EASE_MS = 760;
const VISUAL_PITCH_DEADBAND = 0.025;
const MINIMUM_VISIBLE_SEMITONES = 24;
const VIEWPORT_PADDING_SEMITONES = 4;
const PLOT_LEFT = 46;
const PLOT_RIGHT = 14;
const PITCH_WORD_LANES = 3;
const PLOT_TOP = 52;
const PLOT_BOTTOM = 52;

const clamp = (value: number, minimum: number, maximum: number) =>
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

const ISSUE_KEYS: Record<TKaraokePitchIssueKind, TranslationKey> = {
  high: 'karaoke.pitch.issueHigh',
  low: 'karaoke.pitch.issueLow',
  missed: 'karaoke.pitch.issueMissed',
};

const isTimedTarget = (
  note: IKaraokeToken,
): note is IKaraokeToken & {
  startMs: number;
  endMs: number;
  targetMidi: number;
} =>
  note.startMs !== undefined &&
  note.endMs !== undefined &&
  note.targetMidi !== undefined;

const targetAtTime = (
  notes: readonly IKaraokeToken[],
  timeMs: number,
): number | undefined =>
  notes.find(
    (note) =>
      isTimedTarget(note) && note.startMs <= timeMs && note.endMs >= timeMs,
  )?.targetMidi;

const smoothStep = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
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
  ) =>
    left !== undefined &&
    right !== undefined &&
    left.kind !== 'free' &&
    right.kind !== 'free' &&
    right.startMs - left.endMs <= MELODY_GUIDE_MAX_GAP_MS;

  timedNotes.forEach((note, noteIndex) => {
    if (note.kind === 'free') {
      return;
    }
    const previous = timedNotes[noteIndex - 1];
    const next = timedNotes[noteIndex + 1];
    const connectsPrevious = connects(previous, note);
    const connectsNext = connects(note, next);
    const duration = Math.max(1, note.endMs - note.startMs);
    const transitionMs = Math.min(MELODY_GUIDE_TRANSITION_MS, duration * 0.36);
    const sampleTimes: number[] = [note.startMs];
    for (
      let timeMs = note.startMs + MELODY_GUIDE_SAMPLE_MS;
      timeMs < note.endMs;
      timeMs += MELODY_GUIDE_SAMPLE_MS
    ) {
      sampleTimes.push(timeMs);
    }
    sampleTimes.push(note.endMs);

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
        songTimeMs >= note.endMs - transitionMs
      ) {
        const progress = smoothStep(
          (songTimeMs - (note.endMs - transitionMs)) / (transitionMs * 2),
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
  const timedNotes = notes.filter(isTimedTarget).sort((left, right) => {
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

const roundedRectPath = (
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

const traceColor = (
  current: IKaraokePitchPoint,
  previous: IKaraokePitchPoint | undefined,
  notes: readonly IKaraokeToken[],
  octavePolicy: TKaraokePitchOctavePolicy,
): string => {
  if (!current.voiced) {
    return 'rgba(34, 224, 214, 0.38)';
  }
  const targetMidi = targetAtTime(notes, current.songTimeMs);
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

const KaraokePitchLane = ({
  isActive,
  isPlaying = false,
  pitch,
  analysisStatus,
  target,
  playheadMs,
  durationMs = 0,
  readPlayheadMs,
  microphoneStatus = 'off',
  onToggleMicrophone,
  onPracticeIssue,
  melodyToneEnabled = false,
  melodyToneAvailable = true,
  melodyToneVolume = 0.34,
  onToggleMelodyTone,
  onMelodyToneVolume,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: IKaraokePitchLaneProps) => {
  const { t } = useTranslation();
  const melodyToneVolumeId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const issueHitRegionsRef = useRef<IKaraokeIssueHitRegion[]>([]);
  const hoveredIssueIdRef = useRef<string | undefined>(undefined);
  const traceRef = useRef<IKaraokePitchPoint[]>([]);
  const performanceTraceRef = useRef(new Map<number, IKaraokePitchPoint>());
  const performanceIssueUpdateRef = useRef(0);
  const performanceIssueSignatureRef = useRef('');
  const viewportRef = useRef<IKaraokePitchViewportState | undefined>(undefined);
  const lastTraceSampleRef = useRef(0);
  const scrubStateRef = useRef<IKaraokePitchScrubState | undefined>(undefined);
  const suppressCanvasClickRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [performanceIssues, setPerformanceIssues] = useState<
    IKaraokePitchIssue[]
  >([]);
  const hasTargets = target?.kind === 'notes';
  const isMicrophoneLive = microphoneStatus === 'live';
  const isMicrophoneBusy = microphoneStatus === 'requesting';
  const isMicrophoneUnavailable = microphoneStatus === 'unavailable';
  const canScrub = durationMs > 0 && Boolean(onScrub);

  useEffect(() => {
    traceRef.current = [];
    performanceTraceRef.current.clear();
    performanceIssueUpdateRef.current = 0;
    performanceIssueSignatureRef.current = '';
    setPerformanceIssues([]);
    viewportRef.current = undefined;
    lastTraceSampleRef.current = 0;
  }, [target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    // ResizeObserver is present in Chromium. This guard also keeps DOM-only
    // test environments from pretending they can validate canvas pixels.
    if (!canvas || !isActive || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    let animationFrame = 0;
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      const pixelWidth = Math.round(width * pixelRatio);
      const pixelHeight = Math.round(height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fontKerning = 'normal';
      context.textRendering = 'optimizeLegibility';
      issueHitRegionsRef.current = [];

      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, 'rgba(12, 27, 46, 0.96)');
      background.addColorStop(0.58, 'rgba(8, 20, 35, 0.96)');
      background.addColorStop(1, 'rgba(5, 14, 25, 0.98)');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const plotWidth = Math.max(1, width - PLOT_LEFT - PLOT_RIGHT);
      const plotHeight = Math.max(1, height - PLOT_TOP - PLOT_BOTTOM);
      const now = performance.now();
      const directPlayheadMs = readPlayheadMs?.();
      const synchronizedPlayheadMs = Number.isFinite(directPlayheadMs)
        ? (directPlayheadMs as number)
        : playheadMs;
      const windowStartMs = synchronizedPlayheadMs - WINDOW_PAST_MS;
      const windowEndMs = synchronizedPlayheadMs + WINDOW_FUTURE_MS;
      const visibleNotes =
        target?.kind === 'notes'
          ? target.notes.filter(
              (note) =>
                isTimedTarget(note) &&
                note.endMs >= windowStartMs &&
                note.startMs <= windowEndMs,
            )
          : [];
      const octavePolicy =
        target?.kind === 'notes' ? target.octavePolicy : 'nearest-target';
      const targetHasAbsoluteOctaves = octavePolicy === 'absolute';
      const targetMidis = visibleNotes
        .map((note) => note.targetMidi)
        .filter((midi): midi is number => midi !== undefined)
        .sort((left, right) => left - right);
      const targetViewport = karaokePitchViewportForTargets(
        targetMidis,
        pitch?.midi ?? KARAOKE_CANONICAL_CENTER_MIDI,
        MINIMUM_VISIBLE_SEMITONES,
        VIEWPORT_PADDING_SEMITONES,
      );
      const previousViewport = viewportRef.current;
      const viewport = previousViewport
        ? easeKaraokePitchViewport(
            previousViewport.viewport,
            targetViewport,
            now - previousViewport.frameTimeMs,
          )
        : targetViewport;
      viewportRef.current = { viewport, frameTimeMs: now };
      const { centerMidi, semitoneSpan } = viewport;
      const topMidi = centerMidi + semitoneSpan / 2;
      const semitoneHeight = plotHeight / semitoneSpan;
      const yForMidi = (midi: number) =>
        PLOT_TOP + (topMidi - midi) * semitoneHeight;
      const xForSongTime = (timeMs: number) =>
        PLOT_LEFT + ((timeMs - windowStartMs) / LIVE_WINDOW_MS) * plotWidth;

      // Keep a stable lane derived from the word's global index. Words then
      // glide horizontally with the song clock without jumping vertically as
      // neighboring words enter or leave the visible time window.
      const allWords =
        target?.kind === 'notes' ? groupKaraokePitchWords(target.notes) : [];
      const visibleWords = allWords
        .map((word, wordIndex) => ({ word, wordIndex }))
        .filter(
          ({ word }) =>
            word.endMs >= windowStartMs && word.startMs <= windowEndMs,
        );
      const wordLayout = visibleWords.map(({ word, wordIndex }) => {
        const noteLeft = Math.max(PLOT_LEFT, xForSongTime(word.startMs));
        const noteRight = Math.min(
          PLOT_LEFT + plotWidth,
          xForSongTime(word.endMs),
        );
        const centerMs = (word.startMs + word.endMs) / 2;
        const previousLaneWord = allWords[wordIndex - PITCH_WORD_LANES];
        const nextLaneWord = allWords[wordIndex + PITCH_WORD_LANES];
        const slotStartMs = previousLaneWord
          ? ((previousLaneWord.startMs + previousLaneWord.endMs) / 2 +
              centerMs) /
            2
          : windowStartMs;
        const slotEndMs = nextLaneWord
          ? (centerMs + (nextLaneWord.startMs + nextLaneWord.endMs) / 2) / 2
          : windowEndMs;
        return {
          word,
          lane: wordIndex % PITCH_WORD_LANES,
          noteLeft,
          noteRight,
          center: xForSongTime(centerMs),
          slotLeft: Math.max(PLOT_LEFT, xForSongTime(slotStartMs)),
          slotRight: Math.min(PLOT_LEFT + plotWidth, xForSongTime(slotEndMs)),
        };
      });
      wordLayout.forEach((layoutWord) => {
        const { word, lane, noteLeft, noteRight, center, slotLeft, slotRight } =
          layoutWord;
        const slotWidth = Math.max(1, slotRight - slotLeft);
        const isCurrent =
          word.startMs <= synchronizedPlayheadMs &&
          word.endMs >= synchronizedPlayheadMs;
        context.save();
        context.beginPath();
        context.rect(PLOT_LEFT, 0, plotWidth, PLOT_TOP - 3);
        context.clip();
        let labelFontSize = isCurrent ? 11.5 : 10.5;
        const labelWeight = isCurrent ? 800 : 680;
        context.font = `${labelWeight} ${labelFontSize}px Inter, system-ui, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        let textWidth = Math.max(1, context.measureText(word.text).width);
        const availableLabelWidth = Math.max(18, slotWidth - 8);
        if (textWidth > availableLabelWidth) {
          labelFontSize = Math.max(
            8.5,
            labelFontSize * (availableLabelWidth / textWidth),
          );
          context.font = `${labelWeight} ${labelFontSize}px Inter, system-ui, sans-serif`;
          textWidth = Math.max(1, context.measureText(word.text).width);
        }
        const labelX = clamp(
          center,
          PLOT_LEFT + textWidth / 2 + 3,
          PLOT_LEFT + plotWidth - textWidth / 2 - 3,
        );
        const labelY = 10 + lane * 13;
        context.fillStyle = isCurrent
          ? 'rgba(107, 233, 242, 1)'
          : 'rgba(205, 216, 237, 0.78)';
        context.shadowColor = isCurrent
          ? 'rgba(48, 145, 255, 0.62)'
          : 'transparent';
        context.shadowBlur = isCurrent ? 8 : 0;
        context.fillText(word.text, labelX, labelY);
        context.restore();

        context.strokeStyle = isCurrent
          ? 'rgba(48, 145, 255, 1)'
          : 'rgba(34, 224, 214, 0.34)';
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(noteLeft, PLOT_TOP - 6);
        context.lineTo(Math.max(noteLeft + 1, noteRight), PLOT_TOP - 6);
        context.stroke();
      });

      context.font = '600 9px Arial, sans-serif';
      context.textBaseline = 'middle';
      context.textAlign = 'right';
      const bottomMidi = centerMidi - semitoneSpan / 2;
      const tickStep = semitoneSpan > 48 ? 12 : 6;
      const firstPitchTick = Math.ceil(bottomMidi / tickStep) * tickStep;
      const topPitchTick = centerMidi + semitoneSpan / 2;
      for (
        let tickMidi = firstPitchTick;
        tickMidi <= topPitchTick;
        tickMidi += tickStep
      ) {
        const semitone = tickMidi - KARAOKE_CANONICAL_CENTER_MIDI;
        const y = yForMidi(tickMidi);
        let labelColor = 'rgba(242, 208, 79, 0.78)';
        if (semitone > 0) {
          labelColor = 'rgba(155, 227, 72, 0.78)';
        } else if (semitone < 0) {
          labelColor = 'rgba(255, 101, 93, 0.78)';
        }
        context.fillStyle = labelColor;
        context.fillText(
          `${midiToNoteName(tickMidi, targetHasAbsoluteOctaves)} ${
            semitone > 0 ? '+' : ''
          }${semitone}`,
          PLOT_LEFT - 8,
          y,
        );
        context.strokeStyle =
          semitone === 0
            ? 'rgba(242, 208, 79, 0.2)'
            : 'rgba(225, 231, 244, 0.075)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(PLOT_LEFT, y);
        context.lineTo(PLOT_LEFT + plotWidth, y);
        context.stroke();
      }

      const firstTickMs = Math.ceil(windowStartMs / 1_000) * 1_000;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      for (let tickMs = firstTickMs; tickMs <= windowEndMs; tickMs += 1_000) {
        const x = xForSongTime(tickMs);
        context.strokeStyle = 'rgba(225, 231, 244, 0.055)';
        context.beginPath();
        context.moveTo(x, PLOT_TOP);
        context.lineTo(x, PLOT_TOP + plotHeight);
        context.stroke();
        context.fillStyle = 'rgba(167, 181, 205, 0.54)';
        context.fillText(
          formatKaraokeTime(tickMs),
          x,
          PLOT_TOP + plotHeight + 15,
        );
      }

      if (isMicrophoneLive && now - lastTraceSampleRef.current >= 45) {
        const lastVoiced = [...traceRef.current]
          .reverse()
          .find((point) => point.voiced);
        const heldMidi =
          lastVoiced && now - lastVoiced.wallTimeMs < 320
            ? lastVoiced.midi
            : centerMidi;
        const sample: IKaraokePitchPoint = {
          midi: pitch?.midi ?? heldMidi,
          songTimeMs: synchronizedPlayheadMs,
          wallTimeMs: now,
          energy: pitch?.rms ?? 0,
          confidence: pitch?.confidence ?? 0.25,
          voiced: Boolean(pitch),
        };
        traceRef.current.push(sample);
        traceRef.current = traceRef.current
          .filter((point) => now - point.wallTimeMs <= LIVE_WINDOW_MS + 1_000)
          .slice(-180);
        if (isPlaying && target?.kind === 'notes') {
          // One latest sample per song-time bucket. Re-singing after a rewind
          // naturally replaces the previous attempt over that same range.
          performanceTraceRef.current.set(
            Math.round(synchronizedPlayheadMs / PERFORMANCE_BUCKET_MS),
            sample,
          );
          if (
            now - performanceIssueUpdateRef.current >=
            PERFORMANCE_ISSUE_REFRESH_MS
          ) {
            const nextIssues = findKaraokePitchIssues(
              Array.from(performanceTraceRef.current.values()),
              target.notes,
              target.octavePolicy,
            );
            const signature = nextIssues
              .map(
                (issue) =>
                  `${issue.id}-${issue.averageCents}-${issue.sampleCount}`,
              )
              .join('|');
            if (signature !== performanceIssueSignatureRef.current) {
              performanceIssueSignatureRef.current = signature;
              setPerformanceIssues(nextIssues);
            }
            performanceIssueUpdateRef.current = now;
          }
        }
        lastTraceSampleRef.current = now;
      }
      const liveTrace = traceRef.current.filter((point) =>
        hasTargets
          ? point.songTimeMs >= windowStartMs && point.songTimeMs <= windowEndMs
          : now - point.wallTimeMs <= TRACE_HISTORY_MS,
      );
      const trace = hasTargets
        ? Array.from(performanceTraceRef.current.values())
            .filter(
              (point) =>
                point.songTimeMs >= windowStartMs &&
                point.songTimeMs <= windowEndMs,
            )
            .sort((left, right) => left.songTimeMs - right.songTimeMs)
        : liveTrace;
      const latestVoicedPoint = [...liveTrace]
        .reverse()
        .find(
          (point) =>
            point.voiced && now - point.wallTimeMs <= MATCH_FRESHNESS_MS,
        );

      const floatingLabelRightByPitch = new Map<number, number>();
      visibleNotes.forEach((note) => {
        const startMs = note.startMs as number;
        const endMs = note.endMs as number;
        const midi = note.targetMidi as number;
        const x = xForSongTime(startMs);
        const noteWidth = Math.max(3, xForSongTime(endMs) - x);
        const noteHeight = Math.max(4, semitoneHeight * 0.76);
        let noteColor = 'rgba(83, 139, 238, 0.68)';
        let noteEdge = 'rgba(61, 214, 226, 0.88)';
        if (note.kind === 'free') {
          noteColor = 'rgba(83, 139, 238, 0.25)';
          noteEdge = 'rgba(83, 139, 238, 0.42)';
        }
        const isPitchMatch =
          note.kind !== 'free' &&
          latestVoicedPoint !== undefined &&
          latestVoicedPoint.songTimeMs >= startMs &&
          latestVoicedPoint.songTimeMs <= endMs &&
          singerPitchMatchesTarget(
            latestVoicedPoint.midi,
            midi,
            octavePolicy,
            MATCH_TOLERANCE_SEMITONES,
          );
        const timingState = karaokeNoteTimingState(
          startMs,
          endMs,
          synchronizedPlayheadMs,
        );
        if (isPitchMatch) {
          noteColor = 'rgba(40, 242, 213, 0.96)';
          noteEdge = 'rgba(226, 255, 250, 1)';
        }
        const noteY = yForMidi(midi) - noteHeight / 2;
        const noteGradient = context.createLinearGradient(
          x,
          noteY,
          x + noteWidth,
          noteY,
        );
        noteGradient.addColorStop(0, noteEdge);
        noteGradient.addColorStop(0.35, noteColor);
        noteGradient.addColorStop(1, noteColor);
        context.fillStyle = noteGradient;
        context.shadowColor = isPitchMatch
          ? 'rgba(40, 242, 213, 0.98)'
          : noteEdge;
        context.shadowBlur = isPitchMatch ? 18 : 5;
        roundedRectPath(context, x, noteY, noteWidth, noteHeight);
        context.fill();
        context.shadowBlur = 0;

        if (timingState !== 'idle') {
          let timingBorder = 'rgba(34, 224, 214, 0.5)';
          let timingGlow = 3;
          if (timingState === 'active') {
            timingBorder = 'rgba(48, 145, 255, 1)';
            timingGlow = 10;
          }
          if (isPitchMatch) {
            timingBorder = 'rgba(226, 255, 250, 1)';
            timingGlow = 15;
          }
          context.strokeStyle = timingBorder;
          context.lineWidth = timingState === 'active' ? 2.2 : 1.35;
          context.setLineDash([]);
          context.shadowColor = timingBorder;
          context.shadowBlur = timingGlow;
          roundedRectPath(context, x, noteY, noteWidth, noteHeight);
          context.stroke();
          context.shadowBlur = 0;
        }

        const noteName = midiToNoteName(midi, targetHasAbsoluteOctaves);
        const labelX = Math.max(
          PLOT_LEFT + 8,
          Math.min(PLOT_LEFT + plotWidth - 8, x + noteWidth / 2),
        );
        context.font = '800 9px Arial, sans-serif';
        const labelWidth = context.measureText(noteName).width;
        const pitchRow = Math.round(midi);
        const previousLabelRight =
          floatingLabelRightByPitch.get(pitchRow) ?? -Infinity;
        const labelLeft = labelX - labelWidth / 2;
        if (labelLeft > previousLabelRight + 5) {
          const labelAbove = noteY - 4 >= PLOT_TOP + 9;
          context.textAlign = 'center';
          context.textBaseline = labelAbove ? 'bottom' : 'top';
          context.fillStyle = isPitchMatch
            ? 'rgba(226, 255, 250, 1)'
            : 'rgba(221, 233, 251, 0.9)';
          context.shadowColor = isPitchMatch
            ? 'rgba(40, 242, 213, 0.8)'
            : 'rgba(5, 14, 25, 0.95)';
          context.shadowBlur = isPitchMatch ? 8 : 3;
          context.fillText(
            noteName,
            labelX,
            labelAbove ? noteY - 3 : noteY + noteHeight + 3,
          );
          context.shadowBlur = 0;
          floatingLabelRightByPitch.set(pitchRow, labelX + labelWidth / 2);
        }
      });

      // Draw the normalized lead melody as one ideal, singer-like curve. It
      // sits over the note blocks and under the live microphone trace, so the
      // singer can aim for the guide and then watch their own curve cover it.
      const melodyGuide = buildKaraokeMelodyGuide(visibleNotes);
      if (melodyGuide.length > 1) {
        const guidePath = () => {
          context.beginPath();
          let previous:
            { x: number; y: number; startsPhrase: boolean } | undefined;
          melodyGuide.forEach((point) => {
            const plotted = {
              x: xForSongTime(point.songTimeMs),
              y: yForMidi(point.midi),
              startsPhrase: point.startsPhrase,
            };
            if (!previous || plotted.startsPhrase) {
              context.moveTo(plotted.x, plotted.y);
            } else {
              const controlX = (previous.x + plotted.x) / 2;
              context.bezierCurveTo(
                controlX,
                previous.y,
                controlX,
                plotted.y,
                plotted.x,
                plotted.y,
              );
            }
            previous = plotted;
          });
        };
        const guideGradient = context.createLinearGradient(
          PLOT_LEFT,
          0,
          PLOT_LEFT + plotWidth,
          0,
        );
        guideGradient.addColorStop(0, 'rgba(91, 147, 235, 0.34)');
        guideGradient.addColorStop(0.2, 'rgba(123, 195, 255, 0.82)');
        guideGradient.addColorStop(1, 'rgba(107, 233, 242, 0.76)');
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.setLineDash([]);
        context.strokeStyle = 'rgba(91, 182, 255, 0.2)';
        context.lineWidth = 6;
        context.shadowColor = 'rgba(73, 177, 255, 0.52)';
        context.shadowBlur = 10;
        guidePath();
        context.stroke();
        context.strokeStyle = guideGradient;
        context.lineWidth = 1.65;
        context.shadowBlur = 4;
        guidePath();
        context.stroke();
        context.shadowBlur = 0;

        const guideTargetMidi = targetAtTime(
          visibleNotes.filter((note) => note.kind !== 'free'),
          synchronizedPlayheadMs,
        );
        if (guideTargetMidi !== undefined) {
          const guideY = yForMidi(guideTargetMidi);
          const guideX = xForSongTime(synchronizedPlayheadMs);
          context.fillStyle = '#dff8ff';
          context.shadowColor = '#5fb8ff';
          context.shadowBlur = 12;
          context.beginPath();
          context.arc(guideX, guideY, 3, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
        }
      }

      // A visible zero line anchors the combined song-note/live-voice view.
      const baselineY = yForMidi(centerMidi);
      context.strokeStyle = isMicrophoneLive
        ? 'rgba(34, 224, 214, 0.2)'
        : 'rgba(167, 181, 205, 0.13)';
      context.lineWidth = 1.2;
      context.setLineDash([4, 5]);
      context.beginPath();
      context.moveTo(PLOT_LEFT, baselineY);
      context.lineTo(PLOT_LEFT + plotWidth, baselineY);
      context.stroke();
      context.setLineDash([]);

      const playheadX = xForSongTime(synchronizedPlayheadMs);
      context.strokeStyle = 'rgba(48, 145, 255, 0.92)';
      context.lineWidth = 2;
      context.shadowColor = 'rgba(48, 145, 255, 0.45)';
      context.shadowBlur = 8;
      context.beginPath();
      context.moveTo(playheadX, PLOT_TOP - 3);
      context.lineTo(playheadX, PLOT_TOP + plotHeight);
      context.stroke();
      context.fillStyle = '#3091ff';
      context.beginPath();
      context.arc(playheadX, PLOT_TOP, 3.5, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;

      if (trace.length > 0) {
        const xForTracePoint = (point: IKaraokePitchPoint) => {
          if (hasTargets) {
            return xForSongTime(point.songTimeMs);
          }
          return (
            PLOT_LEFT +
            (1 - (now - point.wallTimeMs) / LIVE_WINDOW_MS) * plotWidth
          );
        };
        const visualPitchSamples = trace.map((point) => ({
          // Providers already use canonical semitones. Their declared octave
          // policy decides whether a physical singer octave is projected onto
          // the target while preserving every real semitone error.
          midi: point.voiced
            ? projectSingerPitchToTarget(
                point.midi,
                target?.kind === 'notes'
                  ? (targetAtTime(target.notes, point.songTimeMs) ?? centerMidi)
                  : centerMidi,
                octavePolicy,
              )
            : centerMidi,
          timeMs: hasTargets ? point.songTimeMs : point.wallTimeMs,
          voiced: point.voiced,
        }));
        const easedMidis = easeKaraokeSingerTrace(
          visualPitchSamples,
          centerMidi,
        );
        const plottedTrace = trace.map((point, index) => ({
          ...point,
          x: xForTracePoint(point),
          y: yForMidi(easedMidis[index]),
        }));
        const first = plottedTrace[0];
        const last = plottedTrace[plottedTrace.length - 1];
        const previous = plottedTrace[plottedTrace.length - 2];
        const headColor = traceColor(
          last,
          previous,
          target?.kind === 'notes' ? target.notes : [],
          octavePolicy,
        );
        const tracePath = () => {
          context.beginPath();
          context.moveTo(first.x, first.y);
          for (let index = 1; index < plottedTrace.length - 1; index += 1) {
            const point = plottedTrace[index];
            const next = plottedTrace[index + 1];
            context.quadraticCurveTo(
              point.x,
              point.y,
              (point.x + next.x) / 2,
              (point.y + next.y) / 2,
            );
          }
          context.lineTo(last.x, last.y);
        };

        context.lineJoin = 'round';
        context.lineCap = 'round';

        // The microphone is one continuous pitch curve over the song blocks.
        // Input energy changes its glow; the presentation-only pitch easing
        // above calms detector wobble without changing scoring coordinates.
        const microphoneGradient = context.createLinearGradient(
          first.x,
          0,
          Math.max(first.x + 1, last.x),
          0,
        );
        const range = Math.max(1, last.x - first.x);
        plottedTrace.forEach((point, index) => {
          microphoneGradient.addColorStop(
            Math.max(0, Math.min(1, (point.x - first.x) / range)),
            traceColor(
              point,
              plottedTrace[index - 1],
              target?.kind === 'notes' ? target.notes : [],
              octavePolicy,
            ),
          );
        });
        context.globalAlpha = 0.22;
        context.strokeStyle = microphoneGradient;
        context.lineWidth = 6;
        context.shadowColor = headColor;
        context.shadowBlur = 8 + Math.min(12, last.energy * 22);
        tracePath();
        context.stroke();
        context.globalAlpha = Math.max(0.72, last.confidence);
        context.strokeStyle = microphoneGradient;
        context.lineWidth = 2.1;
        context.shadowBlur = 4 + Math.min(8, last.energy * 14);
        tracePath();
        context.stroke();
        context.globalAlpha = 1;
        context.shadowBlur = 0;

        const pulse = last.voiced ? 4.6 + Math.sin(now / 145) * 0.75 : 2.7;
        const aura = context.createRadialGradient(
          last.x,
          last.y,
          0,
          last.x,
          last.y,
          pulse * 2.8,
        );
        aura.addColorStop(0, last.voiced ? '#ffffff' : headColor);
        aura.addColorStop(0.22, headColor);
        aura.addColorStop(1, 'rgba(34, 224, 214, 0)');
        context.fillStyle = aura;
        context.beginPath();
        context.arc(last.x, last.y, pulse * 2.8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = last.voiced ? '#ffffff' : headColor;
        context.beginPath();
        context.arc(last.x, last.y, 1.8, 0, Math.PI * 2);
        context.fill();
      }

      if (target?.kind === 'notes') {
        const performanceDurationMs = target.notes.reduce(
          (duration, note) =>
            isTimedTarget(note) ? Math.max(duration, note.endMs) : duration,
          1,
        );
        const reviewLabel = t('karaoke.pitch.review');
        const reviewCount = t('karaoke.pitch.reviewCount', {
          count: performanceIssues.length,
        });
        const reviewY = height - 22;
        const reviewTrackHeight = 11;
        const reviewMinimumTrackWidth = Math.min(82, plotWidth * 0.42);
        const reviewFontSize = width < 620 ? 7.5 : 8;
        context.font = `760 ${reviewFontSize}px Inter, system-ui, sans-serif`;
        const measuredLabelWidth = Math.ceil(
          context.measureText(reviewLabel).width,
        );
        const measuredCountWidth = Math.ceil(
          context.measureText(reviewCount).width,
        );
        // Localized labels vary dramatically in length. Size both gutters from
        // the text that is actually drawn instead of letting a fixed English
        // width place the track underneath Spanish and other translations.
        let reviewLabelWidth = measuredLabelWidth + 22;
        let reviewCountWidth = measuredCountWidth + 12;
        if (
          reviewLabelWidth + reviewCountWidth + reviewMinimumTrackWidth >
          plotWidth
        ) {
          reviewCountWidth = 0;
        }
        reviewLabelWidth = Math.min(
          reviewLabelWidth,
          Math.max(0, plotWidth - reviewCountWidth - reviewMinimumTrackWidth),
        );
        if (reviewLabelWidth < 28) {
          reviewLabelWidth = 0;
        }
        const reviewTrackX = PLOT_LEFT + reviewLabelWidth;
        const reviewTrackWidth = Math.max(
          24,
          plotWidth - reviewLabelWidth - reviewCountWidth,
        );
        const reviewSurface = context.createLinearGradient(
          PLOT_LEFT,
          reviewY - 5,
          PLOT_LEFT + plotWidth,
          reviewY + reviewTrackHeight + 5,
        );
        reviewSurface.addColorStop(0, 'rgba(8, 22, 36, 0.82)');
        reviewSurface.addColorStop(0.55, 'rgba(5, 16, 28, 0.7)');
        reviewSurface.addColorStop(1, 'rgba(4, 12, 23, 0.58)');
        context.save();
        context.fillStyle = reviewSurface;
        context.shadowColor = 'rgba(0, 0, 0, 0.24)';
        context.shadowBlur = 8;
        roundedRectPath(
          context,
          PLOT_LEFT - 7,
          reviewY - 5,
          plotWidth + 14,
          reviewTrackHeight + 10,
          8,
        );
        context.fill();
        context.restore();

        context.textBaseline = 'middle';
        if (reviewLabelWidth > 0) {
          context.fillStyle = 'rgba(107, 233, 242, 0.78)';
          context.beginPath();
          context.arc(
            PLOT_LEFT + 3,
            reviewY + reviewTrackHeight / 2,
            2,
            0,
            2 * Math.PI,
          );
          context.fill();
          context.textAlign = 'left';
          context.fillStyle = 'rgba(187, 204, 229, 0.78)';
          context.fillText(
            reviewLabel,
            PLOT_LEFT + 10,
            reviewY + reviewTrackHeight / 2,
            Math.max(1, reviewLabelWidth - 16),
          );
        }

        const trackGradient = context.createLinearGradient(
          reviewTrackX,
          reviewY,
          reviewTrackX,
          reviewY + reviewTrackHeight,
        );
        trackGradient.addColorStop(0, 'rgba(1, 7, 14, 0.9)');
        trackGradient.addColorStop(1, 'rgba(11, 30, 45, 0.88)');
        context.fillStyle = trackGradient;
        context.strokeStyle = 'rgba(107, 233, 242, 0.13)';
        context.lineWidth = 1;
        roundedRectPath(
          context,
          reviewTrackX,
          reviewY,
          reviewTrackWidth,
          reviewTrackHeight,
        );
        context.fill();
        context.stroke();

        performanceIssues.forEach((issue) => {
          const issueStart = Math.max(
            0,
            Math.min(1, issue.startMs / performanceDurationMs),
          );
          const issueEnd = Math.max(
            issueStart,
            Math.min(1, issue.endMs / performanceDurationMs),
          );
          const issueLeft = reviewTrackX + issueStart * reviewTrackWidth;
          const issueRight = reviewTrackX + issueEnd * reviewTrackWidth;
          const issueWidth = Math.max(3, issueRight - issueLeft);
          const isHovered = hoveredIssueIdRef.current === issue.id;
          let issueColor = '#f0a64a';
          if (issue.kind === 'high') {
            issueColor = '#9be348';
          } else if (issue.kind === 'low') {
            issueColor = '#ff655d';
          }
          context.fillStyle = issueColor;
          context.globalAlpha = isHovered ? 1 : 0.88;
          context.shadowColor = issueColor;
          context.shadowBlur = isHovered ? 10 : 5;
          roundedRectPath(
            context,
            issueLeft,
            reviewY + 2,
            issueWidth,
            reviewTrackHeight - 4,
          );
          context.fill();
          context.globalAlpha = 1;
          context.shadowBlur = 0;
          issueHitRegionsRef.current.push({
            issue,
            left: issueLeft - 2,
            right: issueLeft + issueWidth + 2,
            top: reviewY - 4,
            bottom: reviewY + reviewTrackHeight + 4,
          });
        });

        const reviewPlayheadX =
          reviewTrackX +
          Math.max(
            0,
            Math.min(1, synchronizedPlayheadMs / performanceDurationMs),
          ) *
            reviewTrackWidth;
        context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        context.shadowColor = 'rgba(48, 145, 255, 0.9)';
        context.shadowBlur = 5;
        context.beginPath();
        context.moveTo(reviewPlayheadX, reviewY - 2);
        context.lineTo(reviewPlayheadX, reviewY + reviewTrackHeight + 2);
        context.stroke();
        context.shadowBlur = 0;
        if (reviewCountWidth > 0) {
          context.textAlign = 'right';
          context.fillStyle = 'rgba(175, 189, 214, 0.74)';
          context.fillText(
            reviewCount,
            PLOT_LEFT + plotWidth - 3,
            reviewY + reviewTrackHeight / 2,
            Math.max(1, reviewCountWidth - 8),
          );
        }
      }

      if (hasTargets && width >= 560 && plotHeight >= 86) {
        const legendItems = [
          ['guide', t('karaoke.pitch.guide'), '#8fc8ff'],
          ['↑', t('karaoke.pitch.high'), '#9be348'],
          ['—', t('karaoke.pitch.tuned'), '#f2d04f'],
          ['↓', t('karaoke.pitch.low'), '#ff655d'],
        ] as const;
        const legendWidth = 132;
        const legendHeight = 72;
        const legendX = PLOT_LEFT + plotWidth - legendWidth - 11;
        const legendY = PLOT_TOP + plotHeight - legendHeight - 10;
        const legendSurface = context.createLinearGradient(
          legendX,
          legendY,
          legendX + legendWidth,
          legendY + legendHeight,
        );
        legendSurface.addColorStop(0, 'rgba(18, 39, 55, 0.93)');
        legendSurface.addColorStop(0.58, 'rgba(8, 22, 35, 0.94)');
        legendSurface.addColorStop(1, 'rgba(5, 14, 25, 0.96)');
        context.save();
        context.fillStyle = legendSurface;
        context.shadowColor = 'rgba(0, 0, 0, 0.38)';
        context.shadowBlur = 15;
        context.shadowOffsetY = 6;
        roundedRectPath(
          context,
          legendX,
          legendY,
          legendWidth,
          legendHeight,
          9,
        );
        context.fill();
        context.restore();
        context.strokeStyle = 'rgba(107, 233, 242, 0.16)';
        context.lineWidth = 1;
        roundedRectPath(
          context,
          legendX,
          legendY,
          legendWidth,
          legendHeight,
          9,
        );
        context.stroke();

        // A fine highlight makes the card read as part of the glass UI without
        // outlining every side in bright cyan.
        const legendHighlight = context.createLinearGradient(
          legendX + 9,
          0,
          legendX + legendWidth - 9,
          0,
        );
        legendHighlight.addColorStop(0, 'rgba(107, 233, 242, 0)');
        legendHighlight.addColorStop(0.5, 'rgba(107, 233, 242, 0.32)');
        legendHighlight.addColorStop(1, 'rgba(107, 233, 242, 0)');
        context.strokeStyle = legendHighlight;
        context.beginPath();
        context.moveTo(legendX + 9, legendY + 0.5);
        context.lineTo(legendX + legendWidth - 9, legendY + 0.5);
        context.stroke();

        context.font = '720 8.5px Inter, system-ui, sans-serif';
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        legendItems.forEach(([symbol, label, color], index) => {
          const y = legendY + 13 + index * 15;
          const swatchX = legendX + 13;
          context.fillStyle = color;
          context.strokeStyle = color;
          context.shadowColor = color;
          context.shadowBlur = 4;
          if (symbol === 'guide') {
            context.lineWidth = 1.6;
            context.lineCap = 'round';
            context.beginPath();
            context.moveTo(swatchX, y + 1);
            context.bezierCurveTo(
              swatchX + 3,
              y - 3,
              swatchX + 7,
              y + 3,
              swatchX + 12,
              y - 1,
            );
            context.stroke();
          } else {
            context.font = '820 9px Inter, system-ui, sans-serif';
            context.fillText(symbol, swatchX + 1, y);
          }
          context.shadowBlur = 0;
          context.font = '720 8.5px Inter, system-ui, sans-serif';
          context.fillStyle = 'rgba(222, 232, 247, 0.9)';
          context.fillText(label, legendX + 34, y, legendWidth - 45);
        });
      }
    };

    const animate = () => {
      draw();
      animationFrame = requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [
    hasTargets,
    isActive,
    isMicrophoneLive,
    isPlaying,
    pitch,
    playheadMs,
    performanceIssues,
    readPlayheadMs,
    target,
    t,
  ]);

  let readout = t('karaoke.pitch.micOff');
  if (analysisStatus === 'loading') {
    readout = t('karaoke.pitch.loading');
  } else if (analysisStatus === 'unsupported' || analysisStatus === 'error') {
    readout = t('karaoke.pitch.unavailable');
  } else if (analysisStatus === 'ready') {
    readout = pitch ? '' : t('karaoke.pitch.noSignal');
  }

  const footerKey: TranslationKey = hasTargets
    ? 'karaoke.pitch.waveFooter'
    : 'karaoke.pitch.empty';

  const issueAtCanvasPoint = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
  ): IKaraokePitchIssue | undefined => {
    const bounds = canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    return issueHitRegionsRef.current.find(
      (region) =>
        x >= region.left &&
        x <= region.right &&
        y >= region.top &&
        y <= region.bottom,
    )?.issue;
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const scrub = scrubStateRef.current;
    if (scrub && scrub.pointerId === event.pointerId) {
      const deltaX = event.clientX - scrub.startX;
      if (!scrub.moved && Math.abs(deltaX) >= 4) {
        scrub.moved = true;
        setIsScrubbing(true);
        hoveredIssueIdRef.current = undefined;
        event.currentTarget.title = '';
        onScrubStart?.();
      }
      if (scrub.moved) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const nextTimeMs = karaokePitchScrubTime(
          scrub.startTimeMs,
          deltaX,
          Math.max(1, bounds.width - PLOT_LEFT - PLOT_RIGHT),
          durationMs,
        );
        scrub.lastTimeMs = nextTimeMs;
        event.currentTarget.style.cursor = 'grabbing';
        onScrub?.(nextTimeMs);
        event.preventDefault();
        return;
      }
    }

    const issue = issueAtCanvasPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    hoveredIssueIdRef.current = issue?.id;
    let cursor = canScrub ? 'grab' : 'default';
    let title = canScrub ? t('karaoke.pitch.scrubHint') : '';
    if (issue && onPracticeIssue) {
      cursor = 'pointer';
      title = t(ISSUE_KEYS[issue.kind], {
        time: formatKaraokeTime(issue.startMs),
      });
    }
    event.currentTarget.style.cursor = cursor;
    event.currentTarget.title = title;
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canScrub || event.button !== 0) {
      return;
    }
    const directPlayheadMs = readPlayheadMs?.();
    const startTimeMs = Number.isFinite(directPlayheadMs)
      ? (directPlayheadMs as number)
      : playheadMs;
    scrubStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startTimeMs,
      lastTimeMs: startTimeMs,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const finishCanvasScrub = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const scrub = scrubStateRef.current;
    if (!scrub || scrub.pointerId !== event.pointerId) {
      return;
    }
    scrubStateRef.current = undefined;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!scrub.moved) {
      return;
    }
    setIsScrubbing(false);
    suppressCanvasClickRef.current = true;
    window.setTimeout(() => {
      suppressCanvasClickRef.current = false;
    }, 0);
    event.currentTarget.style.cursor = 'grab';
    event.currentTarget.title = t('karaoke.pitch.scrubHint');
    onScrubEnd?.(scrub.lastTimeMs);
    event.preventDefault();
  };

  const onCanvasClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }
    const issue = issueAtCanvasPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    if (issue) {
      onPracticeIssue?.(issue);
    }
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (canScrub && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const nextTimeMs = clamp(playheadMs + direction * 1_000, 0, durationMs);
      onScrubStart?.();
      onScrub?.(nextTimeMs);
      onScrubEnd?.(nextTimeMs);
      return;
    }
    if (
      !onPracticeIssue ||
      !performanceIssues.length ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return;
    }
    event.preventDefault();
    const issue =
      performanceIssues.find(
        (candidate) =>
          candidate.startMs <= playheadMs && candidate.endMs >= playheadMs,
      ) ??
      performanceIssues.find((candidate) => candidate.startMs > playheadMs) ??
      performanceIssues[0];
    onPracticeIssue(issue);
  };

  return (
    <article
      className={`karaoke-pitch is-curve${hasTargets ? ' has-targets' : ''}${
        isMicrophoneLive ? ' is-microphone-live' : ''
      }${melodyToneEnabled ? ' is-melody-tone-enabled' : ''}`}
      aria-labelledby="karaoke-pitch-title"
    >
      <header className="karaoke-pitch__header">
        <div className="karaoke-pitch__title">
          <h3 id="karaoke-pitch-title">{t('karaoke.pitch.title')}</h3>
          {target?.kind === 'notes' && <span>{target.source}</span>}
        </div>
        <div className="karaoke-pitch__header-actions">
          {hasTargets && onToggleMelodyTone && (
            <div
              className={`karaoke-pitch__tone-guide${
                melodyToneEnabled ? ' is-enabled' : ''
              }`}
              role="group"
              aria-label={t('karaoke.pitch.toneGuide')}
            >
              <button
                type="button"
                className="button small subtle karaoke-pitch__tone-toggle"
                onClick={onToggleMelodyTone}
                disabled={!melodyToneAvailable}
                aria-disabled={!melodyToneAvailable}
                aria-pressed={melodyToneEnabled}
                aria-label={t(
                  melodyToneEnabled
                    ? 'karaoke.pitch.toneDisable'
                    : 'karaoke.pitch.toneEnable',
                )}
                title={t(
                  melodyToneEnabled
                    ? 'karaoke.pitch.toneDisable'
                    : 'karaoke.pitch.toneEnable',
                )}
              >
                <MenuIcon name="waveform" className="karaoke-button__icon" />
                <span>{t('karaoke.pitch.toneGuide')}</span>
              </button>
              {melodyToneEnabled && onMelodyToneVolume && (
                <label
                  className="karaoke-pitch__tone-volume"
                  htmlFor={melodyToneVolumeId}
                  title={`${t('karaoke.pitch.toneVolume')} · ${Math.round(
                    melodyToneVolume * 100,
                  )}%`}
                >
                  <input
                    id={melodyToneVolumeId}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={melodyToneVolume}
                    aria-label={t('karaoke.pitch.toneVolume')}
                    aria-valuetext={`${Math.round(melodyToneVolume * 100)}%`}
                    style={
                      {
                        '--karaoke-tone-volume': `${Math.round(
                          melodyToneVolume * 100,
                        )}%`,
                      } as CSSProperties
                    }
                    onChange={(event) =>
                      onMelodyToneVolume(Number(event.target.value))
                    }
                  />
                </label>
              )}
            </div>
          )}
          <div className="karaoke-pitch__readout" aria-live="polite">
            {pitch && analysisStatus === 'ready' ? (
              <>
                <strong>{pitch.note}</strong>
                <span>
                  {pitch.cents >= 0 ? '+' : ''}
                  {pitch.cents} ¢ · {pitch.frequencyHz.toFixed(1)} Hz
                </span>
              </>
            ) : (
              <span>{readout}</span>
            )}
          </div>
          {onToggleMicrophone && (
            <button
              type="button"
              className={`button small subtle karaoke-pitch__mic-toggle${
                isMicrophoneLive ? ' is-live' : ''
              }`}
              onClick={onToggleMicrophone}
              disabled={isMicrophoneBusy || isMicrophoneUnavailable}
              aria-disabled={isMicrophoneBusy || isMicrophoneUnavailable}
              aria-pressed={isMicrophoneLive}
              aria-label={t(
                isMicrophoneLive ? 'karaoke.mic.turnOff' : 'karaoke.mic.turnOn',
              )}
              title={t(
                isMicrophoneLive ? 'karaoke.mic.turnOff' : 'karaoke.mic.turnOn',
              )}
            >
              <MenuIcon name="microphone" className="karaoke-button__icon" />
              <span>
                {t(isMicrophoneLive ? 'karaoke.mic.live' : 'karaoke.mic.off')}
              </span>
            </button>
          )}
        </div>
      </header>

      <div className="karaoke-pitch__canvas">
        <canvas
          ref={canvasRef}
          className={`${canScrub ? 'is-scrubbable' : ''}${
            isScrubbing ? ' is-scrubbing' : ''
          }`}
          role="button"
          aria-label={t(
            hasTargets ? 'karaoke.pitch.waveCanvas' : 'karaoke.pitch.canvas',
          )}
          aria-disabled={
            !canScrub && (!performanceIssues.length || !onPracticeIssue)
          }
          tabIndex={
            canScrub || (performanceIssues.length && onPracticeIssue) ? 0 : -1
          }
          title={canScrub ? t('karaoke.pitch.scrubHint') : undefined}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={finishCanvasScrub}
          onPointerCancel={finishCanvasScrub}
          onPointerLeave={(event) => {
            if (scrubStateRef.current?.moved) {
              return;
            }
            hoveredIssueIdRef.current = undefined;
            event.currentTarget.style.cursor = canScrub ? 'grab' : 'default';
            event.currentTarget.title = canScrub
              ? t('karaoke.pitch.scrubHint')
              : '';
          }}
          onClick={onCanvasClick}
          onKeyDown={onCanvasKeyDown}
        />
      </div>
      <footer className="karaoke-pitch__footer">
        <span>{t(footerKey)}</span>
      </footer>
    </article>
  );
};

export default KaraokePitchLane;
