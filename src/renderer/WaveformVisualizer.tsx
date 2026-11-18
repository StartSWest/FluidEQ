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

/**
 * The titlebar's live output meter, drawn on a canvas rather than as SVG paths.
 *
 * WHY THIS IS NOT A PATH ANY MORE. Three `d` attributes were rewritten on every
 * drawn frame, and a `d` is not a cheap assignment: it invalidates style,
 * re-parses the whole string, re-lays-out the figure and re-rasterises the
 * region, and all four stages run again on the next frame. The meter draws at
 * thirty ordinarily and — this is the part that matters — at the display's full
 * rate in the window's colourful look, which is always on. A canvas draw is a resource update instead: the pixels are
 * replaced and nothing else in the document has an opinion about it.
 *
 * HOW IT IS DRAWN. Every style is painted flat at the pane's real size by
 * `waveformFlatPaint.ts` (Ivan, 2026-11-16: the eleven styles redrawn flat and
 * ten added), with what the styles remember between frames — held peaks, the
 * last moments, the two channels — in `waveformFlatState.ts`. How a block is
 * scaled to the pane, and when silence becomes the flat line, is
 * `waveformGate.ts`.
 *
 * WHAT STAYS IN THE DOM. The pane, the labels and the held peak. Those are text and controls; they change when the audio changes *state*
 * rather than when it moves, and they have to be hit-tested and read aloud.
 *
 * WHERE THE STYLESHEET WENT. A canvas has no cascade to appeal to, so every
 * rule that used to paint a path — the ramps, the per-style fills, the paused
 * and clipping treatments, the euphoria halo — is resolved in the frame loop
 * below and the stylesheet keeps only what is still a box.
 */

import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { easeTowards, getEaseFactor } from 'common/smoothing';
import { WAVEFORM_STYLES, WaveformStyle } from 'common/waveformStyles';
import {
  CLIP_STROKE,
  PAUSED_STROKE,
  PEAK_RELEASE_DB,
  SILENCE_DB,
  advanceSpectrumBars,
  SPECTRUM_BAR_ATTACK_MS,
  SPECTRUM_BAR_RELEASE_MS,
  WAVEFORM_BLEED,
  WAVEFORM_STYLE_KEY,
  peakDbOf,
} from './waveformPaint';
import { type IWaveGate, createWaveGate } from './waveformGate';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
  useLiveAudioFrameListener,
  useLiveAudioFrames,
  useLiveAudioFrameSelector,
} from './audio/LiveAudioContext';
import LiveFigure from './components/LiveFigure';
import writeLiveText from './utils/liveText';
import type { IChartPointData } from './graph/ChartController';
import {
  SILENT_WAVEFORM,
  UPDATE_INTERVAL_MS,
} from './graph/liveSpectrumFrames';
import useSmoothFrames from './utils/useSmoothFrames';
import useMomentaryHold from './utils/useMomentaryHold';
import useMeterLabelFit from './useMeterLabelFit';
import { getTitlebarWaveHidden } from './utils/graphStyle';
import { useTranslation } from './utils/I18nContext';
import { readSurface } from './utils/theme';
import { rainbowGradientStops, useRainbowStops } from './utils/rainbowPalette';
import paintFlatMeter from './waveformFlatPaint';
import { type IRecorderView, createRecorderView } from './waveformRecorderView';
import { advanceFlatMeter, createFlatMeterState } from './waveformFlatState';
import './styles/WaveformVisualizer.scss';

/** The spectrum's bands every style reads: as many as the pane can show. */
const FLAT_BAND_COUNT = 64;

/**
 * The styles drawn over a background of their own — a grid of unlit dots or
 * cells, or cells lit only by loudness — which fill the meter top to bottom,
 * under the label row, instead of starting below it (Ivan, 2026-11-16: "the
 * ones with bg needs to cover full height"). A grid that stopped short of the
 * top left an empty band under the dB reading and the pill.
 */
const FULL_HEIGHT_STYLES: ReadonlySet<WaveformStyle> = new Set([
  'dots',
  'segments',
  'heat',
  'waterfall',
]);
/** A full-height stage's own inset from the meter's top, in CSS pixels
 * (`.is-full-height` in `WaveformVisualizer.scss`). */
const FULL_HEIGHT_INSET = 2;

type TWaveformCycleStyle = WaveformStyle | 'off';

/** The held peak at its widest: it is let go below `SILENCE_DB`, -70. */
export const PEAK_WIDEST = ['-00.0 dB', '—'];

