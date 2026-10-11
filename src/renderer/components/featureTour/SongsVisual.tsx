/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import { curvePath, type TMiniBand } from './miniCurve';

/**
 * Songs that remember their sound: a queue of songs on one output, each with
 * the preset and curve it was left with, and the notice the window shows as
 * a remembered song starts — its title, what it brought back, Undo and
 * Forget this song, in the notice's own words. The songs play in turn, and
 * the notice follows the one playing; a song nobody tuned brings nothing and
 * plays with the sound from before.
 *
 * Made-up songs (and Debussy, whose music is free), so the picture borrows
 * nobody's record; the presets are the catalogue's own names.
 */

const PLOT = { width: 64, height: 22, range: 8 };

interface ISong {
  title: string;
  artist: string;
  /** Absent: a song nobody tuned, which keeps nothing. */
  preset?: TranslationKey;
  bands?: TMiniBand[];
  art: [string, string];
}

const SONGS: ISong[] = [
  {
    title: 'Neon Rain',
    artist: 'Lumen Drive',
    preset: 'dsp.eqPreset.electronic',
    bands: [
      { kind: 'lowShelf', hz: 80, db: 5 },
      { kind: 'bell', hz: 600, db: -2, q: 1 },
      { kind: 'highShelf', hz: 9000, db: 3.5 },
    ],
    art: ['#ff4fd8', '#5b2bff'],
  },
  {
    title: 'Clair de Lune',
    artist: 'Debussy',
    preset: 'dsp.eqPreset.classical',
    bands: [
      { kind: 'bell', hz: 200, db: 1.5, q: 0.7 },
      { kind: 'bell', hz: 2500, db: -1.5, q: 1 },
      { kind: 'highShelf', hz: 7000, db: 2.5 },
    ],
    art: ['#7fd4ff', '#2d4a8a'],
  },
  {
    title: 'Low Tide',
    artist: 'Harbour Lights',
    preset: 'dsp.eqPreset.lofi',
    bands: [
      { kind: 'lowShelf', hz: 110, db: 3.5 },
      { kind: 'bell', hz: 3000, db: -2.5, q: 0.8 },
      { kind: 'highShelf', hz: 8000, db: -3 },
    ],
    art: ['#ffb36b', '#c2410c'],
  },
  {
    title: 'First Light',
    artist: 'Open Road',
    art: ['#9ae6b4', '#2f855a'],
  },
];

const REMEMBERED = SONGS.filter((song) => song.preset);

export default function SongsVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="songs-visual"
      role="img"
      aria-label={t('tour.songs.imageAlt')}
    >
      <div className="songs-visual__notices">
        {REMEMBERED.map((song, index) => (
          <span
            key={song.title}
            className="songs-visual__notice"
            style={{ '--turn': index } as CSSProperties}
          >
            <span className="songs-visual__notice-text">
              <strong>{t('songSound.noticeTitle')}</strong>
              <span>
                {song.preset &&
                  t('songSound.noticeBody', {
                    title: song.title,
                    preset: t(song.preset),
                  })}
              </span>
            </span>
            <span className="songs-visual__notice-actions">
              <span className="songs-visual__undo">{t('songSound.undo')}</span>
              <span className="songs-visual__forget">
                {t('songSound.forget')}
              </span>
            </span>
          </span>
        ))}
      </div>

      <div className="songs-visual__queue">
        <span className="songs-visual__switch">
          <span className="songs-visual__toggle" />
          {t('songSound.switch')}
        </span>
        <ul className="songs-visual__songs">
          {SONGS.map((song, index) => (
            <li
              key={song.title}
              className={`songs-visual__song${
                song.preset ? '' : ' is-untuned'
              }`}
              style={
                {
                  '--turn': index,
                  '--art-from': song.art[0],
                  '--art-to': song.art[1],
                } as CSSProperties
              }
            >
              <span className="songs-visual__art" />
              <span className="songs-visual__title">
                <strong>{song.title}</strong>
                <span>{song.artist}</span>
              </span>
              {song.preset && song.bands ? (
                <span className="songs-visual__sound">
                  <span className="songs-visual__preset">{t(song.preset)}</span>
                  <svg
                    viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d={curvePath(song.bands, PLOT)} />
                  </svg>
                </span>
              ) : (
                <span className="songs-visual__nothing">—</span>
              )}
              <span className="songs-visual__progress" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
