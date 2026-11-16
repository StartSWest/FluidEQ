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
import { IKaraokeLiveValue, useKaraokeLiveValue } from './karaokeLiveValue';
import { TKaraokeChordAnalysisStatus } from './useKaraokeChordAnalysis';

interface IKaraokeChordGuideProps {
  status: TKaraokeChordAnalysisStatus;
  chords: readonly IKaraokeChordSegment[];
  progress: IKaraokeLiveValue<number>;
  playheadMs: number;
}

/** The one thing a step of the analysis changes, and all it re-renders. */
const ChordAnalysisProgress = ({
  progress,
}: {
  progress: IKaraokeLiveValue<number>;
}) => {
  const { t } = useTranslation();
  const fraction = useKaraokeLiveValue(progress);
  return (
    <span>
      {t('karaoke.chords.analyzing', {
        percent: Math.round(fraction * 100),
      })}
    </span>
  );
};

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
        <ChordAnalysisProgress progress={progress} />
      </div>
    );
  }

  // A row of chips over the pitch lane, as the K1 mockup draws them (Ivan,
  // 2026-11-15: "with the chords on top of it exactly as the mockups"): the
  // chord just played, the one sounding, tinted, and the next two. It was a
  // panel of labelled boxes beside the song's title, with a countdown.
  const currentIndex = chords.findIndex(
    (chord) => chord.startMs <= playheadMs && chord.endMs > playheadMs,
  );
  const nextIndex =
    currentIndex >= 0
      ? currentIndex + 1
      : chords.findIndex((chord) => chord.startMs > playheadMs);
  // Between two chords there is none sounding: the one before is the last
  // that started before the next one.
  const previousIndex =
    currentIndex >= 0
      ? currentIndex - 1
      : (nextIndex < 0 ? chords.length : nextIndex) - 1;
  const previous = previousIndex >= 0 ? chords[previousIndex] : undefined;
  const current = currentIndex >= 0 ? chords[currentIndex] : undefined;
  const upcoming = nextIndex < 0 ? [] : chords.slice(nextIndex, nextIndex + 2);

  if (!chords.length) {
    return (
      <div className="karaoke-chords" role="status">
        <span className="karaoke-chords__empty">
          {t('karaoke.chords.none')}
        </span>
      </div>
    );
  }

  return (
    <div
      className="karaoke-chords"
      role="status"
      aria-live="polite"
      aria-label={t('karaoke.chords.aria')}
    >
      {previous && (
        <span key={`${previous.startMs}-past`} className="karaoke-chords__chip">
          {previous.label}
        </span>
      )}
      {current && (
        <strong
          key={`${current.startMs}-now`}
          className="karaoke-chords__chip is-current"
          title={t('karaoke.chords.confidence', {
            percent: Math.round(current.confidence * 100),
          })}
        >
          {current.label}
        </strong>
      )}
      {upcoming.map((chord) => (
        <span
          key={`${chord.startMs}-next`}
          className="karaoke-chords__chip is-next"
        >
          {chord.label}
        </span>
      ))}
    </div>
  );
};

export default KaraokeChordGuide;
