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
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
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
} from '../../common/karaoke/pitch';
import { TKaraokePitchTarget } from '../../common/karaoke/types';
import MenuIcon from '../icons/MenuIcon';
import observeShown from '../utils/observeShown';
import {
  IKaraokePitchIssue,
  IKaraokePitchPoint,
  ISSUE_KEYS,
  LIVE_WINDOW_MS,
  MATCH_FRESHNESS_MS,
  MINIMUM_VISIBLE_SEMITONES,
  PERFORMANCE_BUCKET_MS,
  PERFORMANCE_ISSUE_REFRESH_MS,
  PITCH_LABEL_CLEARANCE_PX,
  PLOT_LEFT,
  PLOT_RIGHT,
  TRACE_HISTORY_MS,
  VIEWPORT_PADDING_SEMITONES,
  WINDOW_FUTURE_MS,
  WINDOW_PAST_MS,
  isTimedTarget,
  buildKaraokeMelodyGuide,
  clamp,
  findKaraokePitchIssues,
  groupKaraokePitchWords,
  karaokePitchScrubTime,
  karaokePitchSongTimeX,
  karaokeTraceBehindPlayhead,
  pitchLaneLayout,
} from './karaokePitchGeometry';
import { useTranslation } from '../utils/I18nContext';
import {
  IKaraokeLivePitch,
  TKaraokeMicrophoneStatus,
  TKaraokePitchAnalysisStatus,
} from './useKaraokeMicrophone';
import { readTextInk, readAccent } from '../utils/theme';
import {
  LANE_FONT,
  paintLegend,
  paintMelodyGuide,
  paintNoteBlocks,
  paintPitchGrid,
  paintReview,
  paintTrace,
  paintWords,
} from './pitchLaneLayers';

interface IKaraokePitchLaneProps {
  isActive: boolean;
  isPlaying?: boolean;
  pitch?: IKaraokeLivePitch;
  analysisStatus: TKaraokePitchAnalysisStatus;
  target?: TKaraokePitchTarget;
  /** The song's clock where there is no `readPlayheadMs` to ask instead. */
  playheadMs?: number;
  durationMs?: number;
  readPlayheadMs?: () => number;
  microphoneStatus?: TKaraokeMicrophoneStatus;
  onToggleMicrophone?: () => void;
  onPracticeIssue?: (issue: IKaraokePitchIssue) => void;
  onScrubStart?: () => void;
  onScrub?: (timeMs: number) => void;
  onScrubEnd?: (timeMs: number) => void;
}

interface IKaraokePitchViewportState {
  viewport: IKaraokePitchViewport;
  frameTimeMs: number;
}

