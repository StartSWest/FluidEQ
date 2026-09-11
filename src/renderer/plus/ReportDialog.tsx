import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import {
  REPORT_REASONS,
  type IGalleryScene,
  type TReportReason,
} from 'common/plusGallery';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import { reportGalleryScene } from './galleryActions';

const REASON_KEYS: Record<TReportReason, TranslationKey> = {
  rights: 'plus.report.reason.rights',
  flashing: 'plus.report.reason.flashing',
  offensive: 'plus.report.reason.offensive',
  broken: 'plus.report.reason.broken',
};

interface IReportDialogProps {
  scene: IGalleryScene;
  name: string;
  /** `sent` is true once the report reached the server. */
  onClose: (sent: boolean) => void;
}

/**
 * Reporting a scene: four reasons and nothing to type, because a box of free
 * text is one more place somebody can write something nobody should read.
 * Only the maker of FluidEQ reads reports; the scene stays up until they act.
 */
export default function ReportDialog({
  scene,
  name,
  onClose,
}: IReportDialogProps) {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<TReportReason>();
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancel = useCallback(() => onClose(false), [onClose]);
  useModalKeys(surfaceRef, firstRef, { busy: sending, onCancel: cancel });

  const send = () => {
    if (!reason || sending) {
      return;
    }
    setSending(true);
    setFailed(false);
    reportGalleryScene(scene, reason)
      .then((sent) => {
        setSending(false);
        if (sent) {
          onClose(true);
        } else {
          setFailed(true);
        }
        return undefined;
      })
      .catch(() => {
        setSending(false);
        setFailed(true);
      });
  };

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !sending) {
          cancel();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-report-title"
        aria-describedby="gallery-report-lead"
        aria-busy={sending}
      >
        <div className="gallery-dialog__head">
          <span
            className="gallery-dialog__mark gallery-dialog__mark--warn"
            aria-hidden="true"
          >
            <Glyph name="report" />
          </span>
          <h2 id="gallery-report-title" className="gallery-dialog__title">
            {t('plus.report.title', { name })}
          </h2>
        </div>
        <p id="gallery-report-lead" className="gallery-dialog__lead">
          {t('plus.report.lead')}
        </p>
        <div
          className="gallery-reasons"
          role="radiogroup"
          aria-labelledby="gallery-report-title"
        >
          {REPORT_REASONS.map((entry, index) => (
            <label
              key={entry}
              className="gallery-reason"
              htmlFor={`gallery-report-${entry}`}
            >
              <input
                ref={index === 0 ? firstRef : undefined}
                id={`gallery-report-${entry}`}
                type="radio"
                name="gallery-report-reason"
                value={entry}
                checked={reason === entry}
                disabled={sending}
                onChange={() => setReason(entry)}
              />
              <span>{t(REASON_KEYS[entry])}</span>
            </label>
          ))}
        </div>
        {failed && (
          <p className="gallery-dialog__error" role="alert">
            {t('plus.report.failed')}
          </p>
        )}
        <div className="gallery-dialog__foot">
          <button
            type="button"
            className="button small subtle"
            disabled={sending}
            onClick={cancel}
          >
            {t('plus.report.cancel')}
          </button>
          <button
            type="button"
            className={`button small${sending ? ' is-running' : ''}`}
            aria-busy={sending}
            disabled={!reason}
            onClick={send}
          >
            {sending ? t('plus.report.sending') : t('plus.report.send')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
