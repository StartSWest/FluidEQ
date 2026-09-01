/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';

interface IDspPresetImportDialogProps {
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  placeholderKey: TranslationKey;
  accept: string;
  /** A parser error from the owner, shown inside the still-open dialog. */
  error?: string;
  /** Called with the visible text. The owner decides which format it accepts. */
  onImport: (text: string) => void;
  onClose: () => void;
}

/** One visible, inspectable door for pasted presets and preset files. */
const DspPresetImportDialog = ({
  titleKey,
  hintKey,
  placeholderKey,
  accept,
  error = '',
  onImport,
  onClose,
}: IDspPresetImportDialogProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [readError, setReadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

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
        className="dsp-import"
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey)}
      >
        <h2 className="dsp-import__title">{t(titleKey)}</h2>
        <p className="dsp-import__hint">{t(hintKey)}</p>

        <textarea
          ref={textRef}
          className="dsp-import__body"
          value={text}
          spellCheck={false}
          placeholder={t(placeholderKey)}
          aria-label={t(placeholderKey)}
          onChange={(event) => setText(event.target.value)}
        />

        {(readError !== '' || error !== '') && (
          <p className="dsp-import__error" role="status">
            {readError || error}
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
          accept={accept}
          hidden
          onChange={(event) => {
            readFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </div>,
    document.body,
  );
};

export default DspPresetImportDialog;