export interface IKaraokeIssueHitRegion {
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

const KaraokePitchLane = ({
  isActive,
  isPlaying = false,
  pitch,
  analysisStatus,
  target,
  playheadMs = 0,
  durationMs = 0,
  readPlayheadMs,
  microphoneStatus = 'off',
  onToggleMicrophone,
  onPracticeIssue,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: IKaraokePitchLaneProps) => {
  const { t } = useTranslation();
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
  /**
   * The click that ends a scrub, which is not a click on what it lands on.
   *
   * A press that moved is a drag, and the `click` the pointer's release sends
   * after it would otherwise practise whatever issue the drag ended over. Set
   * by the release and spent by that click; a new press clears it, because
   * whatever click comes after that press belongs to it. It was cleared by a
   * zero-delay timer, which relied on the click being dispatched in the same
   * task as the release — true, but a guess about the browser rather than a
   * reading of the events themselves.
   */
  const suppressCanvasClickRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [performanceIssues, setPerformanceIssues] = useState<
    IKaraokePitchIssue[]
  >([]);
  const hasTargets = target?.kind === 'notes';
  // A loaded song is the only thing that gives this lane a cursor. Without one
  // it is a bare microphone monitor: there is no playhead, no ruler, and
  // nothing for the trace to trail behind.
  const hasSongClock = durationMs > 0;
  const isMicrophoneLive = microphoneStatus === 'live';
  const isMicrophoneBusy = microphoneStatus === 'requesting';
  const isMicrophoneUnavailable = microphoneStatus === 'unavailable';
  const canScrub = durationMs > 0 && Boolean(onScrub);
  // Read by the frame loop, never listed as what it depends on. The pitch
  // changes about twenty-one times a second and the playhead twenty, and as
  // dependencies each change tore the loop and its ResizeObserver down and
  // built them again; the review below changes while somebody sings as well,
  // and a reader handed over as a fresh function each render would do the
  // same on every pitch.
  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;
  const playheadMsRef = useRef(playheadMs);
  playheadMsRef.current = playheadMs;
  const readPlayheadMsRef = useRef(readPlayheadMs);
  readPlayheadMsRef.current = readPlayheadMs;
  const performanceIssuesRef = useRef(performanceIssues);
  performanceIssuesRef.current = performanceIssues;

  /** The media element's own clock where there is one; the prop otherwise. */
  const readSongTimeMs = useCallback((): number => {
    const directPlayheadMs = readPlayheadMsRef.current?.();
    return directPlayheadMs !== undefined && Number.isFinite(directPlayheadMs)
      ? directPlayheadMs
      : playheadMsRef.current;
  }, []);

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

    let animationFrame: number | undefined;
    // 30ms, down from 45. The curve is drawn through the points this
    // produces, so the sampling interval is the resolution of the line
    // itself — at 45ms it was twenty-two points a second and a fast run
    // between notes came out as visible corners no amount of easing could
    // round off. The detector already publishes faster than either rate, so
    // this is throwing away less rather than asking for more.
    const recordSinger = (
      now: number,
      synchronizedPlayheadMs: number,
      centerMidi: number,
    ) => {
      if (!isMicrophoneLive || now - lastTraceSampleRef.current < 30) {
        return;
      }
      const currentPitch = pitchRef.current;
      const lastVoiced = [...traceRef.current]
        .reverse()
        .find((point) => point.voiced);
      const heldMidi =
        lastVoiced && now - lastVoiced.wallTimeMs < 320
          ? lastVoiced.midi
          : centerMidi;
      const sample: IKaraokePitchPoint = {
        midi: currentPitch?.midi ?? heldMidi,
        songTimeMs: synchronizedPlayheadMs,
        wallTimeMs: now,
        energy: currentPitch?.rms ?? 0,
        confidence: currentPitch?.confidence ?? 0.25,
        voiced: Boolean(currentPitch),
      };
      traceRef.current.push(sample);
      traceRef.current = traceRef.current
        .filter((point) => now - point.wallTimeMs <= LIVE_WINDOW_MS + 1_000)
        // Sized from the window above rather than left at a round number.
        // It was 180, which held nine seconds at the old 45ms interval and
        // only five and a half at 30ms — the cap, not the time filter beside
        // it, would have decided how much trace survived, and the tail of
        // the curve would have started disappearing while still on screen.
        .slice(-Math.ceil((LIVE_WINDOW_MS + 1_000) / 30));
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
    };

    const draw = () => {
      const currentPitch = pitchRef.current;
      const currentIssues = performanceIssuesRef.current;
      const textInk = readTextInk();
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

      // Nothing painted under the drawing: the canvas's box is the plot well
      // (`.karaoke-pitch__canvas`, `$surface-plot`), the colour every other
      // drawing in the app lies on. It was filled with the pane colour
      // here, whatever the comment said — a pale slab in the middle of the
      // card, the lightest thing on the page (Ivan, 2026-09-27: "fix pitch
      // lane bg color"). Before that it was a ramp of near-black blues.

      const plotWidth = Math.max(1, width - PLOT_LEFT - PLOT_RIGHT);
      const { plotTop, plotBottom, wordLanes, showsReview } = pitchLaneLayout(
        height,
        hasTargets,
      );
      const plotHeight = Math.max(1, height - plotTop - plotBottom);
      const now = performance.now();
      const synchronizedPlayheadMs = readSongTimeMs();
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
        currentPitch?.midi ?? KARAOKE_CANONICAL_CENTER_MIDI,
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
        plotTop + (topMidi - midi) * semitoneHeight;
      const xForSongTime = (timeMs: number) =>
        karaokePitchSongTimeX(timeMs, synchronizedPlayheadMs, plotWidth);

      // Keep a stable lane derived from the word's global index. Words then
      // glide horizontally with the song clock without jumping vertically as
      // neighboring words enter or leave the visible time window.
      const allWords =
        target?.kind === 'notes' ? groupKaraokePitchWords(target.notes) : [];
      // None at all when the lane is too short to give them a row; the lyrics
      // above the lane are showing the same words.
      const visibleWords =
        wordLanes > 0
          ? allWords
              .map((word, wordIndex) => ({ word, wordIndex }))
              .filter(
                ({ word }) =>
                  word.endMs >= windowStartMs && word.startMs <= windowEndMs,
              )
          : [];
      const wordLayout = visibleWords.map(({ word, wordIndex }) => {
        const noteLeft = Math.max(PLOT_LEFT, xForSongTime(word.startMs));
        const noteRight = Math.min(
          PLOT_LEFT + plotWidth,
          xForSongTime(word.endMs),
        );
        const centerMs = (word.startMs + word.endMs) / 2;
        const previousLaneWord = allWords[wordIndex - wordLanes];
        const nextLaneWord = allWords[wordIndex + wordLanes];
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
          lane: wordIndex % wordLanes,
          noteLeft,
          noteRight,
          center: xForSongTime(centerMs),
          slotLeft: Math.max(PLOT_LEFT, xForSongTime(slotStartMs)),
          slotRight: Math.min(PLOT_LEFT + plotWidth, xForSongTime(slotEndMs)),
        };
      });
      paintWords({
        wordLayout,
        synchronizedPlayheadMs,
        context,
        plotWidth,
        plotTop,
        textInk,
      });

      context.font = `600 11px ${LANE_FONT}`;
      context.textBaseline = 'middle';
      context.textAlign = 'right';
      const bottomMidi = centerMidi - semitoneSpan / 2;
      const tickStep = semitoneSpan > 48 ? 12 : 6;
      // Labels step up an octave at a time until they clear each other, so a
      // lane squeezed by a short window names fewer notes instead of printing
      // five on one line. The zero is what the singer is measured against and
      // is always a multiple of the step, so it always keeps its label. A line
      // packed tighter than its own width is taken away with its label.
      let labelStep = tickStep;
      while (
        labelStep * semitoneHeight < PITCH_LABEL_CLEARANCE_PX &&
        labelStep < semitoneSpan
      ) {
        labelStep *= 2;
      }
      const lineStep = tickStep * semitoneHeight >= 4 ? tickStep : labelStep;
      // Counted from the zero rather than from MIDI 0. The two agree for 6 and
      // 12, the zero being a C; a 24-semitone step from MIDI 0 would miss it.
      const firstPitchTick =
        KARAOKE_CANONICAL_CENTER_MIDI +
        Math.ceil((bottomMidi - KARAOKE_CANONICAL_CENTER_MIDI) / lineStep) *
          lineStep;
      const topPitchTick = centerMidi + semitoneSpan / 2;
      paintPitchGrid({
        firstPitchTick,
        topPitchTick,
        lineStep,
        labelStep,
        yForMidi,
        context,
        targetHasAbsoluteOctaves,
        plotWidth,
      });

      // A second ruler belongs to a song. Drawn with no song loaded it counted
      // out the first seconds of a track that was never opened, under a cursor
      // for a playhead that could not move.
      if (hasSongClock) {
        const firstTickMs = Math.ceil(windowStartMs / 1_000) * 1_000;
        context.textAlign = 'center';
        context.textBaseline = 'bottom';
        for (let tickMs = firstTickMs; tickMs <= windowEndMs; tickMs += 1_000) {
          const x = xForSongTime(tickMs);
          context.strokeStyle = 'rgba(225, 231, 244, 0.055)';
          context.beginPath();
          context.moveTo(x, plotTop);
          context.lineTo(x, plotTop + plotHeight);
          context.stroke();
          context.fillStyle = textInk;
          context.fillText(
            formatKaraokeTime(tickMs),
            x,
            plotTop + plotHeight + 15,
          );
        }
      }

      recordSinger(now, synchronizedPlayheadMs, centerMidi);
      // Only as far back as the lane can actually show. With the trace trailing
      // the cursor rather than the right-hand edge, the visible past is the
      // 1.6 seconds behind the playhead; keeping six seconds of it meant three
      // quarters of every frame's curve was drawn off the left of the plot.
      const traceHistoryMs = hasSongClock ? WINDOW_PAST_MS : TRACE_HISTORY_MS;
      const liveTrace = traceRef.current.filter((point) =>
        hasTargets
          ? point.songTimeMs >= windowStartMs &&
            point.songTimeMs <= synchronizedPlayheadMs
          : now - point.wallTimeMs <= traceHistoryMs,
      );
      const trace = hasTargets
        ? karaokeTraceBehindPlayhead(
            Array.from(performanceTraceRef.current.values()),
            windowStartMs,
            synchronizedPlayheadMs,
          )
        : liveTrace;
      const latestVoicedPoint = [...liveTrace]
        .reverse()
        .find(
          (point) =>
            point.voiced && now - point.wallTimeMs <= MATCH_FRESHNESS_MS,
        );

      const floatingLabelRightByPitch = new Map<number, number>();
      paintNoteBlocks({
        visibleNotes,
        xForSongTime,
        semitoneHeight,
        latestVoicedPoint,
        octavePolicy,
        synchronizedPlayheadMs,
        yForMidi,
        context,
        targetHasAbsoluteOctaves,
        plotWidth,
        floatingLabelRightByPitch,
        plotHeight,
        plotTop,
      });

      // Draw the normalized lead melody as one ideal, singer-like curve. It
      // sits over the note blocks and under the live microphone trace, so the
      // singer can aim for the guide and then watch their own curve cover it.
      const melodyGuide = buildKaraokeMelodyGuide(visibleNotes);
      paintMelodyGuide({
        melodyGuide,
        context,
        xForSongTime,
        yForMidi,
        plotWidth,
        visibleNotes,
        synchronizedPlayheadMs,
      });

      // A visible zero line anchors the combined song-note/live-voice view.
      const baselineY = yForMidi(centerMidi);
      context.strokeStyle = isMicrophoneLive
        ? readAccent(0.2, 'rgba(34, 224, 214, 0.2)')
        : 'rgba(167, 181, 205, 0.13)';
      context.lineWidth = 1.2;
      context.setLineDash([4, 5]);
      context.beginPath();
      context.moveTo(PLOT_LEFT, baselineY);
      context.lineTo(PLOT_LEFT + plotWidth, baselineY);
      context.stroke();
      context.setLineDash([]);

      const playheadX = xForSongTime(synchronizedPlayheadMs);
      if (hasSongClock) {
        context.strokeStyle = 'rgba(48, 145, 255, 0.92)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(playheadX, plotTop - 3);
        context.lineTo(playheadX, plotTop + plotHeight);
        context.stroke();
        context.fillStyle = '#3091ff';
        context.beginPath();
        context.arc(playheadX, plotTop, 3.5, 0, Math.PI * 2);
        context.fill();
      }

      paintTrace({
        trace,
        synchronizedPlayheadMs,
        now,
        plotWidth,
        hasSongClock,
        hasTargets,
        visibleNotes,
        centerMidi,
        octavePolicy,
        yForMidi,
        context,
        plotTop,
        plotHeight,
      });

      paintReview({
        target,
        showsReview,
        t,
        currentIssues,
        height,
        plotWidth,
        width,
        context,
        textInk,
        hoveredIssueIdRef,
        issueHitRegionsRef,
        synchronizedPlayheadMs,
      });

      paintLegend({
        hasTargets,
        width,
        plotHeight,
        t,
        plotWidth,
        plotTop,
        context,
      });
    };

    const animate = () => {
      draw();
      animationFrame = requestAnimationFrame(animate);
    };
    // Unseen, the lane still listens. What is sung under the amp reaches the
    // review as it did while every hidden frame was painted; only the
    // painting stops.
    const listen = () => {
      recordSinger(
        performance.now(),
        readSongTimeMs(),
        viewportRef.current?.viewport.centerMidi ??
          KARAOKE_CANONICAL_CENTER_MIDI,
      );
      animationFrame = requestAnimationFrame(listen);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    // Painted only while it can be seen. Mounted is not seen: the amp hides
    // the whole app with `display: none` and the lane stayed mounted under
    // it, redrawing every frame for nobody for as long as the amp was up.
    const stopWatching = observeShown(canvas, (shown) => {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
      if (shown) {
        animationFrame = requestAnimationFrame(animate);
      } else if (isMicrophoneLive) {
        animationFrame = requestAnimationFrame(listen);
      }
    });
    return () => {
      stopWatching();
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
      observer.disconnect();
    };
  }, [
    hasSongClock,
    hasTargets,
    isActive,
    isMicrophoneLive,
    isPlaying,
    readSongTimeMs,
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
    suppressCanvasClickRef.current = false;
    if (!canScrub || event.button !== 0) {
      return;
    }
    const startTimeMs = readSongTimeMs();
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
    // A cancelled pointer sends no click, so there is nothing to swallow.
    suppressCanvasClickRef.current = event.type === 'pointerup';
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
    const songTimeMs = readSongTimeMs();
    if (canScrub && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const nextTimeMs = clamp(songTimeMs + direction * 1_000, 0, durationMs);
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
          candidate.startMs <= songTimeMs && candidate.endMs >= songTimeMs,
      ) ??
      performanceIssues.find((candidate) => candidate.startMs > songTimeMs) ??
      performanceIssues[0];
    onPracticeIssue(issue);
  };

  return (
    <article
      className={`karaoke-pitch is-curve${hasTargets ? ' has-targets' : ''}${
        isMicrophoneLive ? ' is-microphone-live' : ''
      }`}
      aria-labelledby="karaoke-pitch-title"
    >
      <header className="karaoke-pitch__header">
        <div className="karaoke-pitch__title">
          <h3 id="karaoke-pitch-title">{t('karaoke.pitch.title')}</h3>
          {target?.kind === 'notes' && <span>{target.source}</span>}
        </div>
        <div className="karaoke-pitch__header-actions">
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