/** The held peak as the readout prints it, a dash before there is one. */
const heldPeakText = (held: number | undefined) =>
  held === undefined ? '—' : `${held.toFixed(1)} dB`;

/** The keyframes that hold the style's name up (WaveformVisualizer.scss). */
const ANNOUNCEMENT_HOLD = 'waveform-visualizer-announcement-hold';

const WAVEFORM_CYCLE: readonly TWaveformCycleStyle[] = [
  ...WAVEFORM_STYLES,
  'off',
];

const LEGACY_WAVE_OFF_MIGRATION_KEY = 'fluideq.waveOffStateMigrated';

/** The title bar's style on a first run, and after a reset of every setting. */
const DEFAULT_TITLEBAR_STYLE: TWaveformCycleStyle = 'fluid';
/**
 * Set once the recorder has been handed to this window as its meter (Ivan,
 * 2026-11-16: "on the top wave we need a true waveform"): a style chosen
 * before it existed is replaced by it once, Off excepted, and every click
 * after that is somebody's own choice again.
 */
export const RECORDER_INTRODUCED_KEY = 'fluideq.waveRecorderIntroduced';

/** The loudness figure at its widest. */
const LOUDNESS_WIDEST = ['-00.0 LUFS', '— LUFS'];

/** The loudness figure as the readout prints it. */
const loudnessText = (lufs: number | undefined) =>
  lufs === undefined ? '— LUFS' : `${lufs.toFixed(1)} LUFS`;

const isWaveformCycleStyle = (
  value: string | null,
): value is TWaveformCycleStyle =>
  value === 'off' || WAVEFORM_STYLES.includes(value as WaveformStyle);

/**
 * The stops in use across the pane, left to right and pinned to it rather
 * than to the figure, so a frequency is the same colour loud or quiet.
 */
const paneRamp = (
  context: CanvasRenderingContext2D,
  pane: { x: number; width: number },
): CanvasGradient => {
  const ramp = context.createLinearGradient(pane.x, 0, pane.x + pane.width, 0);
  rainbowGradientStops().forEach((stop) => {
    ramp.addColorStop(stop.offset, stop.colour);
  });
  return ramp;
};

/**
 * The held peak one published frame later: up to a louder frame at once,
 * otherwise down by `PEAK_RELEASE_DB`, and gone below `SILENCE_DB`.
 *
 * Rounded to the decimal the readout shows, so a change the reader could not
 * see never reaches React.
 */
const nextHeldPeak = (
  previous: number | undefined,
  framePeak: number | undefined,
): number | undefined => {
  let next: number | undefined;
  if (
    framePeak !== undefined &&
    (previous === undefined || framePeak > previous)
  ) {
    next = framePeak;
  } else if (previous !== undefined) {
    const released = previous - PEAK_RELEASE_DB;
    next = released > SILENCE_DB ? released : undefined;
  }
  return next === undefined ? undefined : Math.round(next * 10) / 10;
};

