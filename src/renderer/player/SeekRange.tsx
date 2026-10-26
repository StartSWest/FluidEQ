/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';

interface ISeekRangeProps {
  positionMs: number;
  durationMs: number;
  /** Absent where the source cannot seek: the line is then only a readout. */
  onSeek: ((positionMs: number) => void) | undefined;
  /**
   * Where the thumb stands instead of the source's own position — while it
   * is held, and after it is let go until the source has got there — and
   * `undefined` once the source's position is the one to show again.
   */
  onScrub?: (positionMs: number | undefined) => void;
  className?: string;
}

/**
 * Near enough to the place asked for to count as there: the clock reads the
 * source to the second, and a source lands a seek on its own frame.
 */
const ARRIVED_MS = 1500;
/**
 * How many ordinary ticks of the old position are waited through before a
 * seek is taken as refused — a program that ignores the request goes on
 * playing where it was, and the thumb goes back to it.
 */
const GIVE_UP_TICKS = 3;

/** A seek sent and not yet heard back: where to, and how long it has waited. */
interface IHeldSeek {
  targetMs: number;
  ticks: number;
}

/**
 * The song's line, and the thumb that moves through it.
 *
 * A held thumb goes where it is dragged and the source is sent there once,
 * when it is let go: a seek on every step of a drag is a stream of jumps the
 * listener hears as stutter.
 *
 * LET GO, THE THUMB STAYS WHERE IT WAS PUT until the source says it is there
 * (Ivan, 2026-10-25: "fix the seek bar glitching on jump with mouse"). The
 * source answers a seek on its own time, and the thumb used to fall back to
 * the position it reported before the press for that moment and then jump
 * to the new one: forward, back, forward. It is held on the place asked for
 * until the reported position arrives near it, jumps somewhere else (the
 * source landed the seek elsewhere), or ticks on from the old place a few
 * times (the source refused it). Each of those is a report, never a clock.
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
  const [held, setHeld] = useState<IHeldSeek>();
  const lastPositionRef = useRef(positionMs);
  const canSeek = onSeek !== undefined && durationMs > 0;
  const standInMs = scrubMs ?? held?.targetMs;
  const shownMs = Math.min(standInMs ?? positionMs, Math.max(0, durationMs));
  const fill = durationMs > 0 ? (shownMs / durationMs) * 100 : 0;

  // Each report of the source's position: has the held seek landed?
  useEffect(() => {
    const previous = lastPositionRef.current;
    lastPositionRef.current = positionMs;
    setHeld((seek) => {
      if (!seek) {
        return seek;
      }
      const hasArrived = Math.abs(positionMs - seek.targetMs) <= ARRIVED_MS;
      const hasJumped = Math.abs(positionMs - previous) > ARRIVED_MS;
      if (hasArrived || hasJumped || seek.ticks + 1 >= GIVE_UP_TICKS) {
        return undefined;
      }
      return { ...seek, ticks: seek.ticks + 1 };
    });
  }, [positionMs]);

  // Another song: nothing asked of the last one stands on this one's line.
  useEffect(() => {
    setHeld(undefined);
  }, [durationMs]);

  useEffect(() => {
    onScrub?.(standInMs);
  }, [onScrub, standInMs]);

  const letGo = () => {
    if (scrubMs !== undefined) {
      onSeek?.(scrubMs);
      setHeld(
        onSeek === undefined ? undefined : { targetMs: scrubMs, ticks: 0 },
      );
    }
    setScrubMs(undefined);
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
      onChange={(event) => setScrubMs(Number(event.target.value))}
      onPointerUp={letGo}
      onKeyUp={letGo}
      onBlur={letGo}
    />
  );
};

export default SeekRange;
