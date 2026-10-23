/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import {
  endSongSoundNotice,
  forgetNoticedSongSound,
  undoSongSound,
  useSongSoundNotice,
} from '../audio/songSoundSession';
import { useTranslation } from '../utils/I18nContext';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import songSoundPresetName from './songSoundPresetName';
import '../styles/SongEqNotice.scss';

/**
 * Says that a song's own sound just went on, and offers it back.
 *
 * The Smart EQ memory's notice in every respect but its words
 * (`SongEqNotice.tsx`): the same corner, the same card and the same linger,
 * whose end takes it down — so it wears that notice's class, and waits its
 * turn behind it when both have something to say. Fading is not undoing: the
 * song's sound plays on for the song. Neither button is the recommendation —
 * doing nothing is — so both are the quiet style. Undo is this play only;
 * Forget is Undo and the memory gone.
 */
const SongSoundNotice = () => {
  const { t } = useTranslation();
  const current = useSongSoundNotice();
  const notice = current?.kind === 'lent' ? current : undefined;
  const isShown = useNoticeTurn('songSound', Boolean(notice));

  if (!notice || !isShown) {
    return null;
  }

  const { entry } = notice;
  const preset = songSoundPresetName(entry.sound.presetId, t);
  const body = preset
    ? t('songSound.noticeBody', { title: entry.title, preset })
    : t('songSound.noticeBodyNoPreset', { title: entry.title });

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
      title={t('songSound.noticeTitle')}
      titleId="song-sound-notice-title"
      closeLabel={t('support.close')}
      onClose={() => endSongSoundNotice(notice.id)}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={undoSongSound}
          >
            {t('songSound.undo')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={forgetNoticedSongSound}
          >
            {t('songSound.forget')}
          </button>
        </>
      }
    >
      <p id="song-sound-notice-body">{body}</p>
    </CompactFrame>
  );
};

export default SongSoundNotice;
