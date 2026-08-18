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

import { CSSProperties, ReactNode, useEffect, useId, useState } from 'react';
import { formatKaraokeTime } from '../../common/karaoke/clock';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { TKaraokePlaybackStatus } from './useKaraokeSession';
import KaraokeMakerToolIcon, {
  TKaraokeMakerToolIcon,
} from './KaraokeMakerToolIcon';
import '../styles/Button.scss';

export type TKaraokeTransportChannel = 'melody' | 'backing' | 'vocal';

const CHANNEL_ICONS: Record<TKaraokeTransportChannel, TKaraokeMakerToolIcon> = {
  melody: 'melody',
  backing: 'stem',
  vocal: 'vocal',
};

export interface IKaraokeTransportLevel {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  channel?: TKaraokeTransportChannel;
  icon?: ReactNode;
  valueText?: string;
  disabled?: boolean;
  toggleDisabled?: boolean;
  pressed?: boolean;
  onToggle?: () => void;
}

interface IKaraokeTransportProps {
  status: TKaraokePlaybackStatus;
  playheadMs: number;
  durationMs: number;
  levels: readonly IKaraokeTransportLevel[];
  onTogglePlayback: () => void;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
  onSeek: (timeMs: number) => void;
  seekStepMs?: number;
}

export type TKaraokeTransportIcon =
  'restart' | 'previous' | 'play' | 'pause' | 'next' | 'volume';

/**
 * Transport glyphs have their own compact geometry. The general MenuIcon is a
 * stroked menu language, while play/skip controls need solid, balanced shapes
 * that remain obvious inside a 34px circular button.
 */
