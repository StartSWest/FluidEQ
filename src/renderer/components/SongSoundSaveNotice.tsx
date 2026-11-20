/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import { dontSaveSongSound } from '../audio/songSoundSession';
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
 * Says, the moment a preset is put on while a saved sound plays, that the
 * song will keep it (Ivan, 2026-10-02: "show a notification this preset will
 * be saved for x current song") — so a song remembering its sound is never a
 * surprise the next time it plays. Over its album's sound it is the song's
 * alone, and the card says the album keeps its own: albums change in the
 * Library only (Ivan, 2026-11-19).
 *
 * The song memory's other card in every respect but its words
 * (`SongSoundNotice.tsx`): the same corner, look and linger, one of the two at
 * a time. Saving is what a saved song asks for, so doing nothing is the
 * recommendation and Don't save wears the quiet style: it keeps this play out
 * of the memory, whatever the song ends with, and forgets nothing it already
 * holds.
 */
const SongSoundSaveNotice = () => {
  const { t } = useTranslation();
  const current = useSongSoundNotice();
  const notice = current?.kind === 'willSave' ? current : undefined;
  const isShown = useNoticeTurn('songSound', Boolean(notice));

  if (!notice || !isShown) {
    return null;
  }

  const { title } = notice.identity;
  const preset =
    songSoundPresetName(notice.presetId, t) ?? t('songSound.noPresetName');
  const isAlbum = notice.owner === 'album';
  const body = t(
    isAlbum ? 'songSound.willSaveAlbumBody' : 'songSound.willSaveBody',
    { title, preset },
  );

  return (
    <CompactFrame
      // Keyed on the pick, so a second one while this is up starts its
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
      aria-describedby="song-sound-save-notice-body"
      icon={<MenuIcon name="song" />}
      title={t(
        isAlbum ? 'songSound.willSaveAlbumTitle' : 'songSound.willSaveTitle',
      )}
      titleId="song-sound-save-notice-title"
      closeLabel={t('support.close')}
      onClose={() => endSongSoundNotice(notice.id)}
      actions={
        <button
          type="button"
          className="button small subtle"
          onClick={dontSaveSongSound}
        >
          {t('songSound.dontSave')}
        </button>
      }
    >
      <p id="song-sound-save-notice-body">{body}</p>
    </CompactFrame>
  );
};

export default SongSoundSaveNotice;
