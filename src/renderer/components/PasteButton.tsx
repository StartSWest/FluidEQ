/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { RefObject } from 'react';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { TPasteField } from '../utils/clipboardText';
import usePasteIntoField from '../utils/usePasteIntoField';
import '../styles/PasteButton.scss';

/**
 * The quiet Paste button beside a box whose text is meant to be pasted in
 * (`usePasteIntoField` for what it does and when it is grey), with the line
 * that says why when the clipboard holds no text.
 */
const PasteButton = ({
  target,
  disabled = false,
}: {
  target: RefObject<TPasteField | null>;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const { hasText, noteKey, paste, keepFieldFocus } = usePasteIntoField(target);

  return (
    <span className="paste-button">
      <button
        type="button"
        className="button small subtle"
        disabled={disabled || !hasText}
        title={t('edit.paste.hint')}
        onMouseDown={keepFieldFocus}
        onClick={paste}
      >
        <MenuIcon name="copyText" />
        {t('edit.paste.button')}
      </button>
      {noteKey !== undefined && (
        <span className="paste-button__note" role="status">
          {t(noteKey)}
        </span>
      )}
    </span>
  );
};

export default PasteButton;
