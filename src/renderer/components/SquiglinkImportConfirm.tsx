/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/I18nContext';
import '../styles/Dsp.scss';

interface ISquiglinkImportConfirmProps {
  onApply(destination: 'eq' | 'curve'): void;
  onCancel(): void;
}

const SquiglinkImportConfirm = ({
  onApply,
  onCancel,
}: ISquiglinkImportConfirmProps) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const curveButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    curveButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      } else if (event.key === 'Tab') {
        const buttons = Array.from(
          modalRef.current?.querySelectorAll('button') ?? [],
        );
        if (!buttons.length) {
          return;
        }
        event.preventDefault();
        const current = buttons.findIndex(
          (button) => button === document.activeElement,
        );
        buttons[
          (current + (event.shiftKey ? -1 : 1) + buttons.length) %
            buttons.length
        ]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [onCancel]);

  return createPortal(
    <div
      className="dsp-import-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={modalRef}
        className="dsp-import"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="squig-replace-title"
        aria-describedby="squig-replace-body"
      >
        <h2 id="squig-replace-title" className="dsp-import__title">
          {t('squigImport.replaceTitle')}
        </h2>
        <p id="squig-replace-body" className="dsp-import__hint">
          {t('squigImport.replaceBody')}
        </p>
        <div className="squig-import__actions">
          <button
            type="button"
            className="button small subtle"
            onClick={onCancel}
          >
            {t('config.cancel')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => onApply('eq')}
          >
            {t('squigImport.replaceEq')}
          </button>
          <button
            ref={curveButtonRef}
            type="button"
            className="button small"
            onClick={() => onApply('curve')}
          >
            {t('squigImport.applyCurve')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SquiglinkImportConfirm;
