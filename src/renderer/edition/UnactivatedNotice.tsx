/* FluidEQ — GPL-3.0-or-later */

import { useState } from 'react';
import { requestAccountPanel } from '../account/accountPanel';
import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { isUnactivated, useSignedEdition } from './useSignedEdition';
import '../styles/Edition.scss';

/**
 * A signed copy running with no owning account signed in (Ivan,
 * 2026-11-11): it keeps working fully and gets no updates, and says so in
 * one quiet notice with the two ways out: Sign in, the one it asks for, and
 * Buy. It never blocks or changes anything else, and it can be put away for
 * the session; signing in with an owning account ends it by itself.
 */
export default function UnactivatedNotice() {
  const { t } = useTranslation();
  const status = useSignedEdition();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !isUnactivated(status)) {
    return null;
  }
  const signedOut = status?.account === 'signed-out';
  const offer = status?.price
    ? t('update.onSite.getAuto', { price: status.price })
    : t('update.onSite.getAutoNoPrice');
  return (
    <CompactFrame
      className="edition-notice"
      icon={<MenuIcon name="shield" />}
      tone="warn"
      title={t('edition.notActivated')}
      titleId="edition-notice-title"
      role="status"
      aria-modal={undefined}
      onClose={() => setDismissed(true)}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              window.electron?.ipcRenderer
                ?.signedEditionBuy?.()
                .catch(() => undefined);
            }}
          >
            {offer}
          </button>
          {signedOut && (
            <button
              type="button"
              className="button small"
              onClick={() => requestAccountPanel()}
            >
              {t('account.signIn')}
            </button>
          )}
        </>
      }
    >
      <p>
        {signedOut
          ? t('edition.notActivatedSignIn')
          : t('edition.notActivatedHint')}
      </p>
    </CompactFrame>
  );
}
