/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import {
  dontSaveSongSound,
  endSongSoundNotice,
  useSongSoundNotice,
} from '../audio/songSoundSession';
import { useTranslation } from '../utils/I18nContext';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import songSoundPresetName from './songSoundPresetName';
import '../styles/SongEqNotice.scss';

/**
 * Says, the moment a preset is put on while a song plays, that the song will
 * keep it (Ivan, 2026-10-02: "show a notification this preset will be saved
 * for x current song") — so a song remembering its sound is never a surprise
 * the next time it plays.
 *
 * The song memory's other card in every respect but its words
 * (`SongSoundNotice.tsx`): the same corner, look and linger, one of the two at
 * a time. Saving is what the switch asked for, so doing nothing is the
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
  const preset = songSoundPresetName(notice.presetId, t);
  const body = preset
    ? t('songSound.willSaveBody', { title, preset })
    : t('songSound.willSaveBodyNoPreset', { title });

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
      title={t('songSound.willSaveTitle')}
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
