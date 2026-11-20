/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import type { ISongSoundNow } from '../../audio/songSoundSession';
import songSoundPresetName from '../../components/songSoundPresetName';

/**
 * The song that plays, at the top of Auto EQ's panel, and what decides its
 * sound: its own saved sound, its album's, or the listener's own — the
 * answer of the ladder the mockup drew, in one line. A saved EQ that plays
 * is named in the preset's place: it is the whole sound, preset and all.
 */
const AutoEqNowPlaying = ({
  now,
  eqName,
}: {
  now: ISongSoundNow;
  eqName?: string;
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
  const preset =
    eqName ??
    (now.presetId === undefined
      ? undefined
      : songSoundPresetName(now.presetId, t)) ??
    t('songSound.noPresetName');
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
    <div className={`eq-auto-now is-${now.owner ?? 'yours'}`}>
      <span className="eq-auto-now__tile" aria-hidden="true">
        <MenuIcon name="song" />
      </span>
      <div className="eq-auto-now__words">
        <span className="eq-auto-now__title">{identity.title}</span>
        {identity.artist && (
          <span className="eq-auto-now__artist">{identity.artist}</span>
        )}
        <span className="eq-auto-now__plays">
          <span className="eq-auto-now__dot" aria-hidden="true" />
          <strong>{preset}</strong>
          <span>{from}</span>
        </span>
        <span className="eq-auto-now__why">{why}</span>
      </div>
    </div>
  );
};

export default AutoEqNowPlaying;
