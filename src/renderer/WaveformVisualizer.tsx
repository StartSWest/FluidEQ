import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { easeTowards, getEaseFactor } from 'common/smoothing';
import {
  useLiveAudioControl,
  useLiveAudioFrame,
} from './audio/LiveAudioContext';
import { useRhythmRun } from './utils/rhythmRun';
import { useSmoothFrames } from './utils/useSmoothFrames';
import {
  toggleEuphoriaForced,
  useHasReachedEuphoria,
  useIsEuphoriaForced,
} from './utils/euphoriaMode';
import { useTranslation } from './utils/I18nContext';
import './styles/WaveformVisualizer.scss';

export const WAVEFORM_WIDTH = 420;
export const WAVEFORM_HEIGHT = 58;

/** Where the trace tops out, leaving a little air under the pane edges. */
const WAVEFORM_AMPLITUDE = 25;
/**
 * Euphoria mode, where the trace nearly fills its box.
 *
 * The pane also grows taller in CSS, but that alone only scales the same
 * drawing up — the wave keeps the same share of the box and looks no fuller.
 * Raising the amplitude is what actually makes it reach for the edges.
 */
const WAVEFORM_AMPLITUDE_MAX = WAVEFORM_HEIGHT / 2 - 2;

/**
 * Below this a frame is silence, and normalising it would stretch the noise
 * floor into a full-height trace of nothing.
 */
const NORMALISE_FLOOR = 0.02;

/**
 * How long the distance to the newest measurement takes to halve.
 *
 * A duration rather than a per-frame fraction, so the motion takes the same
 * wall-clock time whether the display runs at thirty, sixty or a hundred and
 * forty-four.
 *
 * Well under the 45ms between measurements — at 55ms it was longer than the
 * gap, so the trace never arrived before the next target replaced it and
 * lagged the audio permanently. Eighteen covers about four fifths of the
 * distance within one measurement: enough frames in between to read as motion
 * rather than steps, without the shape trailing what is playing.
 *
 * Symmetric, unlike the spectrum curve. This draws a waveform oscillating
 * about zero rather than a level, so easing the two directions differently
 * would not add punch, it would bend the wave out of shape.
 */
const WAVEFORM_HALF_LIFE_MS = 18;
/** Vertical rules behind the trace, so the pane reads as a meter. */
const GRID_DIVISIONS = 12;
/** dB below which there is nothing worth showing a number for. */
const SILENCE_DB = -70;
/**
 * Peak falls this many dB per frame. Instant decay makes the readout
 * unreadable; holding it forever makes it a lie.
 */
const PEAK_RELEASE_DB = 1.1;

/**
 * The stroked trace and the closed fill for one frame.
 *
 * Both are returned together because they share the upper edge: the fill is
 * the line plus the mirrored return leg. Deriving one from the other with a
 * regex, as this used to, meant a second full copy of the path string on every
 * frame for no new information.
 */
export const createWaveformPath = (
  samples: number[],
  amplitude = WAVEFORM_AMPLITUDE,
  normalise = false,
) => {
  // A single sample would make the x step divide by zero and emit a NaN path,
  // which silently blanks the whole visualiser.
  const visibleSamples =
    samples.length > 1 ? samples : Array(96).fill(samples[0] ?? 0.04);
  const center = WAVEFORM_HEIGHT / 2;
  const step = WAVEFORM_WIDTH / (visibleSamples.length - 1);
  // Euphoria ignores the volume knob: the frame is scaled by its own peak so
  // the trace fills the pane whether the music is loud or barely on. Guarded by
  // a floor, or a silent frame divides by almost nothing and the noise floor
  // arrives at full height.
  let gain = 1;
  if (normalise) {
    let peak = 0;
    for (let index = 0; index < visibleSamples.length; index += 1) {
      const magnitude = Math.abs(visibleSamples[index]);
      if (magnitude > peak) {
        peak = magnitude;
      }
    }
    gain = peak > NORMALISE_FLOOR ? 1 / peak : 0;
  }
  const upper: string[] = [];
  const lower: string[] = [];
  for (let index = 0; index < visibleSamples.length; index += 1) {
    const x = (index * step).toFixed(1);
    const offset = visibleSamples[index] * gain * amplitude;
    upper.push(`${x},${(center - offset).toFixed(1)}`);
    lower.push(`${x},${(center + offset).toFixed(1)}`);
  }
  const line = `M ${upper.join(' L ')}`;
  // The lower edge as its own line, built before the reverse below consumes the
  // array. The stroke used to trace only the top, so the mirrored half was a
  // bare fill with no edge on it — which is exactly where the eye looks when
  // the trace is symmetrical.
  const mirror = `M ${lower.join(' L ')}`;
  return { line, mirror, fill: `${line} L ${lower.reverse().join(' L ')} Z` };
};

