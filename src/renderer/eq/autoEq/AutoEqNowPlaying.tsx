/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import type { ISongSoundNow } from '../../audio/songSoundSession';
import {
  goBackToSaved,
  type ISongCardSound,
  playingPresetName,
} from '../../audio/songCardSound';

/** The card's frame: the song's tile, its title and artist, then `children`. */
const NowCard = ({
  owner,
  title,
  artist,
  children,
}: {
  owner: string;
  title: string;
  artist?: string;
  children: ReactNode;
}) => (
  <div className={`eq-auto-now is-${owner}`}>
    <span className="eq-auto-now__tile" aria-hidden="true">
      <MenuIcon name="song" />
    </span>
    <div className="eq-auto-now__words">
      <span className="eq-auto-now__title">{title}</span>
      {artist && <span className="eq-auto-now__artist">{artist}</span>}
      {children}
    </div>
  </div>
);

/**
 * The song that plays, at the top of Auto EQ's panel, and what decides its
 * sound: its own saved sound, its album's, or the listener's own — the
 * answer of the ladder the mockup drew, in one line. A saved EQ that plays
 * is named in the preset's place: it is the whole sound, preset and all.
 *
 * Changed by hand over a song's or an album's sound, it names that sound —
 * "Album sound: Pop", in its own ink — then "Playing now: K-pop" under it,
 * and the one Restore there is (Ivan, 2026-11-21: "instead of putting two
 * buttons, should we have Restore or something that works for both cases,
 * and on top instead?"). It used to name the pick as the album's sound, and
 * Song sounds and Album sounds each carried a Back of their own.
 */
const AutoEqNowPlaying = ({
  now,
  eqName,
  back,
}: {
  now: ISongSoundNow;
  eqName?: string;
  /** The saved sound under a change made by hand (`backToSaved`). */
  back?: ISongCardSound['back'];
}) => {
  const { t } = useTranslation();
  const { identity } = now;
  if (!identity) {
    return (
      <div className="eq-auto-now is-empty">
        <span className="eq-auto-now__tile" aria-hidden="true">
          <MenuIcon name="song" />
        </span>
        <span className="eq-auto-now__title">{t('autoEq.now.nothing')}</span>
      </div>
    );
  }
  // What plays by its preset: a change made over a saved EQ is no longer the
  // saved EQ, so its name is not what plays then.
  const playing =
    now.presetId === undefined
      ? t('songSound.noPresetName')
      : playingPresetName(now.presetId, t);

  if (back) {
    return (
      <NowCard
        owner={back.owner === 'album' ? 'album' : 'song'}
        title={identity.title}
        artist={identity.artist}
      >
        <span className="eq-auto-now__plays">
          <span className="eq-auto-now__dot" aria-hidden="true" />
          <strong className="eq-auto-now__kept">
            {t(
              back.owner === 'album'
                ? 'autoEq.now.albumSound'
                : 'autoEq.now.songSound',
              { preset: back.name },
            )}
          </strong>
        </span>
        <span className="eq-auto-now__restore">
          <span className="eq-auto-now__why">
            {t('autoEq.now.playingNow', { preset: playing })}
          </span>
          {/* Going back is not a pick of the listener's own: what they
            picked stays the sound a song with nothing saved plays (`revert`
            in `songSoundChoices.ts`). */}
          <button
            type="button"
            className="button small subtle"
            onClick={() => goBackToSaved(back)}
          >
            {t('autoEq.restore', { preset: back.name })}
          </button>
        </span>
      </NowCard>
    );
  }

  let from = t('autoEq.now.yours');
  let why = t('autoEq.now.yoursWhy');
  if (now.owner === 'song') {
    from = t('autoEq.now.song');
    why = t('autoEq.now.songWhy');
  } else if (now.owner === 'album') {
    from = now.albumTitle
      ? t('autoEq.now.album', { album: now.albumTitle })
      : t('autoEq.now.albumUnnamed');
    why = t('autoEq.now.albumWhy');
  }
  return (
    <NowCard
      owner={now.owner ?? 'yours'}
      title={identity.title}
      artist={identity.artist}
    >
      <span className="eq-auto-now__plays">
        <span className="eq-auto-now__dot" aria-hidden="true" />
        <strong>{eqName ?? playing}</strong>
        <span>{from}</span>
      </span>
      <span className="eq-auto-now__why">{why}</span>
    </NowCard>
  );
};

export default AutoEqNowPlaying;