export const KaraokeTransportIcon = ({
  name,
}: {
  name: TKaraokeTransportIcon;
}) => {
  let drawing = (
    <path
      className="karaoke-transport__icon-stroke"
      d="M19 7.4V3.8m0 0h-3.6M19 3.8l-2.2 2.1A7.8 7.8 0 1 0 19.5 14"
    />
  );
  if (name === 'previous') {
    drawing = (
      <>
        <rect
          className="karaoke-transport__icon-fill"
          x="6"
          y="7"
          width="2.3"
          height="10"
          rx="1"
        />
        <path
          className="karaoke-transport__icon-fill"
          d="M17.5 6.9v10.2L9.4 12l8.1-5.1z"
        />
      </>
    );
  } else if (name === 'play') {
    drawing = (
      <path
        className="karaoke-transport__icon-fill"
        d="M8.6 6.4c0-.8.9-1.2 1.6-.8l7.8 5.6c.6.4.6 1.2 0 1.6l-7.8 5.6c-.7.5-1.6 0-1.6-.8V6.4z"
      />
    );
  } else if (name === 'pause') {
    drawing = (
      <>
        <rect
          className="karaoke-transport__icon-fill"
          x="7.5"
          y="6.5"
          width="3.4"
          height="11"
          rx="1.3"
        />
        <rect
          className="karaoke-transport__icon-fill"
          x="13.1"
          y="6.5"
          width="3.4"
          height="11"
          rx="1.3"
        />
      </>
    );
  } else if (name === 'next') {
    drawing = (
      <>
        <path
          className="karaoke-transport__icon-fill"
          d="M6.5 6.9v10.2l8.1-5.1-8.1-5.1z"
        />
        <rect
          className="karaoke-transport__icon-fill"
          x="15.7"
          y="7"
          width="2.3"
          height="10"
          rx="1"
        />
      </>
    );
  } else if (name === 'volume') {
    drawing = (
      <>
        <path
          className="karaoke-transport__icon-fill"
          d="M5 9.4h3.1l4.2-3.2v11.6l-4.2-3.2H5V9.4z"
        />
        <path
          className="karaoke-transport__icon-stroke"
          d="M15.2 9.1a4.2 4.2 0 0 1 0 5.8M17.8 6.8a7.4 7.4 0 0 1 0 10.4"
        />
      </>
    );
  }
  return (
    <svg
      className="karaoke-button__icon karaoke-transport__icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  );
};

const transportLevelIcon = (level: IKaraokeTransportLevel) =>
  level.icon ??
  (level.channel ? (
    <KaraokeMakerToolIcon name={CHANNEL_ICONS[level.channel]} />
  ) : (
    <KaraokeTransportIcon name="volume" />
  ));

const KaraokeTransportLevel = ({
  level,
  inputId,
  isInMenu = false,
}: {
  level: IKaraokeTransportLevel;
  inputId: string;
  isInMenu?: boolean;
}) => {
  const percent = Math.round(level.value * 100);
  const valueText = level.valueText ?? `${percent}%`;
  const levelStyle = {
    '--karaoke-range-progress': `${percent}%`,
  } as CSSProperties;
  const icon = transportLevelIcon(level);

  return (
    <div
      className={`karaoke-transport__volume${
        isInMenu ? ' is-in-mix-menu' : ''
      }`}
      data-channel={level.channel}
    >
      {level.onToggle ? (
        <button
          type="button"
          className="karaoke-transport__volume-icon karaoke-transport__volume-toggle"
          onClick={level.onToggle}
          disabled={level.toggleDisabled ?? level.disabled}
          aria-label={level.label}
          aria-pressed={level.pressed}
          title={level.label}
        >
          {icon}
        </button>
      ) : (
        <span className="karaoke-transport__volume-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <label
        className={
          isInMenu
            ? 'karaoke-transport__mix-label'
            : 'karaoke-transport__sr-label'
        }
        htmlFor={inputId}
      >
        {level.label}
      </label>
      <input
        id={inputId}
        aria-label={level.label}
        aria-valuetext={valueText}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={level.value}
        style={levelStyle}
        disabled={level.disabled}
        onChange={(event) => level.onChange(Number(event.target.value))}
      />
      <span className="karaoke-transport__volume-value" aria-hidden="true">
        {valueText}
      </span>
    </div>
  );
};

const KaraokeTransport = ({
  status,
  playheadMs,
  durationMs,
  levels,
  onTogglePlayback,
  onJumpToStart,
  onJumpToEnd,
  onSeek,
  seekStepMs = 5_000,
}: IKaraokeTransportProps) => {
  const { t } = useTranslation();
  const controlId = useId();
  const [mixMenuAnchor, setMixMenuAnchor] = useState<HTMLElement | null>(null);
  const isPlaying = status === 'playing';
  const canPlay = !['empty', 'loading'].includes(status);
  const progress =
    durationMs > 0 ? Math.min(100, (playheadMs / durationMs) * 100) : 0;
  const progressStyle = {
    '--karaoke-range-progress': `${progress}%`,
  } as CSSProperties;

  useEffect(() => {
    if (!mixMenuAnchor) {
      return undefined;
    }
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        mixMenuAnchor.contains(target) ||
        isInsideAnchoredMenu(event.target)
      ) {
        return;
      }
      setMixMenuAnchor(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMixMenuAnchor(null);
        mixMenuAnchor.focus();
      }
    };
    const closeOnResize = () => setMixMenuAnchor(null);
    window.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [mixMenuAnchor]);

  useEffect(() => {
    if (mixMenuAnchor && !mixMenuAnchor.isConnected) {
      setMixMenuAnchor(null);
    }
  }, [levels.length, mixMenuAnchor]);

  return (
    <div
      className="karaoke-transport"
      role="group"
      aria-label={t('karaoke.transport.title')}
      data-level-count={levels.length}
    >
      <div className="karaoke-transport__buttons">
        <button
          type="button"
          className="button small subtle karaoke-transport__control"
          onClick={onJumpToStart}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t('karaoke.maker.jumpToStart')}
          title={t('karaoke.maker.jumpToStart')}
        >
          <KaraokeTransportIcon name="previous" />
        </button>
        <button
          type="button"
          className="button small subtle karaoke-transport__control"
          onClick={() => onSeek(Math.max(0, playheadMs - seekStepMs))}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t('karaoke.maker.seekBack', {
            seconds: seekStepMs / 1_000,
          })}
          title={t('karaoke.maker.seekBack', {
            seconds: seekStepMs / 1_000,
          })}
        >
          <KaraokeTransportIcon name="previous" />
          <small>{seekStepMs / 1_000}</small>
        </button>
        <button
          type="button"
          className={`button small karaoke-transport__control karaoke-transport__play${
            isPlaying ? ' is-playing' : ''
          }`}
          onClick={onTogglePlayback}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t(
            isPlaying ? 'karaoke.transport.pause' : 'karaoke.transport.play',
          )}
          aria-keyshortcuts="Space"
          aria-pressed={isPlaying}
          data-tooltip={t('karaoke.transport.spaceShortcut', {
            action: t(
              isPlaying ? 'karaoke.transport.pause' : 'karaoke.transport.play',
            ),
          })}
        >
          <KaraokeTransportIcon name={isPlaying ? 'pause' : 'play'} />
        </button>
        <button
          type="button"
          className="button small subtle karaoke-transport__control"
          onClick={() => onSeek(Math.min(durationMs, playheadMs + seekStepMs))}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t('karaoke.maker.seekForward', {
            seconds: seekStepMs / 1_000,
          })}
          title={t('karaoke.maker.seekForward', {
            seconds: seekStepMs / 1_000,
          })}
        >
          <KaraokeTransportIcon name="next" />
          <small>{seekStepMs / 1_000}</small>
        </button>
        <button
          type="button"
          className="button small subtle karaoke-transport__control"
          onClick={onJumpToEnd}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t('karaoke.maker.jumpToEnd')}
          title={t('karaoke.maker.jumpToEnd')}
        >
          <KaraokeTransportIcon name="next" />
        </button>
      </div>

      <div className="karaoke-transport__position">
        <time className="karaoke-transport__time">
          {formatKaraokeTime(playheadMs)}
        </time>
        <label
          className="karaoke-transport__timeline"
          htmlFor={`${controlId}-position`}
        >
          <span className="karaoke-transport__sr-label">
            {t('karaoke.transport.seek')}
          </span>
          <input
            id={`${controlId}-position`}
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            step={100}
            value={Math.min(playheadMs, Math.max(1, durationMs))}
            style={progressStyle}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={!canPlay || durationMs <= 0}
          />
        </label>
        <time className="karaoke-transport__time">
          -{formatKaraokeTime(Math.max(0, durationMs - playheadMs))}
        </time>
      </div>
      {levels.map((level) => (
        <KaraokeTransportLevel
          key={level.id}
          level={level}
          inputId={`${controlId}-${level.id}`}
        />
      ))}
      {levels.length > 0 && (
        <div
          className="karaoke-transport__mix-buttons"
          role="group"
          aria-label={t('karaoke.transport.mixSettings')}
        >
          {levels.map((level) => (
            <button
              type="button"
              className="button small subtle karaoke-transport__mix-trigger"
              key={level.id}
              aria-label={t('karaoke.transport.openMixSettings', {
                channel: level.label,
              })}
              aria-haspopup="dialog"
              aria-expanded={mixMenuAnchor?.dataset.levelId === level.id}
              data-level-id={level.id}
              data-enabled={level.pressed || undefined}
              data-unavailable={
                (level.toggleDisabled ?? false) && level.disabled
                  ? true
                  : undefined
              }
              title={level.label}
              onClick={(event) => {
                const trigger = event.currentTarget;
                setMixMenuAnchor((current) =>
                  current === trigger ? null : trigger,
                );
              }}
            >
              {transportLevelIcon(level)}
            </button>
          ))}
        </div>
      )}
      <AnchoredMenu
        anchor={mixMenuAnchor}
        isOpen={Boolean(mixMenuAnchor)}
        className="karaoke-transport__mix-popover"
        role="dialog"
        ariaLabel={t('karaoke.transport.mixSettings')}
      >
        <strong className="karaoke-transport__mix-title">
          {t('karaoke.transport.mixSettings')}
        </strong>
        <div className="karaoke-transport__mix-levels">
          {levels.map((level) => (
            <KaraokeTransportLevel
              key={level.id}
              level={level}
              inputId={`${controlId}-${level.id}-menu`}
              isInMenu
            />
          ))}
        </div>
      </AnchoredMenu>
    </div>
  );
};

export default KaraokeTransport;
