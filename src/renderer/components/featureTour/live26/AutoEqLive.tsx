/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import type { ISongSoundNow } from '../../../audio/songSoundSession';
import { AutoEqPart } from '../../../eq/autoEq/AutoEqPanel';
import AutoEqNowPlaying from '../../../eq/autoEq/AutoEqNowPlaying';
import { AutoEqSmartStatusView } from '../../../eq/autoEq/AutoEqSmartStatus';
import MenuIcon from '../../../icons/MenuIcon';
import { countText } from '../../../library/libraryFormat';
import songSoundPresetName from '../../songSoundPresetName';
import { useTranslation } from '../../../utils/I18nContext';
import type {
  ISmartEqPreview,
  ISmartEqPreviewRegion,
} from '../../../utils/smartEqPreview';
import Switch from '../../../widgets/Switch';
import useTourFrames from '../useTourFrames';

const nothing = () => undefined;

/** Each song's turn on the panel, seconds. */
const TURN = 9;
const LISTEN_UNTIL = 4.5;
const SETTLE_UNTIL = 6.5;

interface IMadeUpSong {
  title: string;
  artist: string;
  owner?: 'song' | 'album';
  presetId: string;
  album?: string;
}

/**
 * Three songs in turn, one for each way a song gets its sound: its own
 * saved sound, its album's, and the listener's own. Made up, never the
 * listener's: the drawing reads no library and no saved sound.
 */
const SONGS: readonly IMadeUpSong[] = [
  {
    title: 'Midnight Drive',
    artist: 'Nova Lane',
    owner: 'song',
    presetId: 'warm',
  },
  {
    title: 'Glass Harbour',
    artist: 'The Tidelines',
    owner: 'album',
    presetId: 'punch',
    album: 'Low Tide',
  },
  { title: 'Paper Planes', artist: 'June Avery', presetId: 'balanced' },
];

const RANGES = ['bass', 'low mids', 'mids', 'presence', 'treble'] as const;

/**
 * Smart correction on a song `seconds` into its turn: Listening while the
 * ranges gather, Settling, then Held for this song, as `useSmartEqPreview`
 * reports a real song's.
 */
const previewAt = (seconds: number): ISmartEqPreview => {
  let phase: ISmartEqPreview['phase'] = 'held';
  if (seconds < LISTEN_UNTIL) {
    phase = 'listening';
  } else if (seconds < SETTLE_UNTIL) {
    phase = 'settling';
  }
  const gathered = Math.min(1, seconds / SETTLE_UNTIL);
  const regions: ISmartEqPreviewRegion[] = RANGES.map((label, index) => {
    // The bass and the treble are heard last, as on most records.
    const confidence = Math.min(
      1,
      gathered * (1.25 - Math.abs(index - 2) * 0.12),
    );
    return {
      label,
      lowFrequency: 0,
      highFrequency: 0,
      centreFrequency: 0,
      confidence,
      isCovered: confidence >= 1,
      liveDb: 0,
      typicalDb: 0,
    };
  });
  return {
    phase,
    heardMs: Math.min(seconds, SETTLE_UNTIL) * 1000,
    isSilent: false,
    regions,
    meanCoverage: gathered,
    // As on the FluidEQ Engine, the default: the correction comes in while
    // it listens.
    isHeardForming: true,
    missing: [],
    holdId: 0,
    departId: 0,
  };
};

/**
 * Auto EQ's panel as the EQ page opens it, on a made-up song: the song card
 * and what decides its sound, Song sounds, Album sounds and Smart
 * correction, with the counts and Manage at its foot. The song card and
 * Smart correction's line are the panel's own components
 * (`AutoEqNowPlaying`, `AutoEqSmartStatusView`); the rest is the panel's
 * markup around them, because the panel itself reads the listener's own
 * songs and saved sounds and a picture must never show those.
 */
export default function AutoEqLive() {
  const { t } = useTranslation();
  const [moment, setMoment] = useState({ song: 0, into: 0 });
  useTourFrames(
    (seconds) => {
      const song = Math.floor(seconds / TURN) % SONGS.length;
      // Half-second steps, as the panel's own heard time moves.
      const into = Math.floor((seconds % TURN) * 2) / 2;
      setMoment((before) =>
        before.song === song && before.into === into ? before : { song, into },
      );
    },
    { still: SETTLE_UNTIL + 1 },
  );

  const song = SONGS[moment.song];
  const now: ISongSoundNow = {
    identity: {
      source: 'library',
      title: song.title,
      artist: song.artist,
      key: song.title,
    },
    isPlaying: true,
    owner: song.owner,
    presetId: song.presetId,
    albumTitle: song.album,
    canSave: true,
    isChanged: false,
  };
  const preset = songSoundPresetName(song.presetId, t) ?? '';

  return (
    <div className="eq-auto-panel tour-live26-autoeq">
      <div className="eq-auto-panel__body">
        <div className="eq-auto-panel__content">
          <header className="eq-auto-panel__head">
            <strong>{t('autoEq.title')}</strong>
            <span>{t('autoEq.tagline')}</span>
          </header>
          <AutoEqNowPlaying now={now} />
          <AutoEqPart
            id="tour-auto-songs"
            title={t('autoEq.songs.title')}
            hint={t('autoEq.songs.hint')}
            isOn
            onToggle={nothing}
          >
            {song.owner === 'song' ? (
              <div className="eq-auto-part__line">
                <span className="eq-auto-part__saved">
                  <MenuIcon name="check" />
                  {t('autoEq.songs.saved')}
                </span>
                <button type="button" className="button small subtle">
                  {t('autoEq.songs.forget')}
                </button>
              </div>
            ) : (
              <div className="eq-auto-part__line">
                <span>{t('autoEq.songs.none')}</span>
                <button type="button" className="button small">
                  {t('autoEq.songs.save')}
                </button>
              </div>
            )}
          </AutoEqPart>
          <AutoEqPart
            id="tour-auto-albums"
            title={t('autoEq.albums.title')}
            hint={t('autoEq.albums.hint')}
            isOn
            onToggle={nothing}
          >
            <div className="eq-auto-part__line">
              <span>
                {song.album
                  ? t('autoEq.albums.set', { album: song.album, preset })
                  : t('autoEq.albums.none')}
              </span>
            </div>
          </AutoEqPart>
          <section className="eq-auto-part tour-live26-autoeq__smart">
            <div className="eq-auto-part__head">
              <div className="eq-auto-part__words">
                <strong>{t('autoEq.smart.title')}</strong>
                <span>{t('autoEq.smart.hint')}</span>
              </div>
              <Switch
                id="tour-auto-smart"
                isOn
                isDisabled={false}
                handleToggle={nothing}
                ariaLabel={t('autoEq.smart.title')}
              />
            </div>
            <AutoEqSmartStatusView
              preview={previewAt(moment.into)}
              onAgain={nothing}
            />
          </section>
          <footer className="eq-auto-panel__foot">
            <span>
              {t('autoEq.savedCount', {
                songs: countText(t, 'library.trackCount', 128),
                albums: countText(t, 'library.albumCount', 9),
              })}
            </span>
            <button type="button" className="button small subtle">
              {t('autoEq.manage')}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
