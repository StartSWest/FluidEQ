/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { errorText, type ErrorDescription } from 'common/errors';
import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

/**
 * Equalizer APO was set up again, and Windows audio has to restart before
 * it is in the chain.
 */
export const RestartRecommendedNotice = ({
  onDismiss,
  onRestart,
}: {
  onDismiss: () => void;
  onRestart: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <CompactFrame
      className="audio-restart-notice"
      role="status"
      aria-modal={undefined}
      tone="warn"
      icon={<MenuIcon name="restart" />}
      title={t('notice.apoReconfiguredTitle')}
      titleId="apo-reconfigured-title"
      onClose={onDismiss}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={onDismiss}
          >
            {t('app.dismiss')}
          </button>
          <button type="button" className="button small" onClick={onRestart}>
            {t('notice.restartNow')}
          </button>
        </>
      }
    >
      <p>{t('notice.apoReconfigured')}</p>
    </CompactFrame>
  );
};

/**
 * The live capture's own failure. Same shape as the restart notice: what
 * happened, and the one thing worth trying. Windows refuses the loopback
 * capture for transient reasons — a device changing mid-start, a prompt
 * dismissed — and a second attempt very often works, so there is something
 * better to offer than an apology.
 */
export const CaptureFailedNotice = ({
  onHide,
  onRetry,
}: {
  onHide: () => void;
  onRetry: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <CompactFrame
      className="audio-restart-notice"
      role="status"
      aria-modal={undefined}
      tone="warn"
      icon={<MenuIcon name="alert" />}
      title={t('notice.captureFailed')}
      titleId="capture-failed-title"
      onClose={onHide}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={onHide}
          >
            {t('app.dismiss')}
          </button>
          <button
            type="button"
            className="button small"
            onClick={() => {
              onRetry();
            }}
          >
            {t('notice.tryAgain')}
          </button>
        </>
      }
    >
      <p>{t('notice.captureFailedBody')}</p>
    </CompactFrame>
  );
};

/**
 * A failure that leaves the editor working: a preset that failed to save is
 * no reason to hide an equalizer that is still working, so it is reported in
 * the corner, dismissable.
 */
export const RecoverableErrorNotice = ({
  error,
  onDismiss,
}: {
  error: ErrorDescription;
  onDismiss: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <CompactFrame
      className="workspace-notice"
      role="alert"
      aria-modal={undefined}
      tone="warn"
      icon={<MenuIcon name="alert" />}
      title={errorText(error, t).title}
      titleId="workspace-error-title"
      onClose={onDismiss}
      closeLabel={t('app.dismiss')}
    >
      <p>{errorText(error, t).action}</p>
    </CompactFrame>
  );
};

/**
 * What the last import did. Reported the same way as a recoverable failure —
 * in the corner, dismissable — rather than as a modal alert, because there is
 * nothing to decide and the result is already audible.
 */
export const ImportNotice = ({
  summary,
  onDismiss,
}: {
  summary: string;
  onDismiss: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <CompactFrame
      className="workspace-notice"
      role="status"
      aria-modal={undefined}
      icon={<MenuIcon name="import" />}
      title={t('notice.importComplete')}
      titleId="import-complete-title"
      onClose={onDismiss}
      closeLabel={t('app.dismiss')}
    >
      <p>{summary}</p>
    </CompactFrame>
  );
};
