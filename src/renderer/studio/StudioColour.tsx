/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';

interface IStudioColourProps {
  label: string;
  /** `#rrggbb`, as the member has it now. */
  value: string;
  disabled: boolean;
  canReset: boolean;
  /** Where Reset puts it, said on the button before it is pressed. */
  resetsTo: string;
  /** Live: the stage follows the picker while a colour is chosen. */
  onChange: (value: string) => void;
  /** Saved: the colour settled in the picker. */
  onCommit: (value: string) => void;
  onReset: () => void;
}

/**
 * A scene's single colour (contract 9, `sceneColourControl.ts`): its name,
 * then the colour itself on a button the width of the column with its hex,
 * which opens the system's colour picker; Reset beside it, as the palette's.
 * The stage follows the picker as it moves and the scene keeps the colour the
 * picker settles on.
 */
export default function StudioColour({
  label,
  value,
  disabled,
  canReset,
  resetsTo,
  onChange,
  onCommit,
  onReset,
}: IStudioColourProps) {
  const { t } = useTranslation();
  const pickerRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // The picker's own `change` is the moment the colour is settled; its
  // `input` (React's onChange) follows it while it is chosen.
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) {
      return undefined;
    }
    const settle = () => onCommit(picker.value.toLowerCase());
    picker.addEventListener('change', settle);
    return () => picker.removeEventListener('change', settle);
  }, [onCommit]);

  return (
    <div className="studio-colour">
      <span className="studio-setting__label">{label}</span>
      <div className="studio-colour__row">
        <label
          htmlFor={id}
          className="studio-colour__pick"
          style={{ '--colour': value } as CSSProperties}
        >
          <span className="studio-colour__well" aria-hidden />
          <span className="studio-colour__hex">{value.toUpperCase()}</span>
          <input
            ref={pickerRef}
            id={id}
            type="color"
            className="studio-colour__input"
            value={value}
            disabled={disabled}
            aria-label={t('studioPalette.pickColour', { name: label })}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
          />
        </label>
        <button
          type="button"
          className="button small subtle studio-palette__tool"
          title={resetsTo}
          aria-label={t('studio.settings.reset')}
          disabled={disabled || !canReset}
          onClick={onReset}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8a5 5 0 1 0 1.6-3.7" />
            <path d="M2.8 2.2v2.6h2.6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
