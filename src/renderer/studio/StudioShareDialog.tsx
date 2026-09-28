import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { requestAccountPanel } from '../account/accountPanel';
import DialogFrame from '../components/DialogFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import holdFocusReturn from '../utils/focusReturn';
import { useStudioAgentHold } from './studioAgentHold';
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
  // Open on the Studio's project: its AI may not switch the Studio under it.
  useStudioAgentHold(true);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const agreeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    agreeRef.current?.focus();
    return giveFocusBack;
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
      <DialogFrame
        ref={surfaceRef}
        className="studio-share"
        icon={<MenuIcon name="shield" />}
        title={t('studio.share.title')}
        titleId="studio-share-title"
        description={
          <span id="studio-share-lead">{t('studio.share.lead')}</span>
        }
        aria-describedby="studio-share-lead"
        aria-busy={running}
        closeLabel={t('support.close')}
        // Away while the export runs, as Escape and the backdrop are.
        onClose={running ? undefined : onCancel}
        footer={
          <>
            <button
              type="button"
              className="button small subtle"
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
            <div className="dialog-frame__actions">
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
            </div>
          </>
        }
      >
        <ul className="studio-ticks">
          <li>
            <MenuIcon name="check" />
            <span>{t('studio.share.point1')}</span>
          </li>
          <li>
            <MenuIcon name="check" />
            <span>{t('studio.share.point2')}</span>
          </li>
          <li>
            <MenuIcon name="check" />
            <span>{t('studio.share.point3')}</span>
          </li>
        </ul>
      </DialogFrame>
    </div>,
    document.body,
  );
}
