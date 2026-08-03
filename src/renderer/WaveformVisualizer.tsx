import { useMemo } from 'react';
import { useLiveAudio } from './audio/LiveAudioContext';
import './styles/WaveformVisualizer.scss';

export const WAVEFORM_WIDTH = 420;
export const WAVEFORM_HEIGHT = 58;

export const createWaveformPath = (samples: number[]) => {
  // A single sample would make the x step divide by zero and emit a NaN path,
  // which silently blanks the whole visualiser.
  const visibleSamples =
    samples.length > 1 ? samples : Array(96).fill(samples[0] ?? 0.04);
  const center = WAVEFORM_HEIGHT / 2;
  const amplitude = 23;
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

const WaveformVisualizer = () => {
  const { error, isActive, isPaused, togglePaused, waveform } = useLiveAudio();
  const waveformPath = useMemo(() => createWaveformPath(waveform), [waveform]);

  return (
    <button
      type="button"
      className={`waveform-visualizer${isActive ? ' is-active' : ''}${
        isPaused ? ' is-paused' : ''
      }`}
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
      </div>
      <svg
        className="waveform-visualizer__canvas"
        viewBox={`0 0 ${WAVEFORM_WIDTH} ${WAVEFORM_HEIGHT}`}
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
        <path className="waveform-visualizer__baseline" d="M 0 29 L 420 29" />
        <path className="waveform-visualizer__fill" d={waveformPath} />
        <path
          className="waveform-visualizer__line"
          d={waveformPath.replace(/ Z$/, '')}
        />
      </svg>
      {error && <span className="waveform-visualizer__error">{error}</span>}
    </button>
  );
};

export default WaveformVisualizer;
