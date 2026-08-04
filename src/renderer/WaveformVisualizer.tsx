import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveAudio } from './audio/LiveAudioContext';
import './styles/WaveformVisualizer.scss';

export const WAVEFORM_WIDTH = 420;
export const WAVEFORM_HEIGHT = 58;

/** Where the trace tops out, leaving a little air under the pane edges. */
const WAVEFORM_AMPLITUDE = 25;
/** Vertical rules behind the trace, so the pane reads as a meter. */
const GRID_DIVISIONS = 12;
/** dB below which there is nothing worth showing a number for. */
const SILENCE_DB = -70;
/**
 * Peak falls this many dB per frame. Instant decay makes the readout
 * unreadable; holding it forever makes it a lie.
 */
const PEAK_RELEASE_DB = 1.1;

export const createWaveformPath = (samples: number[]) => {
  // A single sample would make the x step divide by zero and emit a NaN path,
  // which silently blanks the whole visualiser.
  const visibleSamples =
    samples.length > 1 ? samples : Array(96).fill(samples[0] ?? 0.04);
  const center = WAVEFORM_HEIGHT / 2;
  const amplitude = WAVEFORM_AMPLITUDE;
  const step = WAVEFORM_WIDTH / (visibleSamples.length - 1);
  const points = visibleSamples.map((sample, index) => {
    const x = index * step;
    const y = center - sample * amplitude;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lowerPoints = visibleSamples
    .map((sample, index) => {
      const x = index * step;
      const y = center + sample * amplitude;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .reverse();
  return `M ${points.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
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

const WaveformVisualizer = () => {
  const { error, isActive, isClipping, isPaused, togglePaused, waveform } =
    useLiveAudio();
  const waveformPath = useMemo(() => createWaveformPath(waveform), [waveform]);

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
      aria-label={
        isPaused ? 'Resume live output waveform' : 'Pause live output waveform'
      }
      aria-pressed={isPaused}
      title={isPaused ? 'Resume live output' : 'Pause live output'}
      onClick={togglePaused}
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
        <path className="waveform-visualizer__fill" d={waveformPath} />
        <path
          className="waveform-visualizer__line"
          d={waveformPath.replace(/ Z$/, '')}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {error && <span className="waveform-visualizer__error">{error}</span>}
    </button>
  );
};

export default WaveformVisualizer;
