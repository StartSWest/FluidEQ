/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_UPDATE_EVENT, IAppUpdateStatus } from 'common/constants';
import { LATEST_RELEASE_URL } from 'common/branding';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import '../styles/OverlayCard.scss';

/**
 * How long "Installing…" is allowed to mean anything before it stops.
 *
 * `quitAndInstall` normally ends this window, so a timer that fires is a timer
 * whose process should not have been alive to run it. It exists for the case
 * where the call returns without throwing and without quitting — a downloaded
 * file that failed verification does exactly that — which would otherwise leave
 * the dialog spinning on a promise that will never settle either way.
 */
const INSTALL_TIMEOUT_MS = 20000;

/**
 * How long a dismissal lasts.
 *
 * Fifteen minutes, and the number was argued rather than picked:
 *
 *   - **Shorter than the hourly re-check.** Main asks GitHub once an hour, so
 *     anything longer than that would mean the reminder was routinely staler
 *     than the information behind it, and a user could dismiss once and work an
 *     entire afternoon without being asked again. Forgettable is the failure
 *     this interval exists to prevent.
 *   - **Longer than a piece of work in this app.** Importing a curve, tuning
 *     it, A/B-ing it against the old one and saving is a few minutes. At five
 *     minutes the dialog would land in the middle of that, repeatedly, which is
 *     the cruelty the decision to make it closable was meant to avoid — and a
 *     dialog people learn to swat without reading has stopped being a warning.
 *   - **Often enough to be a presence.** Over a three-hour session it appears
 *     about a dozen times. "Later" stays available and stops being comfortable.
 *   - **Not a round hour.** It never drifts into sync with the hourly check, so
 *     the reminder and a fresh failure notice do not arrive together as one
 *     burst and then leave a long silence.
 */
export const REMINDER_INTERVAL_MS = 15 * 60 * 1000;

/**
 * The notice for a release that said it must be taken.
 *
 * ## Insistent, not blocking
 *
 * This started as a gate that could not be closed, and that was the wrong
 * instrument. A one-person paid application that can remotely make an
 * installation unusable has a worst case worse than most of the faults it would
 * be reached for, and the person it strands is someone who paid. So it closes —
 * and then it comes back, every {@link REMINDER_INTERVAL_MS}, for as long as
 * the update is still pending. The user can finish what they are doing. They
 * cannot forget.
 *
 * The text carries that distinction rather than leaving it to the chrome: the
 * failure mode of a dismissable notice is that it reads like an ordinary update
 * banner, so it says in as many words that this release is not optional and
 * that closing it is a postponement.
 *
 * ## Latched, in memory, for the session
 *
 * Once a check has said mandatory, a later check saying nothing does not take
 * it back. Otherwise the hourly re-check would cancel the whole thing the
 * moment the network went away, which is both wrong and the easiest state to
 * reach.
 *
 * The latch is React state and is never written to disk. Restarting the app
 * clears it, and a release that really is mandatory says so again within
 * seconds of the next check.
 *
 * ## Focus
 *
 * No focus lock, deliberately, and this is the difference from `DisclaimerGate`
 * — which keeps one, because it genuinely is a gate. A lock here would defeat
 * the point twice over: its Escape handler swallows the key this dialog now
 * closes on, and its `focusin` handler would drag focus back out of the
 * workspace the user was let back into. The dialog takes focus when it opens,
 * because an `alertdialog` appearing unannounced is worse than one that
 * announces itself, and it lets focus go wherever the user sends it next.
 *
 * ## It must never become a dead end
 *
 * Every path out of "downloading" leads somewhere that says something:
 *
 *   - the updater errors — main forwards it and the reason appears here;
 *   - the install call rejects — caught, and the same treatment;
 *   - the install call neither rejects nor quits — the timeout above catches
 *     it, because a promise that never settles is the one failure a `catch`
 *     cannot see;
 *   - anything at all — the release page is a link from the moment the failure
 *     is shown, so there is always a way to finish the job by hand.
 *
 * The link is a plain `<a target="_blank">`. Main's `setWindowOpenHandler`
 * turns that into `shell.openExternal`, which is how every other outbound link
 * in the app works; a new IPC channel here would be a second mechanism to keep
 * working for no gain.
 */
