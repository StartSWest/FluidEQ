/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import GenreCurve from './GenreCurve';
import { GenreFigures, GenreWhys } from './GenreNotesParts';
import { genreNoteKey, genreNotesFor } from './genreNotesModel';
import { openGenreNotes } from './genreNotesStore';
import '../styles/GenreNotes.scss';

interface IGenreNotesPreviewProps {
  /** The row pointed at, or the chosen one when nothing is. */
  chainId: string | undefined;
  /** Shuts the menu the preview sits in, before the notes open over it. */
  closeMenu: () => void;
}

/**
 * Beside a preset list, the notes of the genre being pointed at: its hook,
 * its curve with the frequencies it was tuned around, and what it measured
 * (Ivan, 2026-09-24: "I want them to value the presets" — and a preset is
 * valued before it is chosen, or never).
 *
 * For anything that is not a genre it says how to get one, so the column
 * keeps its place instead of the menu changing width under the pointer.
 */
const GenreNotesPreview = ({ chainId, closeMenu }: IGenreNotesPreviewProps) => {
  const { t } = useTranslation();
  const notes = genreNotesFor(chainId);
  if (!notes || !chainId) {
    return <p className="genre-preview__hint">{t('genre.notes.hint')}</p>;
  }
  const name = t(notes.labelKey as TranslationKey);
  return (
    <div className="genre-preview">
      <div className="genre-preview__head">
        <strong>{name}</strong>
        <span>{t(genreNoteKey(notes.id, 'hook'))}</span>
      </div>
      {notes.curve && (
        <GenreCurve
          curve={notes.curve}
          pins={notes.note.pins}
          name={name}
          isLabelled={false}
        />
      )}
      <GenreWhys notes={notes} withWhy={false} />
      <GenreFigures notes={notes} asTiles={false} />
      <button
        type="button"
        className="button small"
        onClick={() => {
          closeMenu();
          openGenreNotes(chainId);
        }}
      >
        {t('genre.notes.full')}
      </button>
    </div>
  );
};

export default GenreNotesPreview;
