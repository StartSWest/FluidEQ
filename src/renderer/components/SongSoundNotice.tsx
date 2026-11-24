/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import {
  endSongSoundNotice,
  useSongSoundNotice,
} from '../audio/songSoundNotice';
import { useTranslation } from '../utils/I18nContext';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import { DockedNotice } from './NoticeDock';
import songSoundPresetName from './songSoundPresetName';
import '../styles/SongEqNotice.scss';

/** Stands for the preset's name while the sentence is translated. */
const PRESET_MARK = '\u0000';

/**
 * The sentence with the preset's name in it set apart: the name is what the
 * notice is for, and in plain text among the song's title it was hard to
 * pick out (Ivan, 2026-11-20: "not really clear which preset, make it more
 * clear, like in bold or primary or secondary colour"). Translated with a
 * mark in the name's place and split there, so every language keeps its own
 * word order.
 */
const withPresetSetApart = (sentence: string, preset: string) =>
  sentence.split(PRESET_MARK).flatMap((part, index) =>
    index === 0
      ? [part]
      : [
          <strong key={part + String(index)} className="song-eq-notice__preset">
            {preset}
          </strong>,
          part,
        ],
  );

/**
 * Says that a saved sound just went on — the song's own, or its album's — and
 * offers it back.
 *
 * The Smart EQ memory's notice in every respect but its words
 * (`SongEqNotice.tsx`): the same corner, the same card and the same linger,
 * whose end takes it down — so it wears that notice's class, and waits its
 * turn behind it when both have something to say. Fading is not undoing: the
 * song's sound plays on for the song. It carries no Undo (Ivan, 2026-11-20:
 * "remove the undo button from the notification"): going back is Auto EQ's
 * panel's Restore, and forgetting a song's sound is the panel's and the
 * Library's.
 */
const SongSoundNotice = () => {
  const { t } = useTranslation();
  const notice = useSongSoundNotice();
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
  const body = withPresetSetApart(
    isAlbum
      ? t('songSound.albumNoticeBody', { title, preset: PRESET_MARK })
      : t('songSound.noticeBody', { title, preset: PRESET_MARK }),
    preset,
  );

  return (
    <DockedNotice>
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
      >
        <p id="song-sound-notice-body">{body}</p>
      </CompactFrame>
    </DockedNotice>
  );
};

export default SongSoundNotice;
