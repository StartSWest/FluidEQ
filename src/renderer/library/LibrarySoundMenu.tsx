/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import log from 'electron-log/renderer';
import { libraryTrackIdentity } from 'common/songIdentity';
import type { TSavedSound } from 'common/songSound';
import type { IEqLink } from 'common/savedEq';
import { normalizeForSearch } from 'common/library/grouping';
import MenuIcon from '../icons/MenuIcon';
import TextInput from '../widgets/TextInput';
import { useTranslation } from '../utils/I18nContext';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import { useLiveSongSound } from '../audio/songSoundSession';
import useDspChainEntries from '../dsp/useDspChainEntries';
import { pickLibrarySongSounds, setAlbumSound } from '../utils/songSoundApi';
import { countText } from './libraryFormat';
import { eqNameOf, savedSoundName } from './librarySoundTag';
import AutoEqMiniCurve from '../eq/autoEq/AutoEqMiniCurve';

/** What the menu gives a sound to: Library songs, or a whole album. */
export type TLibrarySoundSubject =
  | { kind: 'songs'; trackIds: readonly string[] }
  | {
      kind: 'album';
      album: { key: string; title: string; artist: string };
      trackIds: readonly string[];
    };

const report = (error: unknown) =>
  log.error('A sound could not be kept for the Library', error);

/**
 * Library songs as songs: their identities, read from the Library itself, so
 * what is kept for each carries its own name and alias, as a save while it
 * plays does.
 */
const identitiesOf = async (trackIds: readonly string[]) => {
  const tracks = await window.electron.ipcRenderer.queryLibrary({
    type: 'tracks',
    ids: [...trackIds],
  });
  return tracks.flatMap((track) => {
    const identity = libraryTrackIdentity(track);
    return identity ? [identity] : [];
  });
};

/**
 * A sound picked in the Library (Ivan, 2026-11-19: "I should be able to pick
 * the sound preset from the lib too, apart from attaching presets to albums
 * and sounds"): for one song, a selection or a whole album — the same choices
 * for each. "Choose a preset…" keeps the preset alone, played with the
 * listener's own Tone and EQ; "Use what's playing now" keeps the whole sound.
 * The listener's saved EQs stand first in that list, above the presets, with
 * one search for both (the mockup Ivan approved, 2026-11-20): a song given one
 * follows it, and plays it whole whatever the listener's EQ is that day.
 * A song picked here is the song's own, exactly as a save while it plays
 * makes, and beats its album's.
 *
 * A page of the menu it opens from (`LibraryTrackMenu`, the album's own
 * picker), as Add to playlist is: the menu has no submenus (`AnchoredMenu`).
 */
