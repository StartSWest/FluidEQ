/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import holdFocusReturn from '../utils/focusReturn';
import MenuIcon from '../icons/MenuIcon';
import DialogFrame from '../components/DialogFrame';
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
 * On the DSP dialogs' own backdrop (`dsp-import-backdrop`) and the dialog
 * frame: the genre, its line and whose research it was tuned from in the
 * rail; the notes in the body, a section each. Hovering a pin on the curve
 * lights its row, and the other way round.
 */
const GenreNotesDialog = ({ chainId, onClose }: IGenreNotesDialogProps) => {
  const { t } = useTranslation();
  const notes = genreNotesFor(chainId);
  const [activePin, setActivePin] = useState<number>();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Back to whatever opened it, when that is still on the page: the About
    // button and the chip's "i" are, a menu's preview has closed by then.
    const giveFocusBack = holdFocusReturn();
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      giveFocusBack();
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
      <DialogFrame
        className="genre-notes"
        icon={<MenuIcon name="genre" />}
        eyebrow={t('genre.notes.eyebrow')}
        title={name}
        titleId="genre-notes-title"
        aria-labelledby="genre-notes-title-eyebrow genre-notes-title"
        description={key('hook')}
        rail={
          notes.sources && (
            <p className="dialog-frame__rail-text">
              {t('genre.notes.research', { sources: notes.sources })}
            </p>
          )
        }
        onClose={onClose}
        closeLabel={t('genre.notes.close')}
        closeRef={closeRef}
      >
        <div className="genre-notes__body">
          <section className="dialog-frame__section">
            <h3 className="dialog-frame__section-title">
              {t('genre.notes.sound')}
            </h3>
            <p>{key('story')}</p>
          </section>

          <section className="dialog-frame__section">
            <h3 className="dialog-frame__section-title">
              {t('genre.notes.curve')}
            </h3>
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

          <section className="dialog-frame__section">
            <h3 className="dialog-frame__section-title">
              {t('genre.notes.rack')}
            </h3>
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

          <section className="dialog-frame__section">
            <h3 className="dialog-frame__section-title">
              {t('genre.notes.listen')}
            </h3>
            <ul className="genre-listen">
              {notes.note.listen.map((record) => (
                <li key={record}>{record}</li>
              ))}
            </ul>
          </section>
        </div>
      </DialogFrame>
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
