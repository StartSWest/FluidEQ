import { useMemo } from 'react';
import { useLiveAudio } from './audio/LiveAudioContext';
import './styles/WaveformVisualizer.scss';

const WAVEFORM_WIDTH = 420;
const WAVEFORM_HEIGHT = 58;

const WaveformVisualizer = () => {
  const { error, isActive, waveform } = useLiveAudio();
  const waveformPath = useMemo(() => {
    const samples = waveform.length > 0 ? waveform : Array(96).fill(0.04);
    const center = WAVEFORM_HEIGHT / 2;
    const amplitude = 23;
    const points = samples.map((sample, index) => {
      const x = (index / (samples.length - 1)) * WAVEFORM_WIDTH;
      const y = center - sample * amplitude;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lowerPoints = samples
      .map((sample, index) => {
        const x = (index / (samples.length - 1)) * WAVEFORM_WIDTH;
        const y = center + sample * amplitude;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .reverse();
    return `M ${points.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
  }, [waveform]);

  return (
    <div className={`waveform-visualizer${isActive ? ' is-active' : ''}`}>
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
        </defs>
        <path className="waveform-visualizer__baseline" d="M 0 29 L 420 29" />
        <path className="waveform-visualizer__fill" d={waveformPath} />
        <path
          className="waveform-visualizer__line"
          d={waveformPath.replace(/ Z$/, '')}
        />
      </svg>
      {error && <span className="waveform-visualizer__error">{error}</span>}
    </div>
  );
};

export default WaveformVisualizer;
