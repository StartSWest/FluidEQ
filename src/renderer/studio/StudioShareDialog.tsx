import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioDialogs.scss';

interface IStudioShareDialogProps {
  /** Exporting right now: the agree button shows it is working. */
  running: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

/**
 * Before a member's first share: what sharing means, in the three sentences
 * that matter, with the full terms one click away. Agreeing is what the
 * server records with the first signature — the same agreement the Plus
 * terms' "Scenes you make" section describes.
 *
 * "Agree and export" wears the loud style because it is what the member came
 * to do; Cancel is the quiet one.
 */
export default function StudioShareDialog({
  running,
  onAgree,
  onCancel,
}: IStudioShareDialogProps) {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const agreeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    agreeRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!running) {
          event.preventDefault();
          onCancel();
        }
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const buttons = Array.from(
        surfaceRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled)',
        ) ?? [],
      );
      if (!buttons.length) {
        return;
      }
      event.preventDefault();
      const current = buttons.findIndex(
        (button) => button === document.activeElement,
      );
      buttons[
        (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [running, onCancel]);

  return createPortal(
    <div
      className="studio-share-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !running) {
          onCancel();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="studio-share"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-share-title"
        aria-describedby="studio-share-lead"
        aria-busy={running}
      >
        <div className="studio-share__head">
          <span className="studio-share__mark" aria-hidden="true">
            <Glyph name="studio" />
          </span>
          <h2 id="studio-share-title" className="studio-share__title">
            {t('studio.share.title')}
          </h2>
        </div>
        <p id="studio-share-lead" className="studio-share__lead">
          {t('studio.share.lead')}
        </p>
        <ul className="studio-share__points">
          <li>{t('studio.share.point1')}</li>
          <li>{t('studio.share.point2')}</li>
          <li>{t('studio.share.point3')}</li>
        </ul>
        <div className="studio-share__foot">
          <button
            type="button"
            className="button small subtle studio-share__read"
            disabled={running}
            onClick={() => {
              // The terms open in the Account dialog, which would otherwise
              // appear underneath this one. Export asks again afterwards.
              onCancel();
              requestAccountPanel('terms');
            }}
          >
            {t('studio.share.read')}
          </button>
          <span className="studio-share__actions">
            <button
              type="button"
              className="button small subtle"
              disabled={running}
              onClick={onCancel}
            >
              {t('studio.share.cancel')}
            </button>
            <button
              ref={agreeRef}
              type="button"
              className={`button small${running ? ' is-running' : ''}`}
              aria-busy={running}
              onClick={() => {
                if (!running) {
                  onAgree();
                }
              }}
            >
              {running ? t('studio.share.running') : t('studio.share.agree')}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
