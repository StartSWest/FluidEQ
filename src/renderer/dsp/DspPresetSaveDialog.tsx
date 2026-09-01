/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';

interface IDspPresetSaveDialogProps {
  /** Names already taken, so overwriting can be said out loud rather than done
   * quietly. Compared case-insensitively, the way a person would. */
  existing: readonly string[];
  /**
   * What is being named. The dialog behaves identically for a rack and for a
   * crossfade shape — same validation, same overwrite warning, same keys — so
   * the copy is a parameter rather than a mode: the alternative was a second
   * dialog whose only difference from this one was three strings.
   */
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  placeholderKey: TranslationKey;
  nameMax: number;
  onSave: (name: string) => void;
  onClose: () => void;
}

/**
 * Naming a preset, which is the only thing standing between the rack and the
 * saved list.
 *
 * A dialog rather than `window.prompt`: prompt cannot say that the name is
 * already taken until after the fact, cannot cap the length, and looks like a
 * different application. This is the same shape as the import dialog because it
 * is the same kind of moment.
 */
const DspPresetSaveDialog = ({
  existing,
  titleKey,
  hintKey,
  placeholderKey,
  nameMax,
  onSave,
  onClose,
}: IDspPresetSaveDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = name.trim();
  const overwrites = existing.some(
    (one) => one.toLowerCase() === trimmed.toLowerCase(),
  );

  // Portalled to the window, for the reason spelled out in
  // `DspPresetImportDialog`: `.dsp-card` is a query container, and a container is
  // the containing block for the fixed backdrop this dialog is built from.
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
        aria-label={t(titleKey)}
      >
        <h2 className="dsp-import__title">{t(titleKey)}</h2>
        <p className="dsp-import__hint">{t(hintKey)}</p>

        <input
          ref={inputRef}
          className="dsp-import__name"
          value={name}
          maxLength={nameMax}
          placeholder={t(placeholderKey)}
          aria-label={t(placeholderKey)}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && trimmed !== '') {
              onSave(trimmed);
            }
          }}
        />

        {/* Said before it happens, not reported after. Saving over a name is a
            perfectly ordinary thing to want; being surprised by it is not. */}
        {overwrites && (
          <p className="dsp-import__error" role="status">
            {t('dsp.eqSave.overwrite')}
          </p>
        )}

        <div className="dsp-import__actions">
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
            disabled={trimmed === ''}
            onClick={() => onSave(trimmed)}
          >
            {t('dsp.eqSave.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DspPresetSaveDialog;
