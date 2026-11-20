/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import log from 'electron-log/renderer';
import { libraryTrackIdentity } from 'common/songIdentity';
import { normalizeForSearch } from 'common/library/grouping';
import MenuIcon from '../../icons/MenuIcon';
import TextInput from '../../widgets/TextInput';
import { useTranslation } from '../../utils/I18nContext';
import { useSongSoundIndex } from '../../audio/songSoundIndex';
import songSoundPresetName from '../../components/songSoundPresetName';
import {
  forgetSongSoundsOf,
  pickLibrarySongSounds,
  setAlbumSound,
} from '../../utils/songSoundApi';
import { useLiveSongSound } from '../../audio/songSoundSession';
import { useSavedEqStates } from '../../audio/savedEqActions';
import AutoEqEqRow from './AutoEqEqRow';
import { eqNameOf } from '../../library/librarySoundTag';
import { orderSavedEqs, rowStateOf } from './AutoEqSavedEqs';

export type TManageTab = 'songs' | 'albums' | 'eqs';

const TAB_LABEL = {
  songs: 'autoEq.manage.songs',
  albums: 'autoEq.manage.albums',
  eqs: 'autoEq.eqs.title',
} as const;

/** Reported and left standing: a forget that fails keeps what it was asked
 * to remove, which is the safe way to fail. */
const report = (error: unknown) =>
  log.error('A saved sound could not be forgotten', error);

/**
 * Manage: every Library song and album with a sound of its own, searchable,
 * each with Forget, and Forget all — the only thing that removes them (Reset
 * all settings turns Auto EQ off and keeps them, like playlists).
 *
 * Other players' songs are counted and not listed: the store never keeps
 * their names (`songMemoryNames.ts`, Ivan 2026-10-26), so they are forgotten
 * together.
 *
 * Saved EQs have a tab of their own, every one with the panel's own row (Put
 * on, Update, Rename, Delete): the panel lists three and See all opens here.
 * Forget all is not offered there — a saved EQ is deleted one at a time.
 */
