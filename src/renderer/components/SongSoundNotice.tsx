/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import { undoSongSound } from '../audio/songSoundSession';
import {
  endSongSoundNotice,
  useSongSoundNotice,
} from '../audio/songSoundNotice';
import { useTranslation } from '../utils/I18nContext';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import songSoundPresetName from './songSoundPresetName';
import '../styles/SongEqNotice.scss';

/**
 * Says that a saved sound just went on — the song's own, or its album's — and
 * offers it back.
 *
 * The Smart EQ memory's notice in every respect but its words
 * (`SongEqNotice.tsx`): the same corner, the same card and the same linger,
 * whose end takes it down — so it wears that notice's class, and waits its
 * turn behind it when both have something to say. Fading is not undoing: the
 * song's sound plays on for the song. Undo is not the recommendation — doing
 * nothing is — so it is the quiet style, and it is this play only. Forgetting
 * a song's sound is Auto EQ's panel's and the Library's.
 */
const SongSoundNotice = () => {
  const { t } = useTranslation();
  const current = useSongSoundNotice();
  const notice = current?.kind === 'lent' ? current : undefined;
  const isShown = useNoticeTurn('songSound', Boolean(notice));

  if (!notice || !isShown) {
    return null;
  }

  // The song playing, never the memory's own name for it: the memory keeps no
  // name for anything but the listener's own files (`songMemoryNames.ts`).
  const { title } = notice.identity;
  const preset =
    songSoundPresetName(notice.presetId, t) ?? t('songSound.noPresetName');
  const isAlbum = notice.owner === 'album';
  const album = notice.albumTitle ?? '';
  const heading = isAlbum
    ? t('songSound.albumNoticeTitle', { album })
    : t('songSound.noticeTitle');
  const body = isAlbum
    ? t('songSound.albumNoticeBody', { title, preset })
    : t('songSound.noticeBody', { title, preset });

  return (
    <CompactFrame
      // Keyed on the match, so a second one while this is up starts its
      // linger over rather than inheriting what was left of the first.
      key={notice.id}
      className="song-eq-notice"
      onAnimationEnd={(event) => {
        if (isOwnAnimationEnd(event, 'song-eq-notice-linger')) {
          endSongSoundNotice(notice.id);
        }
      }}
      role="dialog"
      aria-modal="false"
      aria-describedby="song-sound-notice-body"
      icon={<MenuIcon name="song" />}
      title={heading}
      titleId="song-sound-notice-title"
      closeLabel={t('support.close')}
      onClose={() => endSongSoundNotice(notice.id)}
      actions={
        <button
          type="button"
          className="button small subtle"
          onClick={undoSongSound}
        >
          {t('songSound.undo')}
        </button>
      }
    >
      <p id="song-sound-notice-body">{body}</p>
    </CompactFrame>
  );
};

export default SongSoundNotice;
