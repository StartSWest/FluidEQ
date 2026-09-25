/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GENRE_MEASURED_SONGS } from '../../common/dsp/genreEvidence';
import { useTranslation } from '../utils/I18nContext';
import {
  IGenreNotes,
  STAGE_TITLE,
  curveGainDb,
  genreNoteKey,
  pinFrequencyLabel,
  signedTenth,
} from './genreNotesModel';
import '../styles/GenreNotes.scss';

/**
 * The "i" every door to the notes wears — the DSP page's About and the Preset
 * chip's — drawn rather than typed, so it is the same round mark in every
 * system font.
 */
export const InfoMark = () => (
  <svg className="genre-info-mark" viewBox="0 0 16 16" aria-hidden="true">
    <circle className="genre-info-mark__disc" cx="8" cy="8" r="8" />
    <circle className="genre-info-mark__glyph" cx="8" cy="4.7" r="1.2" />
    <path className="genre-info-mark__stem" d="M8 7.4v4.4" />
  </svg>
);

/** Up, down or held, by the tenth a pin prints. */
const directionOf = (db: number) => {
  if (db >= 0.25) {
    return 'is-up';
  }
  return db <= -0.25 ? 'is-down' : 'is-flat';
};

interface IGenreWhysProps {
  notes: IGenreNotes;
  /** The full notes say why; the picker's preview says only what. */
  withWhy: boolean;
  activePin?: number;
  onPin?: (index: number | undefined) => void;
}

/**
 * The pins as a list: where, how much, and what is there — numbered as they
 * are on the curve, so either can be read from the other.
 */
export const GenreWhys = ({
  notes,
  withWhy,
  activePin,
  onPin,
}: IGenreWhysProps) => {
  const { t } = useTranslation();
  return (
    <ol className={`genre-whys${withWhy ? ' has-why' : ''}`}>
      {notes.note.pins.map((hz, index) => {
        const db = notes.curve ? curveGainDb(notes.curve, hz) : 0;
        return (
          <li
            key={hz}
            className={index === activePin ? 'is-active' : undefined}
            onPointerEnter={onPin ? () => onPin(index) : undefined}
            onPointerLeave={onPin ? () => onPin(undefined) : undefined}
          >
            <span className="genre-whys__number">{index + 1}</span>
            <span className="genre-whys__hz">{pinFrequencyLabel(hz)}</span>
            <span className={`genre-whys__db ${directionOf(db)}`}>
              {`${signedTenth(db)} dB`}
            </span>
            <span className="genre-whys__what">
              {t(genreNoteKey(notes.id, `pin.${hz}`))}
              {withWhy && (
                <small>{t(genreNoteKey(notes.id, `pin.${hz}.why`))}</small>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/** "+0.55 LU", "0.40 LU": a quieter chain prints no minus beside "quieter". */
const loudnessText = (lu: number) =>
  lu > 0 ? `+${lu.toFixed(2)} LU` : `${Math.abs(lu).toFixed(2)} LU`;

/** Its peak with a real minus sign, which every other readout here uses. */
const peakText = (dbtp: number) =>
  `${dbtp < 0 ? '−' : ''}${Math.abs(dbtp).toFixed(2)} dBTP`;

interface IGenreFiguresProps {
  notes: IGenreNotes;
  /** Three tiles in the full notes; one line in the picker's preview. */
  asTiles: boolean;
}

/**
 * What the chain measured, and whether it adds harmonics: the claims a
 * listener can check by ear, each the preset's own.
 */
export const GenreFigures = ({ notes, asTiles }: IGenreFiguresProps) => {
  const { t } = useTranslation();
  if (!notes.measured) {
    return null;
  }
  const [lu, peak] = notes.measured;
  const figures: readonly (readonly [string, string])[] = [
    [
      loudnessText(lu),
      t(lu < 0 ? 'genre.notes.quieter' : 'genre.notes.louder'),
    ],
    [peakText(peak), t('genre.notes.peak')],
    notes.harmonics
      ? [
          t('genre.notes.byDesign'),
          t('genre.notes.harmonics', {
            stage: t(STAGE_TITLE[notes.harmonics]),
          }),
        ]
      : [t('genre.notes.none'), t('genre.notes.distortion')],
  ];
  if (!asTiles) {
    return (
      <p className="genre-figures">
        {figures.map(([value, label]) => (
          <span key={label}>
            <b>{value}</b> {label}
          </span>
        ))}
      </p>
    );
  }
  return (
    <section className="genre-notes__section">
      <h3>{t('genre.notes.measured', { count: GENRE_MEASURED_SONGS })}</h3>
      <div className="genre-tiles">
        {figures.map(([value, label]) => (
          <div key={label} className="genre-tiles__tile">
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