const AutoEqManage = ({
  initialTab,
  onBack,
}: {
  initialTab: TManageTab;
  onBack: () => void;
}) => {
  const { t } = useTranslation();
  const soundIndex = useSongSoundIndex();
  const { index, eqs } = soundIndex;
  const live = useLiveSongSound();
  const eqStates = useSavedEqStates(eqs);
  const [tab, setTab] = useState<TManageTab>(initialTab);
  const [search, setSearch] = useState('');
  // Forget all asks once more before it removes anything: there is no undo.
  const [isConfirming, setIsConfirming] = useState(false);
  const needle = normalizeForSearch(search);
  const matches = (...words: Array<string | undefined>) =>
    needle === '' ||
    words.some((word) => word && normalizeForSearch(word).includes(needle));

  const songs = (index?.songs ?? [])
    .filter((song) => matches(song.title, song.artist))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const albums = (index?.albums ?? []).filter((album) =>
    matches(album.title, album.artist),
  );
  const otherCount = index?.otherCount ?? 0;
  const shownEqs = orderSavedEqs(eqs, eqStates).filter((eq) =>
    matches(eq.name),
  );
  const countOf = (one: TManageTab) => {
    if (one === 'songs') {
      return (index?.songs.length ?? 0) + otherCount;
    }
    return one === 'albums' ? (index?.albums.length ?? 0) : eqs.length;
  };
  const presetOf = (id: string) =>
    songSoundPresetName(id, t) ?? t('songSound.noPresetName');
  const whatOf = ({
    presetId,
    isWhole,
    eqId,
  }: {
    presetId: string;
    isWhole: boolean;
    eqId?: string;
  }) => {
    // A saved EQ is named as itself: it is the whole sound already.
    const eqName = eqNameOf(soundIndex, eqId);
    if (eqName !== undefined) {
      return eqName;
    }
    return isWhole
      ? t('autoEq.manage.wholeSound', { preset: presetOf(presetId) })
      : presetOf(presetId);
  };

  const forgetAll = () => {
    setIsConfirming(false);
    if (tab === 'albums') {
      forgetSongSoundsOf('albums').catch(report);
      return;
    }
    Promise.all([
      forgetSongSoundsOf('library'),
      forgetSongSoundsOf('other'),
    ]).catch(report);
  };

  return (
    <div className="eq-auto-panel__content eq-auto-manage">
      <header className="eq-auto-panel__head">
        <button
          type="button"
          className="button small subtle eq-auto-manage__back"
          aria-label={t('autoEq.manage.back')}
          title={t('autoEq.manage.back')}
          onClick={onBack}
        >
          <MenuIcon name="back" />
        </button>
        <strong>{t('autoEq.manage.title')}</strong>
      </header>
      <div className="eq-auto-manage__tabs" role="tablist">
        {(['songs', 'albums', 'eqs'] as const).map((one) => (
          <button
            key={one}
            type="button"
            role="tab"
            aria-selected={tab === one}
            className={`eq-auto-manage__tab${tab === one ? ' is-active' : ''}`}
            onClick={() => {
              setTab(one);
              setIsConfirming(false);
            }}
          >
            {t(TAB_LABEL[one])}
            <span className="eq-auto-manage__count">{countOf(one)}</span>
          </button>
        ))}
      </div>
      <TextInput
        value={search}
        ariaLabel={t('autoEq.manage.search')}
        placeholder={t('autoEq.manage.search')}
        isDisabled={false}
        errorMessage=""
        handleChange={setSearch}
        handleSubmit={setSearch}
        handleEscape={() => setSearch('')}
      />
      {tab === 'eqs' && (
        <ul className="eq-auto-eqs eq-auto-manage__eqs">
          {shownEqs.map((eq) => (
            <AutoEqEqRow
              key={eq.id}
              eq={eq}
              state={rowStateOf(eq, eqStates)}
              canPutOn={!!live}
            />
          ))}
          {shownEqs.length === 0 && (
            <li className="eq-auto-manage__empty">
              {t(needle === '' ? 'autoEq.eqs.empty' : 'autoEq.manage.noMatch')}
            </li>
          )}
        </ul>
      )}
      {tab !== 'eqs' && (
        <ul className="eq-auto-manage__list">
          {tab === 'songs' &&
            songs.map((song) => (
              <li key={song.trackId}>
                <span className="eq-auto-manage__words">
                  <strong>{song.title}</strong>
                  <span>
                    {[song.artist, whatOf(song)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => {
                    const identity = libraryTrackIdentity({
                      id: song.trackId,
                      title: song.title,
                      artist: song.artist,
                      kind: 'audio',
                    });
                    if (identity) {
                      pickLibrarySongSounds([identity], null).catch(report);
                    }
                  }}
                >
                  {t('autoEq.manage.forget')}
                </button>
              </li>
            ))}
          {tab === 'songs' && otherCount > 0 && needle === '' && (
            <li className="eq-auto-manage__others">
              <span className="eq-auto-manage__words">
                <strong>
                  {t('autoEq.manage.others', { count: otherCount })}
                </strong>
                <span>{t('autoEq.manage.othersHint')}</span>
              </span>
              <button
                type="button"
                className="button small subtle"
                onClick={() => forgetSongSoundsOf('other').catch(report)}
              >
                {t('autoEq.manage.forget')}
              </button>
            </li>
          )}
          {tab === 'albums' &&
            albums.map((album) => (
              <li key={album.key}>
                <span className="eq-auto-manage__words">
                  <strong>{album.title}</strong>
                  <span>
                    {[album.artist, whatOf(album)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() =>
                    setAlbumSound(
                      album.key,
                      album.title,
                      album.artist,
                      null,
                    ).catch(report)
                  }
                >
                  {t('autoEq.manage.forget')}
                </button>
              </li>
            ))}
          {((tab === 'songs' &&
            songs.length === 0 &&
            (otherCount === 0 || needle !== '')) ||
            (tab === 'albums' && albums.length === 0)) && (
            <li className="eq-auto-manage__empty">
              {t(
                needle === '' ? 'autoEq.manage.empty' : 'autoEq.manage.noMatch',
              )}
            </li>
          )}
        </ul>
      )}
      {tab !== 'eqs' && (
        <footer className="eq-auto-panel__foot">
          <span>{t('autoEq.manage.resetKeeps')}</span>
          {isConfirming ? (
            <button type="button" className="button small" onClick={forgetAll}>
              {t('autoEq.manage.forgetAllConfirm')}
            </button>
          ) : (
            <button
              type="button"
              className="button small subtle"
              onClick={() => setIsConfirming(true)}
            >
              {t('autoEq.manage.forgetAll')}
            </button>
          )}
        </footer>
      )}
    </div>
  );
};

export default AutoEqManage;
