/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { ReactNode } from 'react';
import type { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { formatOf } from './libraryColumns';
import { formatCount } from './libraryFormat';
import { useTrackFacts } from './useTrackFacts';

/** One decimal for a rate or a size, none where it would only say ".0". */
const trim = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

const clock = (durationMs: number): string => {
  const seconds = Math.round(durationMs / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
    : `${minutes}:${rest}`;
};

/**
 * The right pane's Details tab (Ivan, 2026-11-14): everything known about the
 * song being played. What the library keeps — tags, length, plays, the
 * loudness FluidEQ measured — is there at once; what only the file says —
 * codec, depth, size now — is read from it in main by id and fills in a
 * moment later (`useTrackFacts`). A fact nobody knows is left out rather than
 * drawn as a dash: a list of dashes reads as broken.
 */
const LibraryTrackDetails = ({
  track,
}: {
  track: ILibraryTrack | undefined;
}) => {
  const { t, locale } = useTranslation();
  const facts = useTrackFacts(track);

  if (track === undefined) {
    return <p className="library-pane__empty">{t('library.facts.nothing')}</p>;
  }

  const rows = (
    entries: readonly [string, ReactNode | undefined][],
  ): ReactNode[] =>
    entries
      .filter(
        (entry): entry is [string, ReactNode] =>
          entry[1] !== undefined && entry[1] !== '',
      )
      .map(([label, value]) => (
        <div key={label} className="library-facts__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ));

  const sampleRate = facts?.sampleRate ?? track.sampleRate;
  const bitrate = facts?.bitrate ?? track.bitrate;
  const channels = facts?.channels ?? track.channels;
  let channelText: string | undefined;
  if (channels === 1) {
    channelText = t('library.facts.mono');
  } else if (channels === 2) {
    channelText = t('library.facts.stereo');
  } else if (channels !== undefined) {
    channelText = t('library.facts.channelCount', { count: channels });
  }
  const format = formatOf(track.path);
  const sizeBytes = facts?.sizeBytes ?? track.sizeBytes;
  const loudness = track.normalization;

  return (
    <div className="library-facts">
      <section className="library-facts__group">
        <h3 className="library-pane__heading">{t('library.facts.song')}</h3>
        <dl>
          {rows([
            [t('library.column.title'), track.title],
            [t('library.column.artist'), track.artist],
            [t('library.column.album'), track.album],
            [t('library.column.genre'), track.genre],
            [
              t('library.column.year'),
              track.year === undefined ? undefined : String(track.year),
            ],
            [
              t('library.facts.track'),
              track.trackNo === undefined ? undefined : String(track.trackNo),
            ],
            [
              t('library.facts.disc'),
              track.discNo === undefined ? undefined : String(track.discNo),
            ],
            [
              t('library.column.plays'),
              formatCount(track.playCount ?? 0, locale),
            ],
          ])}
        </dl>
      </section>
      <section className="library-facts__group">
        <h3 className="library-pane__heading">{t('library.facts.file')}</h3>
        <dl>
          {rows([
            [
              t('library.column.format'),
              facts?.lossless === undefined
                ? format
                : `${format} · ${t(
                    facts.lossless
                      ? 'library.facts.lossless'
                      : 'library.facts.lossy',
                  )}`,
            ],
            [t('library.facts.codec'), facts?.codec ?? track.codec],
            [
              t('library.facts.bitrate'),
              bitrate === undefined
                ? undefined
                : t('library.facts.kbps', {
                    value: formatCount(Math.round(bitrate / 1000), locale),
                  }),
            ],
            [
              t('library.facts.sampleRate'),
              sampleRate === undefined
                ? undefined
                : t('library.facts.khz', {
                    value: trim(sampleRate / 1000, locale),
                  }),
            ],
            [
              t('library.facts.bitDepth'),
              facts?.bitsPerSample === undefined
                ? undefined
                : t('library.facts.bits', { value: facts.bitsPerSample }),
            ],
            [t('library.facts.channels'), channelText],
            [
              t('library.facts.duration'),
              track.durationMs === undefined
                ? undefined
                : clock(track.durationMs),
            ],
            [
              t('library.facts.size'),
              t('library.facts.mb', {
                value: trim(sizeBytes / 1_048_576, locale),
              }),
            ],
          ])}
        </dl>
      </section>
      {loudness !== undefined && (
        <section className="library-facts__group">
          <h3 className="library-pane__heading">{t('library.facts.sound')}</h3>
          <dl>
            {rows([
              [
                t('library.facts.loudness'),
                t('library.facts.lufs', {
                  value: trim(loudness.integratedLufs, locale),
                }),
              ],
              [
                t('library.facts.truePeak'),
                t('library.facts.dbtp', {
                  value: trim(loudness.truePeakDbtp, locale),
                }),
              ],
            ])}
          </dl>
        </section>
      )}
      <section className="library-facts__group">
        <h3 className="library-pane__heading">{t('library.facts.location')}</h3>
        <p className="library-facts__path" title={track.path}>
          {track.path}
        </p>
        <button
          type="button"
          className="library-hero__button library-facts__reveal"
          onClick={() => {
            window.electron.ipcRenderer
              .revealLibraryTrack(track.id)
              .catch(() => undefined);
          }}
        >
          {t('library.reveal')}
        </button>
      </section>
      {facts?.readFailed === true && (
        <p className="library-pane__note">{t('library.facts.readFailed')}</p>
      )}
    </div>
  );
};

export default LibraryTrackDetails;
