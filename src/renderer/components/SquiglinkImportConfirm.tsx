/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/I18nContext';
import holdFocusReturn from '../utils/focusReturn';
import MenuIcon from '../icons/MenuIcon';
import CompactFrame from './CompactFrame';
import '../styles/Dsp.scss';
import '../styles/SquiglinkImport.scss';

interface ISquiglinkImportConfirmProps {
  onApply(destination: 'eq' | 'curve'): void;
  onCancel(): void;
}

/**
 * Asked when "Apply as EQ" would overwrite bands somebody already has. The
 * recommendation is to keep them and apply the fit as a curve on top, so that
 * is the loud answer, last, and where the keyboard lands: Enter pressed twice
 * by habit keeps the bands. Replacing them stays one quiet press away.
 */
const SquiglinkImportConfirm = ({
  onApply,
  onCancel,
}: ISquiglinkImportConfirmProps) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const curveButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
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
      giveFocusBack();
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
      <CompactFrame
        ref={modalRef}
        className="squig-replace"
        icon={<MenuIcon name="import" />}
        title={t('squigImport.replaceTitle')}
        titleId="squig-replace-title"
        aria-describedby="squig-replace-body"
        onClose={onCancel}
        closeLabel={t('support.close')}
        actions={
          <>
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
          </>
        }
      >
        <p id="squig-replace-body">{t('squigImport.replaceBody')}</p>
      </CompactFrame>
    </div>,
    document.body,
  );
};

export default SquiglinkImportConfirm;
