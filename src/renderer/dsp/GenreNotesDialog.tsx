/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import GenreCurve from './GenreCurve';
import { GenreFigures, GenreWhys } from './GenreNotesParts';
import { STAGE_TITLE, genreNoteKey, genreNotesFor } from './genreNotesModel';
import { closeGenreNotes, useOpenGenreNotes } from './genreNotesStore';
import '../styles/GenreNotes.scss';

interface IGenreNotesDialogProps {
  chainId: string;
  onClose: () => void;
}

/**
 * A genre's notes, whole: where its sound comes from, why its curve moves at
 * each pinned frequency, what every stage of its rack does and why the rest
 * is off, what it measured, records to hear it in and whose research it was
 * tuned from.
 *
 * Built on the DSP dialogs' own backdrop and panel (`dsp-import`), portalled
 * to the window for the reason `DspPresetImportDialog` gives. Hovering a pin
 * on the curve lights its row, and the other way round.
 */
const GenreNotesDialog = ({ chainId, onClose }: IGenreNotesDialogProps) => {
  const { t } = useTranslation();
  const notes = genreNotesFor(chainId);
  const [activePin, setActivePin] = useState<number>();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Back to whatever opened it, when that is still on the page: the About
    // button and the chip's "i" are, a menu's preview has closed by then.
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [onClose]);

  if (!notes) {
    return null;
  }
  const name = t(notes.labelKey as TranslationKey);
  const key = (part: string) => t(genreNoteKey(notes.id, part));

  return createPortal(
    <div
      className="dsp-import-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="dsp-import genre-notes"
        role="dialog"
        aria-modal="true"
        aria-label={t('genre.notes.about', { name })}
      >
        <header className="genre-notes__head">
          <div>
            <span className="genre-notes__eyebrow">
              {t('genre.notes.eyebrow')}
            </span>
            <h2>{name}</h2>
            <p className="genre-notes__hook">{key('hook')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="genre-notes__close"
            aria-label={t('genre.notes.close')}
            title={t('genre.notes.close')}
            onClick={onClose}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </header>

        <div className="genre-notes__body">
          <section className="genre-notes__section">
            <h3>{t('genre.notes.sound')}</h3>
            <p>{key('story')}</p>
          </section>

          <section className="genre-notes__section">
            <h3>{t('genre.notes.curve')}</h3>
            {notes.curve && (
              <GenreCurve
                curve={notes.curve}
                pins={notes.note.pins}
                name={name}
                isLabelled
                activePin={activePin}
                onPin={setActivePin}
              />
            )}
            <GenreWhys
              notes={notes}
              withWhy
              activePin={activePin}
              onPin={setActivePin}
            />
          </section>

          <section className="genre-notes__section">
            <h3>{t('genre.notes.rack')}</h3>
            <ul className="genre-rack">
              {notes.stagesOn.map((stage) => (
                <li key={stage}>
                  <span className="genre-rack__stage">
                    {t(STAGE_TITLE[stage])}
                  </span>
                  <span className="genre-rack__state is-on">
                    {t('genre.notes.on')}
                  </span>
                  <span>{key(`stage.${stage}`)}</span>
                </li>
              ))}
              <li>
                <span className="genre-rack__stage">
                  {t('genre.notes.leftOff')}
                </span>
                <span className="genre-rack__state" />
                <span>{key('off')}</span>
              </li>
            </ul>
          </section>

          <GenreFigures notes={notes} asTiles />

          <section className="genre-notes__section">
            <h3>{t('genre.notes.listen')}</h3>
            <ul className="genre-listen">
              {notes.note.listen.map((record) => (
                <li key={record}>{record}</li>
              ))}
            </ul>
          </section>

          {notes.sources && (
            <p className="genre-notes__sources">
              {t('genre.notes.research', { sources: notes.sources })}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Mounted once, in `App.tsx`: the genre notes open, if any. */
export const GenreNotesHost = () => {
  const chainId = useOpenGenreNotes();
  return chainId ? (
    <GenreNotesDialog
      key={chainId}
      chainId={chainId}
      onClose={closeGenreNotes}
    />
  ) : null;
};

export default GenreNotesDialog;
