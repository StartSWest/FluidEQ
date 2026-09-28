/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ITransportSource } from '../audio/transportSource';
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

/**
 * The same, as the Stage's signal path names it (`PlayerPath`): one word
 * where the bar's are two or three — the media tab by its short name, and
 * another computer by its own name, which is what tells two of them apart.
 */
export const sourceShortLabel = (
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
      return source.origin?.trim() ? source.origin : t('tabs.share');
    default:
      return t('tabs.mediaShort');
  }
};

/**
 * A file's format as a tag beside where it plays from, when the format has a
 * short name. `music-metadata` calls an MP3 "MPEG 1 Layer 3" and an Ogg file
 * "Vorbis I", which beside one word read as a sentence; FLAC, ALAC, AAC, Opus
 * and PCM keep theirs.
 */
export const codecTag = (codec: string | undefined) => {
  const name = codec?.trim().toUpperCase();
  return name !== undefined && /^[A-Z0-9]{2,5}$/.test(name) ? name : undefined;
};
