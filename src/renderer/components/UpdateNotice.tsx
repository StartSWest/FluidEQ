/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { useEffect, useState } from 'react';
import { APP_UPDATE_EVENT, IAppUpdateStatus } from 'common/constants';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import '../styles/UpdateNotice.scss';

/**
 * Says a new FluidEQ is on the way, and then that it is ready.
 *
 * Nothing at all until there is something to say. There is no "checking for
 * updates" state and no "you are up to date" state, because both are the normal
 * outcome of every launch and putting either on screen would mean greeting the
 * user with a message that nothing happened.
 *
 * Dismissable, and it stays dismissed for the session. An update that is ready
 * to install is not urgent — the current version is working — and a banner that
 * cannot be got rid of is a worse citizen than one the user closes and finds
 * again next time they start the app.
 */
const UpdateNotice = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<IAppUpdateStatus>();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      APP_UPDATE_EVENT,
      (...args: unknown[]) => {
        const next = args[0] as IAppUpdateStatus | undefined;
        if (!next) {
          return;
        }
        setStatus(next);
        // A download finishing is new information, so it earns the right to
        // come back after a dismissal. Progress updates do not.
        if (next.phase === 'ready') {
          setIsDismissed(false);
        }
      },
    );
    return () => {
      unsubscribe();
    };
  }, []);

  if (!status || isDismissed) {
    return null;
  }

  const isReady = status.phase === 'ready';
  let message = t('update.available', { version: status.version ?? '' });
  if (status.phase === 'downloading') {
    message = t('update.downloading', { percent: status.percent ?? 0 });
  } else if (isReady) {
    message = t('update.ready', { version: status.version ?? '' });
  }

  return (
    <div className="update-notice" role="status">
      <MenuIcon name="restart" className="update-notice__icon" />
      <div>
        <strong>{t('update.title')}</strong>
        <span>{message}</span>
      </div>
      {isReady && (
        <button
          type="button"
          className="update-notice__install"
          disabled={isInstalling}
          onClick={() => {
            setIsInstalling(true);
            window.electron.ipcRenderer
              .installUpdate()
              .catch(() => setIsInstalling(false));
          }}
        >
          {isInstalling ? t('update.restarting') : t('update.restart')}
        </button>
      )}
      <button
        type="button"
        className="update-notice__dismiss"
        aria-label={t('app.dismiss')}
        onClick={() => setIsDismissed(true)}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
};

export default UpdateNotice;