/** Loudest sample in the frame, as dBFS. Undefined when there is silence. */
export const peakDbOf = (samples: number[]) => {
  const peak = samples.reduce(
    (loudest, sample) => Math.max(loudest, Math.abs(sample)),
    0,
  );
  if (peak <= 0) {
    return undefined;
  }
  const db = 20 * Math.log10(peak);
  return db > SILENCE_DB ? db : undefined;
};

interface IWaveformVisualizerProps {
  /**
   * Opening the support panel. Only used in euphoria mode, where a click on
   * the meter is the shortest path back to the thing being celebrated.
   */
  onOpenSupport?: () => void;
}

const WaveformVisualizer = ({ onOpenSupport }: IWaveformVisualizerProps) => {
  const { t } = useTranslation();
  // Subscribed rather than read from the DOM class the shell sets, so this
  // re-renders when the run changes instead of being told by a stylesheet.
  // Both halves of the mode: earned right now, or switched on by someone who
  // earned it before. The look is the same either way.
  const hasReached = useHasReachedEuphoria();
  const isForced = useIsEuphoriaForced();
  const isEuphoric = getStreakJoy(useRhythmRun().streak) >= 1 || isForced;
  const { isClipping, waveform } = useLiveAudioFrame();
  const { error, isActive, isPaused, togglePaused } = useLiveAudioControl();

  const pauseLabel = isPaused
    ? 'Resume live output waveform'
    : 'Pause live output waveform';
  const euphoriaClick = isEuphoric ? onOpenSupport : undefined;
  // Every sample eased toward the new frame instead of jumping to it.
  //
  // The analyser publishes about twenty-two times a second, which is fast
  // enough to be live and slow enough that each frame lands as a visible
  // snap — the trace flickers rather than flows. One multiply-add per sample
  // fixes it, which is nothing next to building the path string that follows.
  //
  // Euphoria eases harder. The meter is a meter first, so at rest it stays
  // responsive enough to read; at the ceiling nobody is reading it, they are
  // watching it, and glide is the whole point.
  //
  // Smoothed HERE rather than in the analyser, because the game's beat
  // detection runs off the same frames and needs the transients left sharp —
  // smoothing at the source would round off the very edges it looks for.
  // The newest measurement, and the shape currently drawn chasing it.
  const targetRef = useRef<number[]>([]);
  const smoothedRef = useRef<number[]>([]);
  const lineRef = useRef<SVGPathElement>(null);
  const mirrorRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  // Read inside the animation frame rather than closed over, so changing mode
  // does not have to rebuild the callback and restart the loop.
  const amplitudeRef = useRef(WAVEFORM_AMPLITUDE);
  amplitudeRef.current = isEuphoric
    ? WAVEFORM_AMPLITUDE_MAX
    : WAVEFORM_AMPLITUDE;
  const normaliseRef = useRef(false);
  normaliseRef.current = isEuphoric;

  // One drawn frame, written straight to the three paths.
  //
  // Not through React, deliberately. Setting state at display rate would
  // re-render this component sixty times a second to move a line, and the
  // whole reason the path is eased at all is that redrawing is the expensive
  // part. The elements are the same ones React created; only their `d` is
  // taken over, which is why the JSX below does not set it.
  const drawFrame = useCallback((deltaMs: number) => {
    const smoothed = smoothedRef.current;
    const moving = easeTowards(
      smoothed,
      targetRef.current,
      getEaseFactor(deltaMs, WAVEFORM_HALF_LIFE_MS),
    );
    const path = createWaveformPath(
      smoothed,
      amplitudeRef.current,
      normaliseRef.current,
    );
    lineRef.current?.setAttribute('d', path.line);
    mirrorRef.current?.setAttribute('d', path.mirror);
    fillRef.current?.setAttribute('d', path.fill);
    return moving;
  }, []);

  // The celebration gets the display's full rate and everything else is
  // capped at thirty; the hook reads which from the shell, so this does not
  // have to re-render for the rate to change.
  const kickFrames = useSmoothFrames(drawFrame, {
    isEnabled: isActive && !isPaused,
  });

  // A new measurement is a new target, and a reason to start moving again.
  useEffect(() => {
    targetRef.current = waveform;
    if (smoothedRef.current.length !== waveform.length) {
      // First frame, or the analyser changed size. Nothing to ease from, so
      // the shape arrives whole rather than growing out of zero.
      smoothedRef.current = waveform.slice();
    }
    kickFrames();
  }, [kickFrames, waveform]);

  // Held peak, so the number is readable instead of a blur of digits.
  const [heldPeak, setHeldPeak] = useState<number | undefined>(undefined);
  const heldPeakRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const framePeak = peakDbOf(waveform);
    const previous = heldPeakRef.current;
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

    if (next !== heldPeakRef.current) {
      heldPeakRef.current = next;
      setHeldPeak(next);
    }
  }, [waveform]);

  const gridLines = useMemo(
    () =>
      Array.from(
        { length: GRID_DIVISIONS - 1 },
        (_value, index) => ((index + 1) * WAVEFORM_WIDTH) / GRID_DIVISIONS,
      ),
    [],
  );

  return (
    // A wrapper, so the pill can be a real button.
    //
    // The meter itself is a button — it pauses, or in euphoria it opens the
    // panel — and a button inside a button is invalid markup that browsers
    // resolve by silently unnesting, which loses the inner click. The pill
    // therefore sits beside the meter and is positioned over it.
    <div className="waveform-visualizer-shell">
      <button
        type="button"
        className={`waveform-visualizer${isActive ? ' is-active' : ''}${
          isPaused ? ' is-paused' : ''
        }${isClipping ? ' is-clipping' : ''}`}
        // In euphoria the meter stops being a pause button and becomes the way
        // back to the panel. Pausing the analyser mid-celebration is the one
        // thing nobody wants, and the mode is the moment the app has the most
        // goodwill to spend on an invitation.
        aria-label={euphoriaClick ? t('support.title') : pauseLabel}
        aria-pressed={euphoriaClick ? undefined : isPaused}
        title={euphoriaClick ? t('support.title') : pauseLabel}
        onClick={euphoriaClick ?? togglePaused}
      >
        <div className="waveform-visualizer__meta">
          <span className="waveform-visualizer__signal">
            <span className="waveform-visualizer__signal-dot" />
            {isActive ? 'LIVE OUTPUT' : 'AUDIO SIGNAL'}
          </span>
          <span className="waveform-visualizer__readout">
            {/* Clipping outranks the number: once it is lit, the number is the
              least interesting thing on the pane. */}
            {isClipping && (
              <span className="waveform-visualizer__clip">CLIP</span>
            )}
            <span className="waveform-visualizer__peak">
              {heldPeak === undefined ? '—' : `${heldPeak.toFixed(1)} dB`}
            </span>
          </span>
        </div>
        <svg
          className="waveform-visualizer__canvas"
          viewBox={`0 0 ${WAVEFORM_WIDTH} ${WAVEFORM_HEIGHT}`}
          // The pane is responsive, so the trace stretches to fill it. Strokes
          // opt out of that scaling below, or they would smear horizontally.
          preserveAspectRatio="none"
          role="img"
          aria-label="Live output waveform"
        >
          <defs>
            <linearGradient id="waveform-fill" x1="0" x2="1">
              <stop offset="0" stopColor="#8bf6ff" stopOpacity="0.18" />
              <stop offset="0.5" stopColor="#4ff7d8" stopOpacity="0.42" />
              <stop offset="1" stopColor="#4f6ef7" stopOpacity="0.18" />
            </linearGradient>
            <linearGradient id="waveform-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#00e5ff" />
              <stop offset="0.28" stopColor="#54ff8a" />
              <stop offset="0.52" stopColor="#ffe66d" />
              <stop offset="0.76" stopColor="#ff3cac" />
              <stop offset="1" stopColor="#8b5cff" />
            </linearGradient>
          </defs>
          <g className="waveform-visualizer__grid">
            {gridLines.map((x) => (
              <path
                key={x}
                d={`M ${x} 4 L ${x} ${WAVEFORM_HEIGHT - 4}`}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <path
            className="waveform-visualizer__baseline"
            d={`M 0 ${WAVEFORM_HEIGHT / 2} L ${WAVEFORM_WIDTH} ${
              WAVEFORM_HEIGHT / 2
            }`}
            vectorEffect="non-scaling-stroke"
          />
          {/* No `d` here on purpose — the animation frame owns it. Setting it
              from JSX too would have React overwrite the eased shape with the
              last measured one on every re-render, which is the stepping this
              exists to remove. */}
          <path ref={fillRef} className="waveform-visualizer__fill" />
          <path
            ref={lineRef}
            className="waveform-visualizer__line"
            vectorEffect="non-scaling-stroke"
          />
          {/* The mirrored edge, stroked the same way, so the shape is outlined
            rather than being a lit top over a bare bottom. */}
          <path
            ref={mirrorRef}
            className="waveform-visualizer__line waveform-visualizer__line--mirror"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* The same pill the support panel shows, so the mode is named in one
          recognisable way wherever it appears. This is the copy visible with
          the dialog closed. */}
        {error && <span className="waveform-visualizer__error">{error}</span>}
      </button>
      {/* The switch, and only for someone who has already reached the ceiling
        the hard way. Before that it does not exist — the first x10 has to be
        earned, or the surprise the whole thing is built around is a button on
        the titlebar.

        Afterwards it stays put, drained of colour when the mode is off, so it
        reads as a control that is available rather than as something that
        vanished. Cosmetic only: it turns the look on, never the multiplier. */}
      {hasReached && (
        <button
          type="button"
          className={`euphoria-pill waveform-visualizer__euphoria${
            isEuphoric ? '' : ' is-dormant'
          }`}
          aria-pressed={isEuphoric}
          title={t('support.game.euphoriaToggle')}
          onClick={toggleEuphoriaForced}
        >
          {t('support.game.euphoria')}
        </button>
      )}
    </div>
  );
};

export default WaveformVisualizer;
