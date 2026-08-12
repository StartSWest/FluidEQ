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

import { IKaraokeChordSegment } from '../../common/karaoke/chords';
import { useTranslation } from '../utils/I18nContext';
import { TKaraokeChordAnalysisStatus } from './useKaraokeChordAnalysis';

interface IKaraokeChordGuideProps {
  status: TKaraokeChordAnalysisStatus;
  chords: readonly IKaraokeChordSegment[];
  progress: number;
  playheadMs: number;
}

const KaraokeChordGuide = ({
  status,
  chords,
  progress,
  playheadMs,
}: IKaraokeChordGuideProps) => {
  const { t } = useTranslation();
  if (status === 'idle' || status === 'unsupported' || status === 'error') {
    return null;
  }
  if (status === 'analyzing') {
    return (
      <div
        className="karaoke-chords is-analyzing"
        role="status"
        aria-label={t('karaoke.chords.aria')}
      >
        <span className="karaoke-chords__scan" aria-hidden="true" />
        <span>
          {t('karaoke.chords.analyzing', {
            percent: Math.round(progress * 100),
          })}
        </span>
      </div>
    );
  }

  const current = chords.find(
    (chord) => chord.startMs <= playheadMs && chord.endMs > playheadMs,
  );
  const upcoming = chords
    .filter(
      (chord) =>
        chord.startMs > playheadMs + 80 &&
        (!current || chord.label !== current.label),
    )
    .slice(0, 2);

  return (
    <div
      className={`karaoke-chords${current ? ' has-current' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={t('karaoke.chords.aria')}
    >
      <div className="karaoke-chords__current">
        <span>{t('karaoke.chords.estimate')}</span>
        <strong
          title={t('karaoke.chords.confidence', {
            percent: Math.round((current?.confidence ?? 0) * 100),
          })}
        >
          {current?.label ?? '—'}
        </strong>
      </div>
      {upcoming.map((chord, index) => {
        const seconds = Math.max(0, chord.startMs - playheadMs) / 1_000;
        return (
          <div
            className="karaoke-chords__next"
            data-order={index + 1}
            key={`${chord.startMs}-${chord.label}`}
          >
            <span>{index === 0 ? t('karaoke.chords.next') : ''}</span>
            <strong>{chord.label}</strong>
            {index === 0 && (
              <small>
                {t('karaoke.chords.in', {
                  seconds:
                    seconds < 10 ? seconds.toFixed(1) : Math.round(seconds),
                })}
              </small>
            )}
          </div>
        );
      })}
      {!chords.length && (
        <span className="karaoke-chords__empty">
          {t('karaoke.chords.none')}
        </span>
      )}
    </div>
  );
};

export default KaraokeChordGuide;