const LibrarySoundMenu = ({
  subject,
  onBack,
  onClose,
}: {
  subject: TLibrarySoundSubject;
  /** Back to the page the caller was showing, where there is one. */
  onBack?: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [isChoosing, setIsChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const soundIndex = useSongSoundIndex();
  const { songs, albums, eqs } = soundIndex;
  const live = useLiveSongSound();
  const { entries, groupLabel } = useDspChainEntries('music');
  const nameOf = (sound: { presetId: string; eqId?: string }) =>
    savedSoundName(
      { presetId: sound.presetId, eqName: eqNameOf(soundIndex, sound.eqId) },
      t,
    );

  const { trackIds } = subject;
  const isOne = subject.kind === 'songs' && trackIds.length === 1;
  const ownCount = trackIds.filter((id) => songs.has(id)).length;
  const album =
    subject.kind === 'album' ? albums.get(subject.album.key) : undefined;
  const single = isOne ? songs.get(trackIds[0]) : undefined;

  const keep = (sound: TSavedSound | IEqLink | null) => {
    onClose();
    if (subject.kind === 'album' && sound !== null) {
      const { key, title, artist } = subject.album;
      setAlbumSound(key, title, artist, sound).catch(report);
      return;
    }
    identitiesOf(trackIds)
      .then((identities) => pickLibrarySongSounds(identities, sound))
      .catch(report);
  };

  if (isChoosing) {
    const needle = normalizeForSearch(search);
    const isFound = (name: string) =>
      needle === '' || normalizeForSearch(name).includes(needle);
    const shown = entries.filter((entry) => isFound(entry.name));
    const shownEqs = [...eqs]
      .filter((eq) => isFound(eq.name))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    let lastGroup: string | undefined;
    return (
      <>
        <button
          type="button"
          className="library-list__menu-back"
          onClick={() => setIsChoosing(false)}
        >
          <MenuIcon name="back" className="library-list__menu-icon" />
          <span>{t('library.sound.choose')}</span>
        </button>
        <div className="library-list__menu-field">
          <TextInput
            value={search}
            ariaLabel={t('library.sound.search')}
            placeholder={t('library.sound.search')}
            isDisabled={false}
            errorMessage=""
            handleChange={setSearch}
            handleSubmit={setSearch}
            handleEscape={() => setSearch('')}
          />
        </div>
        <div className="library-sound-menu__list">
          {shownEqs.length > 0 && (
            <p className="library-list__menu-subject">
              {t('autoEq.eqs.title')}
            </p>
          )}
          {shownEqs.map((eq) => (
            <div key={eq.id} role="none">
              <button type="button" onClick={() => keep({ eqId: eq.id })}>
                <AutoEqMiniCurve
                  filters={eq.sound.filters}
                  width={40}
                  height={16}
                  className="library-sound-menu__curve"
                />
                <span>{eq.name}</span>
              </button>
            </div>
          ))}
          {shown.map((entry) => {
            const isFirst = lastGroup === undefined;
            let heading =
              entry.group !== lastGroup ? groupLabel(entry.group) : '';
            // Under the saved EQs, the presets start under a heading of their
            // own even where their first group has none (None's), or None
            // reads as one more saved EQ.
            if (isFirst && heading === '' && shownEqs.length > 0) {
              heading = t('dsp.presets');
            }
            lastGroup = entry.group;
            return (
              <div key={`${entry.group}:${entry.id}`} role="none">
                {heading && (
                  <p className="library-list__menu-subject">{heading}</p>
                )}
                <button
                  type="button"
                  onClick={() => keep({ presetId: entry.id })}
                >
                  <span
                    className="library-sound-menu__glyph"
                    aria-hidden="true"
                  >
                    {entry.icon}
                  </span>
                  <span>{entry.name}</span>
                </button>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  let current: string;
  if (subject.kind === 'album') {
    current = album
      ? t('library.sound.albumIs', { preset: nameOf(album) })
      : t('library.sound.albumNone');
  } else if (single) {
    current = t('library.sound.ownIs', { preset: nameOf(single) });
  } else if (isOne) {
    current = t('library.sound.noOwn');
  } else {
    current = t('library.sound.someOwn', {
      count: ownCount,
      total: countText(t, 'library.trackCount', trackIds.length),
    });
  }

  return (
    <>
      {onBack ? (
        <button
          type="button"
          className="library-list__menu-back"
          onClick={onBack}
        >
          <MenuIcon name="back" className="library-list__menu-icon" />
          <span>
            {t(
              subject.kind === 'album'
                ? 'library.sound.albumTitle'
                : 'library.sound.title',
            )}
          </span>
        </button>
      ) : (
        <p className="library-list__menu-subject">
          {t(
            subject.kind === 'album'
              ? 'library.sound.albumTitle'
              : 'library.sound.title',
          )}
        </p>
      )}
      <p className="library-sound-menu__current">{current}</p>
      <button
        type="button"
        aria-haspopup="menu"
        onClick={() => setIsChoosing(true)}
      >
        <MenuIcon name="eqBars" className="library-list__menu-icon" />
        <span>{t('library.sound.choose')}</span>
        <span className="library-list__menu-more" aria-hidden="true">
          ›
        </span>
      </button>
      <button type="button" disabled={!live} onClick={() => live && keep(live)}>
        <MenuIcon name="waveform" className="library-list__menu-icon" />
        <span>{t('library.sound.usePlaying')}</span>
        <span className="library-list__menu-key" aria-hidden="true">
          {t('library.sound.usePlayingHint')}
        </span>
      </button>
      <div className="library-list__menu-rule" role="none" />
      <button
        type="button"
        disabled={ownCount === 0}
        onClick={() => keep(null)}
      >
        <MenuIcon name="clear" className="library-list__menu-icon" />
        <span>
          {subject.kind === 'album' || !isOne
            ? t('library.sound.forgetTheirs')
            : t('library.sound.forgetOwn')}
        </span>
        {ownCount > 0 && !isOne && (
          <span className="library-list__menu-key" aria-hidden="true">
            {countText(t, 'library.trackCount', ownCount)}
          </span>
        )}
      </button>
      {subject.kind === 'album' && (
        <button
          type="button"
          disabled={!album}
          onClick={() => {
            onClose();
            const { key, title, artist } = subject.album;
            setAlbumSound(key, title, artist, null).catch(report);
          }}
        >
          <MenuIcon name="trash" className="library-list__menu-icon" />
          <span>{t('library.sound.noAlbumSound')}</span>
        </button>
      )}
    </>
  );
};

export default LibrarySoundMenu;
