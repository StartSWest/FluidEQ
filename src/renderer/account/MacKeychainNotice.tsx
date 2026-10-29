/* FluidEQ — GPL-3.0-or-later */

import { useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';

/** A failed Mac Keychain launch can recover; it is not an unsupported OS. */
const MacKeychainNotice = () => {
  const { t } = useTranslation();
  const [restarting, setRestarting] = useState(false);
  const [manual, setManual] = useState(false);
  const restart = async () => {
    if (restarting) {
      return;
    }
    setRestarting(true);
    setManual(false);
    try {
      const accepted =
        await window.electron.ipcRenderer.restartForMacKeychain();
      if (!accepted) {
        setManual(true);
        setRestarting(false);
      }
    } catch (error) {
      reportError('Could not restart FluidEQ for Mac Keychain access', error);
      setManual(true);
      setRestarting(false);
    }
  };
  return (
    <div className="account__notice" role="status">
      <span className="account__notice-title">
        {t('account.macKeychainTitle')}
      </span>
      <span>{t('account.macKeychainHint')}</span>
      <div className="account__actions">
        <button
          type="button"
          className="button small"
          disabled={restarting}
          onClick={restart}
        >
          {t(
            restarting
              ? 'account.macKeychainRestarting'
              : 'account.macKeychainRestart',
          )}
        </button>
      </div>
      {manual && (
        <span className="account__error" role="alert">
          {t('account.macKeychainManual')}
        </span>
      )}
    </div>
  );
};

export default MacKeychainNotice;
