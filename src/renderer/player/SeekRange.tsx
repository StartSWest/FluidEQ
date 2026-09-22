/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';

interface ISeekRangeProps {
  positionMs: number;
  durationMs: number;
  /** Absent where the source cannot seek: the line is then only a readout. */
  onSeek: ((positionMs: number) => void) | undefined;
  /** Where the thumb is while it is held, and `undefined` once let go. */
  onScrub?: (positionMs: number | undefined) => void;
  className?: string;
}

/**
 * The song's line, and the thumb that moves through it.
 *
 * A held thumb goes where it is dragged and the source is sent there once,
 * when it is let go: a seek on every step of a drag is a stream of jumps the
 * listener hears as stutter.
 */
const SeekRange = ({
  positionMs,
  durationMs,
  onSeek,
  onScrub,
  className = '',
}: ISeekRangeProps) => {
  const { t } = useTranslation();
  const [scrubMs, setScrubMs] = useState<number>();
  const canSeek = onSeek !== undefined && durationMs > 0;
  const shownMs = Math.min(scrubMs ?? positionMs, Math.max(0, durationMs));
  const fill = durationMs > 0 ? (shownMs / durationMs) * 100 : 0;

  const scrub = (next: number | undefined) => {
    setScrubMs(next);
    onScrub?.(next);
  };
  const letGo = () => {
    if (scrubMs !== undefined) {
      onSeek?.(scrubMs);
    }
    scrub(undefined);
  };

  return (
    <input
      type="range"
      className={`player-range player-range--seek ${className}`}
      min={0}
      max={Math.max(1, durationMs)}
      step={1000}
      value={shownMs}
      disabled={!canSeek}
      aria-label={t('player.seek')}
      title={canSeek ? t('player.seek') : t('player.seekNone')}
      style={{ '--fill': `${fill}%` } as CSSProperties}
      onChange={(event) => scrub(Number(event.target.value))}
      onPointerUp={letGo}
      onKeyUp={letGo}
      onBlur={letGo}
    />
  );
};

export default SeekRange;
