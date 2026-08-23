/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { USER_PRESET_NAME_MAX } from './userPresets';

interface IDspPresetSaveDialogProps {
  /** Names already taken, so overwriting can be said out loud rather than done
   * quietly. Compared case-insensitively, the way a person would. */
  existing: readonly string[];
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

  return (
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
        aria-label={t('dsp.eqSave.title')}
      >
        <h2 className="dsp-import__title">{t('dsp.eqSave.title')}</h2>
        <p className="dsp-import__hint">{t('dsp.eqSave.hint')}</p>

        <input
          ref={inputRef}
          className="dsp-import__name"
          value={name}
          maxLength={USER_PRESET_NAME_MAX}
          placeholder={t('dsp.eqSave.placeholder')}
          aria-label={t('dsp.eqSave.placeholder')}
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
    </div>
  );
};

export default DspPresetSaveDialog;
