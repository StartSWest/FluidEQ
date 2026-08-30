/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/I18nContext';

interface IDspEqImportDialogProps {
  /** Called with the text to parse. The caller reports what came of it. */
  onImport: (text: string) => void;
  onClose: () => void;
}

/**
 * Paste a curve, or pick the file it lives in.
 *
 * A file picker alone was the wrong single door. These curves are published on
 * web pages — Squiglink, AutoEq, oratory1990's sheets — where the thing you
 * have is eleven lines on the clipboard, not a file on disk. Saving it to a
 * text file first only to pick it back up is a step that exists solely because
 * the app asked for it.
 *
 * Choosing a file fills the box rather than importing straight away, so both
 * doors end at the same place: the text is on screen, and it is obvious what
 * is about to be applied.
 */
const DspEqImportDialog = ({ onImport, onClose }: IDspEqImportDialogProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [readError, setReadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  // On the document rather than the dialog: the focus can be inside the file
  // picker or on the backdrop, and Escape has to close from all of them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const readFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    setReadError('');
    file
      .text()
      .then((contents) => {
        setText(contents);
        return true;
      })
      .catch(() => setReadError(t('dsp.eqPreset.importFailed')));
  };

  // Portalled, because a backdrop is `position: fixed; inset: 0` and by that
  // it means the window. Rendered where it is written it is a descendant of
  // `.dsp-card`, which is a query container — and a container is the
  // containing block for every fixed descendant, so `inset: 0` would resolve
  // against one processor card. `.dsp-body.is-disabled`'s filter is a second
  // road to the same failure.
  return createPortal(
    <div
      className="dsp-import-backdrop"
      role="presentation"
      // Only a click that landed on the backdrop itself closes. Comparing the
      // target beats stopping propagation inside the dialog: the dialog stays
      // a plain non-interactive container, which is what it is.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="dsp-import"
        role="dialog"
        aria-modal="true"
        aria-label={t('dsp.eqImport.title')}
      >
        <h2 className="dsp-import__title">{t('dsp.eqImport.title')}</h2>
        <p className="dsp-import__hint">{t('dsp.eqImport.hint')}</p>

        <textarea
          ref={textRef}
          className="dsp-import__body"
          value={text}
          spellCheck={false}
          placeholder={t('dsp.eqImport.placeholder')}
          aria-label={t('dsp.eqImport.placeholder')}
          onChange={(event) => setText(event.target.value)}
        />

        {readError !== '' && (
          <p className="dsp-import__error" role="status">
            {readError}
          </p>
        )}

        <div className="dsp-import__actions">
          <button
            type="button"
            className="button small subtle"
            onClick={() => fileRef.current?.click()}
          >
            {t('dsp.eqImport.chooseFile')}
          </button>
          <span className="dsp-import__spacer" />
          <button
            type="button"
            className="button small subtle"
            onClick={onClose}
          >
            {t('dsp.eqImport.cancel')}
          </button>
          {/* The loud one, because it is the action the dialog exists for. */}
          <button
            type="button"
            className="button small"
            disabled={text.trim() === ''}
            onClick={() => onImport(text)}
          >
            {t('dsp.eqImport.apply')}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          // Both doors: a published curve is a text file and a shared preset is
          // JSON, and from the outside they are the same errand.
          accept=".txt,.json,text/plain,application/json"
          hidden
          onChange={(event) => {
            readFile(event.target.files?.[0]);
            // Cleared so choosing the same file twice fires again — without
            // this, re-picking a file the user has just edited does nothing.
            event.target.value = '';
          }}
        />
      </div>
    </div>,
    document.body,
  );
};

export default DspEqImportDialog;
