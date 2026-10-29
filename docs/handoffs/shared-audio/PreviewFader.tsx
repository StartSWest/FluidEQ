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
  onChange,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  value: number;
  caption: string;
  disabled?: boolean;
  onChange(value: number): void;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className="remote-audio__lane preview-mix-fader">
      <label htmlFor={id} className="preview-mix-label">
        <span className="remote-audio__lane-names">
          <strong>{label}</strong>
        </span>
        <output className="remote-audio__lane-level-value" htmlFor={id}>
          {percent}%
        </output>
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
      <span className="remote-audio__lane-caption">{caption}</span>
    </div>
  );
}
