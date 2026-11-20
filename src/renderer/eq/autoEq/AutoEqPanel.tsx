/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useState } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import Switch from '../../widgets/Switch';
import { useTranslation } from '../../utils/I18nContext';
import {
  forgetPlayingSongSound,
  saveSongSoundNow,
  setSongSoundParts,
  useSongSoundHeld,
  useSongSoundNow,
  useSongSoundParts,
} from '../../audio/songSoundSession';
import { useSongSoundIndex } from '../../audio/songSoundIndex';
import songSoundPresetName from '../../components/songSoundPresetName';
import { countText } from '../../library/libraryFormat';
import type { TAutoEqButton } from './useAutoEqButton';
import AutoEqNowPlaying from './AutoEqNowPlaying';
import AutoEqSmartPart from './AutoEqSmartPart';
import AutoEqManage from './AutoEqManage';
import AutoEqMeasureOnce from './AutoEqMeasureOnce';

/** One of the panel's parts: its name and line, its switch, what it holds. */
const AutoEqPart = ({
  id,
  title,
  hint,
  isOn,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  isOn: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) => (
  <section className="eq-auto-part" aria-labelledby={`${id}-title`}>
    <div className="eq-auto-part__head">
      <div className="eq-auto-part__words">
        <strong id={`${id}-title`}>{title}</strong>
        <span>{hint}</span>
      </div>
      <Switch
        id={id}
        isOn={isOn}
        isDisabled={false}
        handleToggle={onToggle}
        ariaLabel={title}
      />
    </div>
    {isOn && children}
  </section>
);

/**
 * Auto EQ's panel (the 2026-11-19 mockup, Ivan's yes on 2026-11-20): the song
 * that plays and what decides its sound, the three parts — Song sounds for
 * what a song keeps, Album sounds for what the Library set for its album,
 * Smart correction on top — and how much is kept, with Manage.
 *
 * Flat inside one surface (Ivan, 2026-11-19: no boxes in boxes, no shadows):
 * the parts are parted by a hairline and their headings, as the DSP page's
 * blocks are.
 */
const AutoEqPanel = ({ button }: { button: TAutoEqButton }) => {
  const { t } = useTranslation();
  const [isManaging, setIsManaging] = useState(false);
  const parts = useSongSoundParts();
  const isHeld = useSongSoundHeld();
  const now = useSongSoundNow();
  const { index, albums } = useSongSoundIndex();

  if (isManaging) {
    return <AutoEqManage onBack={() => setIsManaging(false)} />;
  }

  const songCount = (index?.songs.length ?? 0) + (index?.otherCount ?? 0);
  const albumCount = index?.albums.length ?? 0;
  const { identity } = now;
  const isLibrary =
    identity?.source === 'library' || identity?.source === 'karaoke';
  const album =
    identity?.albumKey === undefined
      ? undefined
      : albums.get(identity.albumKey);

  let songLine = t('autoEq.songs.nothing');
  if (identity && now.owner === 'song') {
    songLine = t('autoEq.songs.saved');
  } else if (identity) {
    songLine = t('autoEq.songs.none');
  }

  let albumLine = t('autoEq.albums.nothing');
  if (identity && !isLibrary) {
    albumLine = t('autoEq.albums.libraryOnly');
  } else if (album) {
    albumLine = t('autoEq.albums.set', {
      album: album.title,
      preset:
        songSoundPresetName(album.presetId, t) ?? t('songSound.noPresetName'),
    });
  } else if (identity?.albumKey !== undefined) {
    albumLine = t('autoEq.albums.none');
  }

  return (
    <div className="eq-auto-panel__content">
      <header className="eq-auto-panel__head">
        <strong>{t('autoEq.title')}</strong>
        <span>{t('autoEq.tagline')}</span>
      </header>
      {isHeld && (parts.songs || parts.albums) && (
        <p className="eq-auto-panel__aside" role="status">
          <MenuIcon name="pause" />
          <span>{t('autoEq.aside')}</span>
        </p>
      )}
      <AutoEqNowPlaying now={now} />
      <AutoEqPart
        id="eq-auto-songs"
        title={t('autoEq.songs.title')}
        hint={t('autoEq.songs.hint')}
        isOn={parts.songs}
        onToggle={() => setSongSoundParts({ ...parts, songs: !parts.songs })}
      >
        <div className="eq-auto-part__line">
          <span>{songLine}</span>
          {now.owner === 'song' ? (
            <button
              type="button"
              className="button small subtle"
              disabled={isHeld}
              onClick={forgetPlayingSongSound}
            >
              {t('autoEq.songs.forget')}
            </button>
          ) : (
            // The loud one: keeping a sound for a song is what this part is
            // for, and nothing else here does it while the song plays.
            <button
              type="button"
              className="button small"
              disabled={!now.canSave}
              onClick={saveSongSoundNow}
            >
              {t('autoEq.songs.save')}
            </button>
          )}
        </div>
      </AutoEqPart>
      <AutoEqPart
        id="eq-auto-albums"
        title={t('autoEq.albums.title')}
        hint={t('autoEq.albums.hint')}
        isOn={parts.albums}
        onToggle={() => setSongSoundParts({ ...parts, albums: !parts.albums })}
      >
        <div className="eq-auto-part__line">
          <span>{albumLine}</span>
        </div>
      </AutoEqPart>
      <AutoEqSmartPart button={button} />
      <footer className="eq-auto-panel__foot">
        <span>
          {t('autoEq.savedCount', {
            songs: countText(t, 'library.trackCount', songCount),
            albums: countText(t, 'library.albumCount', albumCount),
          })}
        </span>
        <button
          type="button"
          className="button small subtle"
          onClick={() => setIsManaging(true)}
        >
          {t('autoEq.manage')}
        </button>
        <AutoEqMeasureOnce isBalancing={button.isBalancing} />
      </footer>
    </div>
  );
};

export default AutoEqPanel;