const MandatoryUpdateModal = () => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isMandatory, setIsMandatory] = useState(false);
  const [status, setStatus] = useState<IAppUpdateStatus>();
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  // Set locally when the install attempt fails in a way main cannot see: a
  // rejected invoke, or a call that returned and did not quit.
  const [localFailure, setLocalFailure] = useState<'install'>();

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      APP_UPDATE_EVENT,
      (...args: unknown[]) => {
        const next = args[0] as IAppUpdateStatus | undefined;
        if (!next) {
          return;
        }
        // `=== true` rather than a truthy test. The whole feature is built so
        // that this needs an explicit positive, and a stray truthy value
        // arriving over IPC should not be able to supply one.
        if (next.isMandatory === true) {
          setIsMandatory(true);
        }
        setStatus(next);
        if (next.phase !== 'failed') {
          // A download that started again clears the last complaint, so a
          // recovered check does not leave a stale error on screen.
          setLocalFailure(undefined);
        }
        // New information earns its way back through a dismissal; progress
        // does not. The same rule the ordinary update banner follows: a
        // download finishing, or a failure the user has not been told about,
        // is something they did not know a moment ago.
        if (next.phase === 'ready' || next.phase === 'failed') {
          setIsDismissed(false);
        }
      },
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const isOpen = isMandatory && !isDismissed;

  /**
   * Bring it back after a dismissal.
   *
   * The timer exists only while dismissed, which is what stops it stacking: an
   * open dialog has no pending timer to fire into it, and re-opening clears the
   * one that was running by changing the dependency. It is also gated on the
   * update still being pending, so nothing is scheduled before a mandatory
   * release has been seen — and the cleanup runs on unmount, so a window closed
   * fourteen minutes into a wait cannot set state on a component that is gone.
   */
  useEffect(() => {
    if (!isMandatory || !isDismissed) {
      return undefined;
    }
    const timer = window.setTimeout(
      () => setIsDismissed(false),
      REMINDER_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isMandatory, isDismissed]);

  const handleClose = useCallback(() => setIsDismissed(true), []);

  // Escape closes it. Nothing swallows the key any more — that was the focus
  // lock, and this dialog no longer has one.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  // Announced when it appears, and then focus is the user's again.
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const failure =
    localFailure ?? (status?.phase === 'failed' ? status.failure : undefined);
  const hasFailed = failure !== undefined;
  const isReady = status?.phase === 'ready';

  const handleInstall = () => {
    setIsInstalling(true);
    setLocalFailure(undefined);
    const timer = window.setTimeout(() => {
      setIsInstalling(false);
      setLocalFailure('install');
    }, INSTALL_TIMEOUT_MS);
    window.electron.ipcRenderer.installUpdate().catch(() => {
      window.clearTimeout(timer);
      setIsInstalling(false);
      setLocalFailure('install');
    });
  };

  let progress: string | undefined;
  if (isReady) {
    progress = t('update.mandatory.readyPrompt');
  } else if (status?.phase === 'downloading') {
    progress = t('update.downloading', { percent: status.percent ?? 0 });
  } else if (!hasFailed) {
    progress = t('update.mandatory.waiting');
  }

  const percent =
    status?.phase === 'downloading'
      ? Math.max(0, Math.min(100, status.percent ?? 0))
      : undefined;

  return (
    <div
      className="overlay-card__backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`overlay-card${hasFailed ? ' overlay-card--alert' : ''}`}
        // Focusable but not in the tab order, so the dialog itself is what
        // announces on open rather than whichever button happens to be first —
        // which, on the close button, would put Enter on "later".
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mandatory-update-title"
        aria-describedby="mandatory-update-body"
      >
        <div className="overlay-card__header">
          <MenuIcon name="restart" className="overlay-card__mark" />
          <h2 id="mandatory-update-title">{t('update.mandatory.title')}</h2>
          <button
            type="button"
            className="overlay-card__close"
            aria-label={t('app.dismiss')}
            onClick={handleClose}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <div className="overlay-card__body" id="mandatory-update-body">
          <p>{t('update.mandatory.body')}</p>
          {/* The line that keeps this from reading as an ordinary update
              notice. It is the whole difference between a dialog somebody
              closes and one they close and then act on. */}
          <p className="overlay-card__insist">
            {t('update.mandatory.notOptional')}
          </p>

          {progress && <p>{progress}</p>}
          {percent !== undefined && (
            <div
              className="overlay-card__progress"
              role="progressbar"
              // Named by the dialog's own heading rather than by a label of
              // its own: the percentage is already read out of the line above
              // it, and a second string saying "update progress" would only be
              // one more thing to translate.
              aria-labelledby="mandatory-update-title"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="overlay-card__progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          {hasFailed && (
            <>
              <p className="overlay-card__failure">
                {failure === 'install'
                  ? t('update.mandatory.failedInstall')
                  : t('update.mandatory.failedDownload')}
              </p>
              <p>{t('update.mandatory.manual')}</p>
              <p>
                <a href={LATEST_RELEASE_URL} target="_blank" rel="noreferrer">
                  {t('update.mandatory.releasePage')}
                </a>
              </p>
              {/* The address in full as well as the link, so somebody whose
                  browser will not open from here can still type it. */}
              <p>{LATEST_RELEASE_URL}</p>
            </>
          )}
        </div>

        <div className="overlay-card__footer">
          <button
            type="button"
            className="overlay-card__button overlay-card__button--quiet"
            onClick={handleClose}
          >
            {t('update.mandatory.later')}
          </button>
          <button
            type="button"
            className="overlay-card__button"
            disabled={!isReady || isInstalling}
            onClick={handleInstall}
          >
            {isInstalling
              ? t('update.mandatory.installing')
              : t('update.mandatory.install')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MandatoryUpdateModal;
