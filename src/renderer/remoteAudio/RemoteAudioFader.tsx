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
  // The mute button leads the row, in the rail's glyph column: folded, the
  // rail keeps it and lets every `studio-rail__word` go (`StudioRail.scss`),
  // so each source's speaker stays a press away.
  return (
    <div className="remote-audio__fader">
      <button
        type="button"
        className="now-playing-bar__volume-icon remote-audio__fader-mute"
        aria-label={muteLabel}
        title={muteLabel}
        aria-pressed={muted}
        disabled={disabled || value === undefined}
        onClick={onToggleMute}
      >
        <PlayerIcon name={muted || value === 0 ? 'mute' : 'speaker'} />
      </button>
      <label
        htmlFor={id}
        className="remote-audio__fader-name studio-rail__word"
      >
        {label}
      </label>
      <output
        className="remote-audio__fader-value studio-rail__word"
        htmlFor={id}
      >
        {valueText ?? (percent === undefined ? '—' : `${percent}%`)}
      </output>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        value={percent ?? 0}
        onPointerDown={onBeginChange}
        onKeyDown={onKeyDown}
        onBlur={onEndChange}
        className="now-playing-bar__volume-slider remote-audio__fader-slider studio-rail__word"
        aria-label={label}
        disabled={disabled || value === undefined}
        style={
          { '--now-playing-progress': `${percent ?? 0}%` } as CSSProperties
        }
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <span className="remote-audio__fader-caption studio-rail__word">
        {caption}
      </span>
    </div>
  );
};
export default RemoteAudioFader;
