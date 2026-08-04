import { useEffect, useMemo, useRef, useState } from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import {
  useLiveAudioControl,
  useLiveAudioFrame,
} from './audio/LiveAudioContext';
import { useRhythmRun } from './utils/rhythmRun';
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
  const isEuphoric = getStreakJoy(useRhythmRun().streak) >= 1;
  const { isClipping, waveform } = useLiveAudioFrame();
  const { error, isActive, isPaused, togglePaused } = useLiveAudioControl();

  const pauseLabel = isPaused
    ? 'Resume live output waveform'
    : 'Pause live output waveform';
  const euphoriaClick = isEuphoric ? onOpenSupport : undefined;
  const waveformPath = useMemo(
    () =>
      createWaveformPath(
        waveform,
        isEuphoric ? WAVEFORM_AMPLITUDE_MAX : WAVEFORM_AMPLITUDE,
        isEuphoric,
      ),
    [isEuphoric, waveform],
  );

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
        <path className="waveform-visualizer__fill" d={waveformPath.fill} />
        <path
          className="waveform-visualizer__line"
          d={waveformPath.line}
          vectorEffect="non-scaling-stroke"
        />
        {/* The mirrored edge, stroked the same way, so the shape is outlined
            rather than being a lit top over a bare bottom. */}
        <path
          className="waveform-visualizer__line waveform-visualizer__line--mirror"
          d={waveformPath.mirror}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* The same pill the support panel shows, so the mode is named in one
          recognisable way wherever it appears. This is the copy visible with
          the dialog closed. */}
      {isEuphoric && (
        <span className="euphoria-pill waveform-visualizer__euphoria">
          {t('support.game.euphoria')}
        </span>
      )}
      {error && <span className="waveform-visualizer__error">{error}</span>}
    </button>
  );
};

export default WaveformVisualizer;
