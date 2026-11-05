/* FluidEQ — GPL-3.0-or-later */
import type { CSSProperties, KeyboardEventHandler } from 'react';
import '../styles/NowPlayingBar.scss';
import PlayerIcon from '../player/PlayerIcon';

const RemoteAudioFader = ({
  id,
  label,
  value,
  valueText,
  onBeginChange,
  onEndChange,
  onKeyDown,
  caption,
  disabled,
  muted = false,
  muteLabel,
  onToggleMute,
  onChange,
}: {
  id: string;
  label: string;
  value?: number;
  valueText?: string;
  onBeginChange?: () => void;
  onEndChange?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  caption: string;
  disabled?: boolean;
  muted?: boolean;
  muteLabel: string;
  onToggleMute(): void;
  onChange(value: number): void;
}) => {
  const effective = muted ? 0 : value;
  const percent =
    effective === undefined ? undefined : Math.round(effective * 100);
  return (
    <div className="remote-audio__lane remote-audio__mix-fader">
      <div className="remote-audio__mix-label">
        <label htmlFor={id} className="remote-audio__lane-names">
          <strong>{label}</strong>
        </label>
        <output className="remote-audio__lane-level-value" htmlFor={id}>
          {valueText ?? (percent === undefined ? '—' : `${percent}%`)}
        </output>
        <div className="remote-audio__mix-volume">
          <button
            type="button"
            className="now-playing-bar__volume-icon"
            aria-label={muteLabel}
            title={muteLabel}
            aria-pressed={muted}
            disabled={disabled || value === undefined}
            onClick={onToggleMute}
          >
            <PlayerIcon name={muted || value === 0 ? 'mute' : 'speaker'} />
          </button>
          <input
            id={id}
            type="range"
            min="0"
            max="100"
            value={percent ?? 0}
            onPointerDown={onBeginChange}
            onKeyDown={onKeyDown}
            onBlur={onEndChange}
            className="now-playing-bar__volume-slider"
            aria-label={label}
            disabled={disabled || value === undefined}
            style={
              { '--now-playing-progress': `${percent ?? 0}%` } as CSSProperties
            }
            onChange={(event) => onChange(Number(event.target.value) / 100)}
          />
        </div>
      </div>
      <span className="remote-audio__lane-caption">{caption}</span>
    </div>
  );
};
export default RemoteAudioFader;