const WaveformVisualizer = () => {
  const { t } = useTranslation();
  // The stops the pane is drawn in, so a new colour is drawn at once through
  // a quiet passage, when the loop is not running (below).
  const stops = useRainbowStops();
  // The one reading this component prints itself, re-rendering it only when
  // it turns. The frames go straight to the canvas (below): rendered, they
  // woke this component - the pill and its faces with it - with every block
  // of audio, 59 times a second measured in the running window.
  const isClipping = useLiveAudioFrameSelector((frame) => frame.isClipping);
  const frames = useLiveAudioFrames();
  // `togglePaused` is deliberately not taken. Clicking cycles the meter style
  // now, so pausing has no trigger here — the analyser is still pausable
  // through the control context, it simply is not this button any more, and
  // the support panel it used to open in euphoria is still one click away on
  // the creature beside it.
  const { isActive, isPaused, readFrame } = useLiveAudioControl();
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;
  // Every sample eased toward the new frame instead of jumping to it.
  //
  // The analyser publishes about twenty-two times a second, which is fast
  // enough to be live and slow enough that each frame lands as a visible
  // snap — the trace flickers rather than flows. One multiply-add per sample
  // fixes it, which is nothing next to the drawing that follows.
  //
  // Euphoria eases harder. The meter is a meter first, so at rest it stays
  // responsive enough to read; at the ceiling nobody is reading it, they are
  // watching it, and glide is the whole point.
  //
  // Smoothed HERE rather than in the analyser, because the game's beat
  // detection runs off the same frames and needs the transients left sharp —
  // smoothing at the source would round off the very edges it looks for.
  //
  // The newest published frame and when it arrived: what the drawing takes
  // when it cannot read the capture itself — paused, or another PC's audio.
  const targetRef = useRef<number[]>([]);
  const arrivedAtRef = useRef(0);
  // Every block scaled to the pane by the music's own recent peak, and the
  // flat line held back until silence has lasted (`waveformGate.ts`). Made on
  // the first drawn frame, so a re-render never builds one to throw away.
  const waveGateRef = useRef<IWaveGate | undefined>(undefined);
  // Remembered across launches: which one somebody likes is a preference, and
  // being handed back a different meter every morning is not charming. The
  // first-run default is `fluid` (Ivan, 2026-11-18: "the default meter on
  // top is Fluid, put that, not the wave"); other styles are behind clicks.
  const [style, setStyle] = useState<TWaveformCycleStyle>(() => {
    try {
      const stored = window.localStorage.getItem(WAVEFORM_STYLE_KEY);
      // The first implementation encoded the cycle's final stop by hiding the
      // whole pane and resetting its style to the first entry. Convert that
      // exact legacy pair once so somebody already stranded there gets the new
      // visible Off state instead of needing an invisible click target.
      if (
        getTitlebarWaveHidden() &&
        stored === 'line' &&
        window.localStorage.getItem(LEGACY_WAVE_OFF_MIGRATION_KEY) !== 'true'
      ) {
        window.localStorage.setItem(LEGACY_WAVE_OFF_MIGRATION_KEY, 'true');
        window.localStorage.setItem(WAVEFORM_STYLE_KEY, 'off');
        return 'off';
      }
      // The recorder was once handed to everybody on first sight of it; the
      // first-run style is Fluid now, so nothing is handed over any more and
      // a style somebody chose stays theirs.
      window.localStorage.setItem(RECORDER_INTRODUCED_KEY, 'true');
      return isWaveformCycleStyle(stored) ? stored : DEFAULT_TITLEBAR_STYLE;
    } catch {
      return DEFAULT_TITLEBAR_STYLE;
    }
  });
  const isOff = style === 'off';
  const drawableStyle: WaveformStyle = isOff ? 'fluid' : style;
  const styleRef = useRef<WaveformStyle>(drawableStyle);
  styleRef.current = drawableStyle;
  const isOffRef = useRef(isOff);
  isOffRef.current = isOff;

  // Hidden is only a presentation preference; Off is the cycle state that
  // actually releases this visualiser's analyser claim while leaving its
  // button on screen so it can be clicked back on.
  useLiveAudioCapture(!isOff);

  // A brief announcement of the style the click just landed on. Shown for
  // two seconds in a pill on the pane and then faded out. It lives in DOM
  // rather than on the canvas so it sits outside the clipped stage, on the
  // card itself. The name stays in state through the fade so there is
  // still something to fade away — clearing it when the hold ends would
  // cut the fade at the instant it starts.
  //
  // The two seconds are the pill's own hold animation, and its end is what
  // takes it down (`useMomentaryHold`). They were a timer beside it, which
  // ran on behind a minimised window and took the name down unseen.
  const [announcedStyle, setAnnouncedStyle] =
    useState<TWaveformCycleStyle>(style);
  const {
    ref: announcementRef,
    isShown: isAnnouncementVisible,
    show: showAnnouncement,
    onAnimationEnd: onAnnouncementAnimationEnd,
  } = useMomentaryHold<HTMLSpanElement>(ANNOUNCEMENT_HOLD);

  const cycleStyle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      // Ctrl (or the platform meta key) walks the cycle backwards, so a
      // click that overshoots does not have to loop through the rest of
      // the styles to come back one step.
      const goingBack = event.ctrlKey || event.metaKey;
      setStyle((current) => {
        const at = WAVEFORM_CYCLE.indexOf(current);
        const direction = goingBack ? -1 : 1;
        const next =
          WAVEFORM_CYCLE[
            (at + direction + WAVEFORM_CYCLE.length) % WAVEFORM_CYCLE.length
          ] ?? 'fluid';
        try {
          window.localStorage.setItem(WAVEFORM_STYLE_KEY, next);
        } catch {
          // Not worth failing a click over.
        }
        setAnnouncedStyle(next);
        return next;
      });
      // Outside the updater, which React may run twice: once per click.
      showAnnouncement();
    },
    [showAnnouncement],
  );

  // The shape drawn, in the pane's units, chasing the gate's target.
  const smoothedRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Held rather than fetched per frame: a context is bound to the element it
  // came from, so the two are taken together and go stale together.
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  // The element's own box in CSS pixels, kept by the observer below rather than
  // measured in the frame, so drawing never asks layout a question.
  const sizeRef = useRef({ width: 0, height: 0, meterOffset: 0 });
  // The two states that used to reach the trace as a class on an ancestor.
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  // The freq-domain points the graph panel draws, so the `spectrum` style
  // builds real spectrum bars rather than the time-domain envelope every
  // other style uses. Kept in a ref so the frame loop reads whatever the
  // analyser last published without waking up on each new frame — the loop
  // is already scheduled by each new waveform (below).
  const pointsRef = useRef<IChartPointData[]>(frames.read().points);
  // The spectrum's bands, reused across frames.
  const spectrumMagnitudesRef = useRef<number[]>([]);
  // What the styles remember between frames (`waveformFlatState.ts`), and how
  // long since the last moment was kept.
  const flatStateRef = useRef(createFlatMeterState());
  const sinceHistoryRef = useRef({ value: 0 });
  // The recorder (`waveformRecorderView.ts`), which keeps the music it has
  // drawn, and the loudness figure it writes.
  const loudnessTextRef = useRef<HTMLSpanElement | null>(null);
  const recorderRef = useRef<IRecorderView | undefined>(undefined);

  // One drawn frame, painted straight onto the canvas.
  //
  // Not through React, deliberately. Setting state at display rate would
  // re-render this component sixty times a second to move a line, and the
  // whole reason the shape is eased at all is that redrawing is the expensive
  // part.
  const drawFrame = useCallback((deltaMs: number) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) {
      return false;
    }
    // The pane's own box, which is the element's less the bleed at each edge.
    const boxWidth = sizeRef.current.width - WAVEFORM_BLEED * 2;
    const boxHeight = sizeRef.current.height - WAVEFORM_BLEED * 2;
    if (boxWidth <= 0 || boxHeight <= 0) {
      return false;
    }

    // The backing store, in device pixels.
    //
    // Sized here rather than in an effect because the ratio is not only a
    // property of the element: dragging the window onto a display with a
    // different scale changes it with nothing to observe. Assigning either
    // dimension clears the canvas and resets the context, which is why every
    // piece of context state below is set on every frame rather than once.
    const ratio = window.devicePixelRatio || 1;
    const backingWidth = Math.max(1, Math.round(sizeRef.current.width * ratio));
    const backingHeight = Math.max(
      1,
      Math.round(sizeRef.current.height * ratio),
    );
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    // Cleared in device pixels, so the rounding above cannot leave a seam of
    // last frame's drawing along an edge.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // The recorder's history is let go when another style is drawn, so
    // coming back to it never shows music from before.
    const isRecorder = !isOffRef.current && styleRef.current === 'recorder';
    if (!isRecorder) {
      recorderRef.current?.clear();
    }

    const smoothed = smoothedRef.current;
    // The capture as it is at this frame, not at the pump's last tick — see
    // `liveFrameReader.ts`. Off, paused or showing another PC's audio, it
    // answers nothing and the published frame stands.
    const fresh = isOffRef.current ? undefined : readFrameRef.current();
    // The capture's resting frame stands for every block it no longer sends,
    // so it is dated by this drawing, as the held peak's release below counts
    // it; any other published frame by when it arrived.
    const isStandingRest =
      !fresh && targetRef.current === SILENT_WAVEFORM && !isPausedRef.current;
    waveGateRef.current ??= createWaveGate();
    const waveGate = waveGateRef.current;
    if (fresh) {
      waveGate.take(fresh.waveform, fresh.points, fresh.audioMs, 'audio');
    } else if (!isOffRef.current) {
      waveGate.take(
        targetRef.current,
        pointsRef.current,
        isStandingRest ? performance.now() : arrivedAtRef.current,
        'arrival',
      );
    }
    const target = waveGate.target();
    if (smoothed.length !== target.length) {
      // First block, or the analyser changed size. Nothing to ease from, so
      // the shape arrives whole rather than growing out of zero.
      smoothed.length = target.length;
      for (let index = 0; index < target.length; index += 1) {
        smoothed[index] = target[index];
      }
    }
    const framePoints = isOffRef.current
      ? pointsRef.current
      : waveGate.points();
    // The same in Rainbow and out of it, both drawn at the display's own
    // rate. Lengthening the half-life for Rainbow once made the trace lag
    // the music, which is the opposite of smooth — it is the same picture
    // arriving late.
    //
    // Every style runs the spectrum bars' own ballistics: snap up on the
    // frame a hit lands, ease back over a tenth of a second. That pair is
    // the one arrangement in this pane that reads right, and the styles
    // left on the trace's flat eighteen-millisecond half-life all read as
    // frantic beside them — a symmetric rate that quick tracks the
    // waveform's own oscillation rather than the shape of the sound, so
    // the drawing shivers instead of moving.
    //
    // In the pane's units, never in raw amplitude: the ease's settle
    // threshold is a five-hundredth of the range it is given, and a raw
    // record at -45 dBFS spans less than three of those.
    let moving = easeTowards(
      smoothed,
      target,
      getEaseFactor(deltaMs, SPECTRUM_BAR_ATTACK_MS),
      getEaseFactor(deltaMs, SPECTRUM_BAR_RELEASE_MS),
    );
    // A silence still inside its hold ends on a later block, and only another
    // read can bring one: the pump sends nothing once the output is at rest.
    if (waveGate.isHolding() && (fresh !== undefined || isStandingRest)) {
      moving = true;
    }
    // The spectrum's bands, for every style: eased like the wave, snapping up
    // on a hit and falling back over a tenth of a second. Once they are up
    // they stay the figure, and a frame with no spectrum lets them fall rather
    // than handing the drawing to anything else. The spectrum calls a frame
    // silent when no band passes -95 dB (`LIVE_SILENCE_DB`), the wave only
    // under -70 dBFS peak (`WAVE_SILENCE_AMPLITUDE`), and quiet speech sits
    // between the two: swapping the figure at that line read as the bars
    // glitching as a voice trailed off.
    const bands = spectrumMagnitudesRef.current;
    if (bands.length !== FLAT_BAND_COUNT) {
      bands.length = FLAT_BAND_COUNT;
      bands.fill(0);
    }
    moving =
      advanceSpectrumBars(
        bands,
        framePoints,
        MIN_GAIN,
        deltaMs,
        undefined,
        MAX_GAIN - MIN_GAIN,
      ) || moving;

    // Off is still a visible, clickable instrument: a faint centre line
    // remains, so the titlebar does not turn into an unexplained empty
    // capsule; only the live figure and the analyser work below this point
    // stop.
    const pane = {
      x: WAVEFORM_BLEED,
      y: WAVEFORM_BLEED,
      width: boxWidth,
      height: boxHeight,
    };
    const unlit = readSurface('--meter-unlit', 'rgba(200, 240, 245, 0.08)');
    if (isOffRef.current) {
      // Centred in the meter under the label row, where every live style's
      // centre is, not in the whole stage: Off's stage runs to the top of the
      // pane (`.is-off`), and its line sat in the label row's lower half
      // (Ivan, 2026-11-17: "starting but off").
      const meterTop = pane.y + sizeRef.current.meterOffset;
      context.fillStyle = unlit;
      context.fillRect(
        pane.x,
        Math.round(((meterTop + pane.y + pane.height) / 2) * ratio) / ratio,
        pane.width,
        1 / ratio,
      );
      return false;
    }

    // The held peak lets go a step per published frame, and the capture's
    // resting frame is the last one until sound returns, so a peak still
    // showing then would stand on a number the silence left behind. From
    // there it steps down here instead, once per `UPDATE_INTERVAL_MS` — the
    // cadence the frames it is standing in for would have arrived at — and
    // holds still while paused, as it did when a paused capture sent none.
    if (
      targetRef.current === SILENT_WAVEFORM &&
      heldPeakRef.current !== undefined &&
      !isPausedRef.current
    ) {
      restReleaseMsRef.current += deltaMs;
      let held: number | undefined = heldPeakRef.current;
      while (
        held !== undefined &&
        restReleaseMsRef.current >= UPDATE_INTERVAL_MS
      ) {
        restReleaseMsRef.current -= UPDATE_INTERVAL_MS;
        held = nextHeldPeak(held, undefined);
      }
      if (held !== heldPeakRef.current) {
        heldPeakRef.current = held;
        writeLiveText(peakTextRef.current, heldPeakText(held));
      }
      moving = moving || held !== undefined;
    }

    if (isRecorder) {
      recorderRef.current ??= createRecorderView((lufs) =>
        writeLiveText(loudnessTextRef.current, loudnessText(lufs)),
      );
      // A plain waveform (Ivan, 2026-11-16: "just a normal waveform") in the
      // window's colours across the pane, as every other style and the
      // graph's analyser wear them (2026-11-17: "top wave needs to be also
      // colourful"): one colour, or the Tint's gradient.
      return (
        recorderRef.current.draw(context, {
          box: pane,
          ratio,
          palette: {
            fill: paneRamp(context, pane),
            paused: PAUSED_STROKE,
          },
          isPaused: isPausedRef.current,
          fresh,
          published: targetRef.current,
          publishedAt: arrivedAtRef.current,
          now: performance.now(),
        }) || moving
      );
    }

    // The held marks, the last moments and the two channels (Peaks, Echo,
    // Waterfall, Level). The channels are each one's loudest sample as the
    // capture read it; without a fresh read — paused, another PC's audio —
    // both stand on the wave's own peak.
    const loudest = smoothed.reduce(
      (peak, value) => Math.max(peak, Math.abs(value)),
      0,
    );
    const channelPeaks = fresh?.channelPeaks;
    const channels: [number, number] = [
      channelPeaks?.[0] ?? loudest,
      channelPeaks?.[1] ?? channelPeaks?.[0] ?? loudest,
    ];
    moving =
      advanceFlatMeter(
        flatStateRef.current,
        bands,
        isPausedRef.current ? [0, 0] : channels,
        isPausedRef.current ? 0 : deltaMs,
        sinceHistoryRef.current,
      ) || moving;

    // The trace's colours, left to right across the pane and pinned to it
    // rather than to the figure, so a frequency is the same colour loud or
    // quiet: the stops in use — the window's colour or its Tint's gradient,
    // or a scene's palette. One rule for every style; the whole pane changes
    // together. Clipping outranks paused, as it always did: a paused
    // analyser that was clipping when it stopped keeps the warning.
    let ink: string | CanvasGradient = paneRamp(context, pane);
    let light = 'rgba(255, 255, 255, 0.85)';
    if (isOverloadingRef.current) {
      ink = CLIP_STROKE;
      light = CLIP_STROKE;
    } else if (isPausedRef.current) {
      ink = PAUSED_STROKE;
      light = PAUSED_STROKE;
    }

    paintFlatMeter(context, {
      style: styleRef.current as Exclude<WaveformStyle, 'recorder'>,
      box: pane,
      ratio,
      wave: smoothed,
      bands,
      state: flatStateRef.current,
      ink,
      light,
      unlit,
      meterTop: FULL_HEIGHT_STYLES.has(styleRef.current)
        ? pane.y + sizeRef.current.meterOffset
        : pane.y,
    });
    return moving;
  }, []);

  // The celebration gets the display's full rate and everything else is
  // capped at thirty; the hook reads which from the shell, so this does not
  // have to re-render for the rate to change.
  //
  // Always enabled, where the SVG version switched the loop off with the
  // analyser. A stopped path keeps its `d` and can still be recoloured by a
  // class; a stopped canvas keeps whatever pixels it last drew and nothing can
  // reach them, so pausing has to be *drawn* rather than declared. The loop
  // still costs nothing when there is nothing to do — it reports back that the
  // shape has arrived and is not queued again until something kicks it.
  const kickFrames = useSmoothFrames(drawFrame, {
    isEnabled: true,
    target: canvasRef,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    contextRef.current = canvas.getContext('2d');
  }, []);

  /**
   * Watch the box, because everything about this drawing is measured from it.
   *
   * The SVG scaled itself: one `viewBox` and the browser did the rest, through
   * a window resize, a narrower titlebar and the seven hundred milliseconds the
   * pane spends growing into euphoria. A canvas is a bitmap and knows none of
   * that, so the observer is what replaces it — it fires on every step of that
   * transition and each one asks for a frame.
   *
   * Kicking rather than re-rendering: the size lands in a ref the loop already
   * reads, so a resize costs a draw and not a React pass.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) {
        return;
      }
      sizeRef.current.width = box.width;
      sizeRef.current.height = box.height;
      // Where the meter itself begins inside a full-height stage: under the
      // label row, as every other style's stage does. Read here, where the
      // stage has just changed size, rather than asked of layout per frame.
      const meter = canvas.closest('.waveform-visualizer');
      const room = meter
        ? parseFloat(
            getComputedStyle(meter).getPropertyValue('--meter-meta-room'),
          )
        : Number.NaN;
      sizeRef.current.meterOffset = Number.isFinite(room)
        ? Math.max(0, room - FULL_HEIGHT_INSET)
        : 0;
      kickFrames();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kickFrames]);

  // Held peak, so the number is readable instead of a blur of digits. The
  // readout is DOM: it sits in the meta row above the stage, where it can
  // hug the top of the pane with no padding of its own while only the
  // waveform underneath is inset.
  //
  // THE ONLY THING OUTSIDE THE CANVAS THAT MOVES, and it is quantised so
  // it moves as rarely as it can. The full-precision peak changes on
  // every published frame; the displayed figure carries one decimal, so the
  // reading is rounded to one decimal FIRST and the text is only touched
  // when that rounded number actually differs — the float underneath can
  // drift as much as it likes for free.
  //
  // Nothing else in the DOM here changes with the audio: the trace, the
  // bars and the glow are all pixels in the canvas, which is a resource
  // update rather than a style invalidation. That is the whole reason
  // this pane is a bitmap.
  //
  // Written straight into the figure's text, never through React
  // (`writeLiveText`): with music the rounded figure still changes on most
  // frames, and as state it rendered this whole component - the pill and its
  // six faces with it - 39 times a second, measured in the running window
  // (2026-11-16).
  const heldPeakRef = useRef<number | undefined>(undefined);
  const peakTextRef = useRef<HTMLSpanElement>(null);
  // How long the loop has drawn the capture's resting frame since the held
  // peak last stepped down — see the release in `drawFrame`.
  const restReleaseMsRef = useRef(0);

  // A new measurement is a new target, and a reason to start moving again;
  // and a step of the held peak, which renders only when its figure changes.
  //
  // Each published frame is taken once, whoever hands it over. The frame
  // listener reads the current frame as it subscribes, and so does the
  // switch-on effect below in the same commit: taking it twice stepped the
  // held peak down once for a frame that was published once, so the figure
  // opened a step (1.1 dB) under the music's own peak. Only a frame actually
  // taken counts as taken, so the ones that arrive while the meter is off are
  // still taken when it comes back on.
  const takenWaveformRef = useRef<number[] | undefined>(undefined);
  const takeWaveform = useCallback(
    (waveform: number[]) => {
      if (isOffRef.current || waveform === takenWaveformRef.current) {
        return;
      }
      takenWaveformRef.current = waveform;
      targetRef.current = waveform;
      // The block's own arrival, which is what dates it when the drawing
      // cannot read the capture's audio clock.
      arrivedAtRef.current = performance.now();
      kickFrames();
      // A published frame is a step of its own; the rest clock counts from it.
      restReleaseMsRef.current = 0;
      const shown = nextHeldPeak(heldPeakRef.current, peakDbOf(waveform));
      if (shown !== heldPeakRef.current) {
        heldPeakRef.current = shown;
        writeLiveText(peakTextRef.current, heldPeakText(shown));
      }
    },
    [kickFrames],
  );
  useLiveAudioFrameListener(({ points, waveform }) => {
    pointsRef.current = points;
    takeWaveform(waveform);
  });
  // Switched back on, the meter takes the reading there is now: the ones that
  // arrived while it was off were not taken.
  useEffect(() => {
    if (!isOff) {
      takeWaveform(frames.read().waveform);
    }
  }, [frames, isOff, takeWaveform]);

  // The capture's own verdict, from railed samples — the app's one
  // definition of clipping, and the same one the sidebar meter uses.
  const isOverloading = isClipping;
  const isOverloadingRef = useRef(isOverloading);
  isOverloadingRef.current = isOverloading;

  // Anything that changes how the meter looks is also a reason to draw.
  //
  // The loop stops once the shape has arrived, so through a quiet passage
  // nothing is running — and a canvas holds its last frame. Without this the
  // pane would grow into euphoria around a wave still drawn at the old
  // amplitude, a click would cycle to a style that did not appear until the
  // music moved, and pausing would leave the trace lit. Under SVG the cascade
  // covered three of those for free; here every one of them is a frame.
  //
  // Placed after the peak block rather than beside the other effects
  // because `isOverloading` is derived from the held peak, and an effect
  // cannot depend on a value declared below it.
  useEffect(() => {
    kickFrames();
  }, [isOverloading, isPaused, kickFrames, stops, style]);

  // LIVE OUTPUT steps aside where it would run into the readouts, in
  // whatever language it is in (`useMeterLabelFit`).
  const shellRef = useRef<HTMLDivElement | null>(null);
  const signalRef = useRef<HTMLSpanElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  useMeterLabelFit(shellRef, signalRef, readoutRef, !isOff);

  // The recorder says how to read it: which half is which channel, what the
  // red is, what the new figure measures.
  const styleLabel = `${t('waveform.style')} — ${style}${
    style === 'recorder' ? `: ${t('waveform.recorderHint')}` : ''
  }`;

  return (
    // A wrapper, so the pill can be a real button.
    //
    // The meter itself is a button — it cycles the meter style — and a button
    // inside a button is invalid markup that browsers resolve by silently
    // unnesting, which loses the inner click. The pill therefore sits beside
    // the meter and is positioned over it.
    <div ref={shellRef} className="waveform-visualizer-shell">
      <button
        type="button"
        // The style modifier no longer paints anything — the frame loop does —
        // but it stays, because it is the only place the current style is
        // legible to anything outside this component now that the drawing is a
        // bitmap.
        className={`waveform-visualizer waveform-visualizer--${style}${isActive && !isOff ? ' is-active' : ''}${
          isPaused && !isOff ? ' is-paused' : ''
        }${isOverloading && !isOff ? ' is-clipping' : ''}${isOff ? ' is-off' : ''}${
          !isOff && FULL_HEIGHT_STYLES.has(drawableStyle)
            ? ' is-full-height'
            : ''
        }`}
        // Says what pressing it does AND which style is currently drawn — the
        // second half is the only place the choice is legible now that the
        // meter has eleven of them, and hovering is the fastest way to tell
        // one from the next without cycling through the whole set. The style
        // keys ('line', 'spectrum', …) are technical identifiers rather than
        // prose, so they pass through the label as-is rather than each
        // needing an entry in every registered locale.
        aria-label={styleLabel}
        title={styleLabel}
        onClick={cycleStyle}
      >
        {/* The meta row, in DOM and outside the stage so it can sit flush
            against the top of the pane. Only the waveform below it is
            inset; these hug the edge. */}
        {!isOff && (
          <span className="waveform-visualizer__meta">
            <span ref={signalRef} className="waveform-visualizer__signal">
              <span className="waveform-visualizer__signal-dot" />
              {t(isActive ? 'waveform.live' : 'waveform.signal')}
            </span>
            <span ref={readoutRef} className="waveform-visualizer__readout">
              {/* Clipping outranks the number: once it is lit, the number is
                  the least interesting thing on the pane. */}
              {isOverloading && (
                <span className="waveform-visualizer__clip">
                  {t('waveform.clip')}
                </span>
              )}
              {style === 'recorder' && (
                <LiveFigure
                  className="waveform-visualizer__loudness"
                  widest={LOUDNESS_WIDEST}
                  textRef={loudnessTextRef}
                >
                  {loudnessText(undefined)}
                </LiveFigure>
              )}
              <LiveFigure
                className="waveform-visualizer__peak"
                widest={PEAK_WIDEST}
                textRef={peakTextRef}
              >
                {heldPeakText(heldPeakRef.current)}
              </LiveFigure>
            </span>
          </span>
        )}
        {/* The stage: a wrapper whose only job is to clip the canvas to
            the pane's rounded shape. The canvas is deliberately grown
            past the pane on every side so the trace's bloom has somewhere
            to spill, and without something clipping it that overspill
            painted outside the rounded border — squared-off corners with
            wave in them, sitting proud of the card. `overflow: hidden`
            plus an inherited radius is what puts the drawing back inside
            the pane it belongs to. */}
        <span className="waveform-visualizer__stage">
          <canvas
            ref={canvasRef}
            className="waveform-visualizer__canvas"
            // Grown past its cell on every side, and inline rather than in the
            // stylesheet because the frame loop insets the drawing by exactly the
            // same number. Two copies of it in two languages is two copies that
            // will disagree the first time one is adjusted, and the symptom would
            // be a trace quietly off centre.
            //
            // The backing store is sized in the loop; these are CSS pixels and
            // only say where the drawing sits.
            style={{
              margin: -WAVEFORM_BLEED,
              width: `calc(100% + ${WAVEFORM_BLEED * 2}px)`,
              height: `calc(100% + ${WAVEFORM_BLEED * 2}px)`,
            }}
            // A drawing of the sound, inside a button that already says what it
            // is and what pressing it does. The SVG carried `role="img"` and a
            // label of its own, which the button's `aria-label` overrode anyway;
            // a canvas cannot carry it at all, since a canvas is interactive
            // content and giving interactive content a non-interactive role is
            // how a control disappears from the accessibility tree.
            aria-hidden
          />
        </span>
        {/* The name of the style the click just landed on, outside the
            stage so it sits on the card rather than inside the clipped
            drawing. Always rendered so the fade-out has a name to fade;
            `role="status"` reaches a reader for the same brief window. */}
        <span
          ref={announcementRef}
          className={`waveform-visualizer__announcement${
            isOff || isAnnouncementVisible ? ' is-visible' : ''
          }${isAnnouncementVisible ? ' is-announcing' : ''}`}
          role="status"
          aria-hidden={!isOff && !isAnnouncementVisible}
          onAnimationEnd={onAnnouncementAnimationEnd}
        >
          {isOff ? style : announcedStyle}
        </span>
      </button>
    </div>
  );
};

export default WaveformVisualizer;
