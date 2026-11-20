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
  revertSongSound,
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
import AutoEqManage, { type TManageTab } from './AutoEqManage';
import { type TViewStep, viewClass } from '../../utils/viewStep';
import useHasChanged from '../../utils/useHasChanged';
import AutoEqMeasureOnce from './AutoEqMeasureOnce';
import AutoEqSongHolds from './AutoEqSongHolds';
import AutoEqSavedEqs from './AutoEqSavedEqs';
import AutoEqEqPicker from './AutoEqEqPicker';
import { useSavedEqStates } from '../../audio/savedEqActions';

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
 * that plays and what decides its sound, the parts — Song sounds for what a
 * song keeps, Album sounds for what the Library set for its album, Saved EQs
 * the listener keeps under a name, Smart correction on top — and how much is
 * kept, with Manage.
 *
 * Flat inside one surface (Ivan, 2026-11-19: no boxes in boxes, no shadows):
 * the parts are parted by a hairline and their headings, as the DSP page's
 * blocks are.
 */
const AutoEqPanel = ({ button }: { button: TAutoEqButton }) => {
  const { t } = useTranslation();
  const [managing, setManaging] = useState<TManageTab | undefined>();
  // Which way the view was reached, so Manage slides in from the right and
  // the panel back from the left.
  const [step, setStep] = useState<TViewStep>();
  const manage = (tab: TManageTab) => {
    setManaging(tab);
    setStep('forward');
  };
  const parts = useSongSoundParts();
  const isHeld = useSongSoundHeld();
  const now = useSongSoundNow();
  const { index, albums, eqs, eqById } = useSongSoundIndex();
  const eqStates = useSavedEqStates(eqs);
  // The song's line swaps in when its state does — Changed, Saved, nothing
  // saved — and not as the panel opens.
  const songLineState = `${now.isChanged ? 'changed' : (now.owner ?? 'own')}`;
  const swap = useHasChanged(songLineState) ? ' is-swap' : '';

  if (managing) {
    return (
      <div className={viewClass(step)}>
        <AutoEqManage
          initialTab={managing}
          onBack={() => {
            setManaging(undefined);
            setStep('back');
          }}
        />
      </div>
    );
  }

  // The saved EQ that plays, named wherever a preset would be: the one a
  // saved song follows, or one the listener's own sound is exactly.
  const songEq = now.eqId === undefined ? undefined : eqById.get(now.eqId);
  const playingEq =
    songEq ??
    (eqStates.playingId === undefined
      ? undefined
      : eqById.get(eqStates.playingId));

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
  if (identity && now.owner === 'song' && songEq) {
    songLine = t('autoEq.songs.follows', { name: songEq.name });
  } else if (identity && now.owner === 'song') {
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
        (album.eqId === undefined ? undefined : eqById.get(album.eqId)?.name) ??
        songSoundPresetName(album.presetId, t) ??
        t('songSound.noPresetName'),
    });
  } else if (identity?.albumKey !== undefined) {
    albumLine = t('autoEq.albums.none');
  }

  return (
    <div className={`eq-auto-panel__content ${viewClass(step)}`}>
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
      <AutoEqNowPlaying now={now} eqName={playingEq?.name} />
      <AutoEqPart
        id="eq-auto-songs"
        title={t('autoEq.songs.title')}
        hint={t('autoEq.songs.hint')}
        isOn={parts.songs}
        onToggle={() => setSongSoundParts({ ...parts, songs: !parts.songs })}
      >
        {now.saved && <AutoEqSongHolds sound={now.saved} />}
        {now.isChanged ? (
          // Changed over a saved sound, and kept only when saved (Ivan
          // approved explicit saving, 2026-11-20): saving is the suggestion,
          // so it wears the loud style, and going back the quiet one.
          <div key={songLineState} className={`eq-auto-part__line${swap}`}>
            <span className="eq-auto-part__changed" role="status">
              {t('autoEq.songs.changed')}
            </span>
            <button
              type="button"
              className="button small subtle"
              onClick={revertSongSound}
            >
              {t('autoEq.songs.revert')}
            </button>
            <button
              type="button"
              className="button small"
              disabled={!now.canSave}
              onClick={saveSongSoundNow}
            >
              {t('autoEq.songs.saveChanges')}
            </button>
          </div>
        ) : (
          // With "Use a saved EQ" beside Save for this song the line has the
          // row to itself and the two buttons stand together under it: in a
          // row of three the second button fell to a line of its own.
          <div
            key={songLineState}
            className={`eq-auto-part__line${swap}${
              eqs.length > 0 && now.owner !== 'song' ? ' is-stacked' : ''
            }`}
          >
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
              <>
                <AutoEqEqPicker isDisabled={!now.canSave} />
                {/* The loud one: keeping a sound for a song is what this part
                  is for, and nothing else here does it while the song
                  plays. */}
                <button
                  type="button"
                  className="button small"
                  disabled={!now.canSave}
                  onClick={saveSongSoundNow}
                >
                  {t('autoEq.songs.save')}
                </button>
              </>
            )}
          </div>
        )}
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
      <AutoEqSavedEqs onSeeAll={() => manage('eqs')} />
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
          onClick={() => manage('songs')}
        >
          {t('autoEq.manage')}
        </button>
        <AutoEqMeasureOnce isBalancing={button.isBalancing} />
      </footer>
    </div>
  );
};

export default AutoEqPanel;
