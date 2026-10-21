/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMPORT_EARS, type TImportEars } from 'common/bandEars';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import '../styles/ImportEarsPick.scss';

/** Each choice by the words the ears go by elsewhere on screen. */
export const IMPORT_EAR_NAMES: Record<TImportEars, TranslationKey> = {
  both: 'eq.channels.both',
  left: 'graph.curve.leftEar',
  right: 'graph.curve.rightEar',
};

interface IImportEarsPickProps {
  value: TImportEars;
  onChange: (ears: TImportEars) => void;
  disabled?: boolean;
}

/**
 * Which ears an imported curve fills: both, or one of them with the other
 * ear's sound kept (Ivan, 2026-10-13: "to be able to fill either or both left
 * and right"). The app's own segmented track, beside the import's Apply in
 * the Squiglink panel and in the DSP EQ's import.
 */
export default function ImportEarsPick({
  value,
  onChange,
  disabled = false,
}: IImportEarsPickProps) {
  const { t } = useTranslation();
  return (
    <div
      className="segmented import-ears"
      role="group"
      aria-label={t('eq.channels.importInto')}
    >
      {IMPORT_EARS.map((ears) => (
        <button
          key={ears}
          type="button"
          className={`segmented__option${value === ears ? ' is-selected' : ''}`}
          aria-pressed={value === ears}
          disabled={disabled}
          onClick={() => onChange(ears)}
        >
          {t(IMPORT_EAR_NAMES[ears])}
        </button>
      ))}
    </div>
  );
}
