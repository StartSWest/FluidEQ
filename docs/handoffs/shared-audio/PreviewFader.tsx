/* FluidEQ — GPL-3.0-or-later. Uses the app's now-playing volume fader styling. */
import type { CSSProperties } from 'react';
import '../../../src/renderer/styles/NowPlayingBar.scss';

export default function PreviewFader({
  id,
  label,
  ariaLabel,
  value,
  caption,
  disabled = false,
  className = '',
  onChange,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  value: number;
  caption: string;
  disabled?: boolean;
  className?: string;
  onChange(value: number): void;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className={`simple-fader ${className}`}>
      <label htmlFor={id}>
        <span className="simple-fader-label">{label}</span>
        <output htmlFor={id}>{percent}%</output>
        <input
          id={id}
          className="now-playing-bar__volume-slider"
          aria-label={ariaLabel}
          type="range"
          min="0"
          max="100"
          value={percent}
          disabled={disabled}
          style={{ '--now-playing-progress': `${percent}%` } as CSSProperties}
          onChange={(event) => onChange(Number(event.target.value) / 100)}
        />
      </label>
      <small>{caption}</small>
    </div>
  );
}
