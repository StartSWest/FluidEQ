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
import AutoEqManage, { type TManageTab } from './AutoEqManage';
import { type TViewStep, viewClass } from '../../utils/viewStep';
import useHasChanged from '../../utils/useHasChanged';
import AutoEqMeasureOnce from './AutoEqMeasureOnce';
import AutoEqSongHolds from './AutoEqSongHolds';
import AutoEqEqPicker from './AutoEqEqPicker';
import { backToSaved, storedPresetOf } from '../../audio/songCardSound';

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
 * song keeps (a saved EQ among what it can be given), Album sounds for what
 * the Library set for its album, Smart correction on top — and how much is
 * kept, with Manage. The saved EQs themselves live in the Save EQ menu beside
 * Clear (Ivan, 2026-11-20: "remove from there dude").
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
  const soundIndex = useSongSoundIndex();
  const { index, albums, eqs, eqById } = soundIndex;
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

  // The saved EQ a saved song follows, named where its preset would be: it is
  // the song's sound. A saved EQ the listener put on is the Save EQ menu's to
  // name, beside Clear (Ivan, 2026-11-20: "aqui debe decir el EQ que esta
  // cargado no en auto eq").
  const songEq = now.eqId === undefined ? undefined : eqById.get(now.eqId);

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

  const albumSound =
    album &&
    ((album.eqId === undefined ? undefined : eqById.get(album.eqId)?.name) ??
      songSoundPresetName(album.presetId, t) ??
      t('songSound.noPresetName'));
  // The sound under a change made by hand, named as the song's card names
  // it, so the panel and the card offer the same thing by the same name.
  const backTo = backToSaved(now, eqById, t, storedPresetOf(now, soundIndex));
  let albumLine = t('autoEq.albums.nothing');
  if (identity && !isLibrary) {
    albumLine = t('autoEq.albums.libraryOnly');
  } else if (album && albumSound !== undefined) {
    albumLine = t('autoEq.albums.set', {
      album: album.title,
      preset: albumSound,
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
      <AutoEqNowPlaying now={now} eqName={songEq?.name} back={backTo} />
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
          // approved explicit saving, 2026-11-20): saving is what this part
          // does, so it is the loud one and the only one. Going back is the
          // top card's Restore, one for the song's sound and the album's.
          <div key={songLineState} className={`eq-auto-part__line${swap}`}>
            <span className="eq-auto-part__changed" role="status">
              {t('autoEq.songs.changed')}
            </span>
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
            {now.owner === 'song' ? (
              // Kept, said with the song's own green tick: the line used to
              // be one more grey sentence among the part's words.
              <span className="eq-auto-part__saved">
                <MenuIcon name="check" />
                {songLine}
              </span>
            ) : (
              <span>{songLine}</span>
            )}
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
