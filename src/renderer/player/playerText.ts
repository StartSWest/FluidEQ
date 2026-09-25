/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ITransportSource } from '../audio/transportSource';
import { formatDuration } from '../library/player/NowPlayingBar';
import type { useTranslation } from '../utils/I18nContext';
import { clockText } from './LedClock';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

/** What the deck's state lamp shows: playing, paused part-way, or stopped. */
export type TPlayerState = 'play' | 'pause' | 'stop';

/**
 * The line that scrolls across the player's screen: the artist, the title,
 * and the length, as Winamp's did.
 *
 * Takes the words alone, so the last thing played (`lastShown`) can fill it
 * after its player has gone; that one has no length to give.
 */
export const nowPlayingLine = (
  source:
    | (Pick<ITransportSource, 'title' | 'subtitle'> & { durationMs?: number })
    | undefined,
  nothing: string,
) => {
  if (!source) {
    return nothing;
  }
  const lead = source.subtitle ? `${source.subtitle} — ` : '';
  const durationMs = source.durationMs ?? 0;
  const length = durationMs > 0 ? ` (${formatDuration(durationMs)})` : '';
  return `${lead}${source.title}${length}`;
};

/** The five cells of the LED clock for a moment of the song. */
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
    return clockText(undefined, false);
  }
  return isTimeLeft
    ? clockText((durationMs - shownMs) / 1000, true)
    : clockText(shownMs / 1000, false);
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
  source: Pick<ITransportSource, 'owner' | 'origin'>,
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
      return t('library.remoteAudio', { name: source.origin ?? '' });
    default:
      return t('tabs.media');
  }
};
