/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ITransportSource } from '../audio/transportSource';
import remoteOriginLine from '../audio/remoteOrigin';
import { formatDuration } from '../library/player/NowPlayingBar';
import type { useTranslation } from '../utils/I18nContext';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

/** Playing, paused part-way (the folded line's time blinks), or stopped. */
export type TPlayerState = 'play' | 'pause' | 'stop';

/**
 * The clock for a moment of the song, as the app's player bar writes times:
 * what has played, or what is left with a minus in front of it, and dashes
 * while the source has not said where it is.
 */
export const clockFor = ({
  shownMs,
  durationMs,
  isTimeLeft,
  isKnown,
}: {
  shownMs: number;
  durationMs: number;
  isTimeLeft: boolean;
  /** False while the source has said nothing about where it is. */
  isKnown: boolean;
}) => {
  if (!isKnown || durationMs <= 0) {
    return '–:––';
  }
  return isTimeLeft
    ? `−${formatDuration(Math.max(0, durationMs - shownMs))}`
    : formatDuration(shownMs);
};

/** Playing; paused somewhere past the start; or stopped at it. */
export const playerStateOf = (
  source: ITransportSource | undefined,
  second: number | undefined,
): TPlayerState => {
  if (source?.isPlaying) {
    return 'play';
  }
  return (second ?? 0) > 0 ? 'pause' : 'stop';
};

/** Where the sound is from, in the words the bar uses for it. */
export const sourceLabel = (
  source: Pick<ITransportSource, 'owner' | 'origin' | 'delayMs'>,
  t: TranslateFn,
) => {
  switch (source.owner) {
    case 'library':
      return t('tabs.library');
    case 'karaoke':
      return t('tabs.karaoke');
    case 'system':
      return t('library.systemAudio');
    case 'remote':
      return remoteOriginLine(t, source);
    default:
      return t('tabs.media');
  }
};

/** A queue's length, which runs past an hour where a song's never does. */
export const formatQueueTime = (ms: number) => {
  const whole = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(whole / 3600);
  if (hours === 0) {
    return formatDuration(ms);
  }
  const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  const seconds = String(whole % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};
