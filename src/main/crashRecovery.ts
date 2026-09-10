/* FluidEQ — GPL-3.0-or-later */
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';
import ChannelEnum from '../common/channels';
import { translate } from '../common/i18n';
import { PRODUCT_NAME } from '../common/branding';
import { flushPendingWrites } from './asyncWriter';
import { getTrayLocale, isAppQuitting } from './tray';

// Kept outside the page: a counter in React or sessionStorage can disappear
// with the very native renderer crash it is supposed to contain. Successful
// page loads do not replenish it; startup crash loops must exhaust it too.
const AUTOMATIC_RELOAD_LIMIT = 2;
const MAIN_RESTART_ARGUMENT = '--fluideq-error-restarted';

/** Enough to hold a crash loop's worth of entries without a dialog taller
 * than the screen: the message plus the first ten or so stack frames of a
 * React error is about 1.5 KB, and five entries stay readable on a 1080p
 * display in the native message box, which wraps but never scrolls. */
const FAILURE_JOURNAL_LIMIT = 5;
const FAILURE_ENTRY_LIMIT = 1_500;
const failureJournal: string[] = [];

/**
 * Keep the last few failures in memory so the recovery dialog can show them.
 *
 * In development the generic "could not recover safely" text hid the one thing
 * the developer needed — the React error, the renderer's exit reason, the
 * preload stack — and finding it meant opening the log file the dialog had just
 * refused to describe. Everything the window reports through LOG_ERROR and
 * everything main sees about the renderer process lands here, already redacted
 * by the caller, so the dialog can print it verbatim in a debug build.
 */
export const recordFailure = (source: string, detail: string) => {
  const stamp = new Date().toISOString().slice(11, 19);
  const body = detail.trim();
  const entry = `[${stamp}] ${source}${body ? `\n${body}` : ''}`;
  failureJournal.push(
    entry.length > FAILURE_ENTRY_LIMIT
      ? `${entry.slice(0, FAILURE_ENTRY_LIMIT)}\n…`
      : entry,
  );
  if (failureJournal.length > FAILURE_JOURNAL_LIMIT) {
    failureJournal.splice(0, failureJournal.length - FAILURE_JOURNAL_LIMIT);
  }
};

const describeError = (error: unknown) =>
  error instanceof Error
    ? (error.stack ?? `${error.name}: ${error.message}`)
    : String(error);

/** The journal, oldest first, followed by where the full log file lives. */
export const describeFailures = () =>
  [...failureJournal, log.transports.file.getFile().path].join('\n\n');

export const installWindowRecovery = (
  window: BrowserWindow,
  rendererUrl: string,
  stopPlayback: () => Promise<void>,
  /** Debug builds put the failure journal in the dialog instead of the
   * reassurance written for users; the log entries are what a developer needs. */
  showFailureLog = false,
) => {
  const contents = window.webContents;
  let automaticReloads = 0;
  let recovering = false;
  let prompting = false;
  let loadingApp = false;
  let failedDuringLoad = false;
  let shuttingDown = false;
  const onQuit = () => {
    shuttingDown = true;
  };
  app.on('before-quit', onQuit);
  const available = () =>
    !shuttingDown &&
    !isAppQuitting() &&
    !window.isDestroyed() &&
    !contents.isDestroyed();

  /** Tell the page recovery has stopped. False when there is no page to tell,
   * which is the only case a native message box has to stand in for one. */
  const notice = (state: 'blocked' | 'failed') => {
    // Only the app document has a crash screen to update. After a teardown the
    // page is about:blank, which listens to nothing and would swallow the
    // message, leaving the window blank with no way out of the failure.
    if (
      !available() ||
      contents.isCrashed() ||
      contents.isLoading() ||
      contents.getURL().split('#')[0] !== rendererUrl.split('#')[0]
    ) {
      return false;
    }
    // The journal only travels in a debug build. A user's crash screen shows
    // the one error React caught; a developer's shows every entry behind it.
    contents.send(
      ChannelEnum.RECOVERY_STATUS,
      state,
      showFailureLog ? describeFailures() : '',
    );
    return true;
  };

  const showFailure = async () => {
    if (!available() || prompting) {
      return;
    }
    prompting = true;
    try {
      const t = (
        key:
          | 'recovery.title'
          | 'recovery.stopped'
          | 'recovery.reload'
          | 'recovery.quit',
      ) => translate(getTrayLocale(), key);
      const { response } = await dialog.showMessageBox(window, {
        type: 'error',
        title: PRODUCT_NAME,
        message: t('recovery.title'),
        detail: showFailureLog ? describeFailures() : t('recovery.stopped'),
        buttons: [t('recovery.reload'), t('recovery.quit')],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (available()) {
        if (response === 0) {
          recover(false).catch(log.error);
        } else {
          app.quit();
        }
      }
    } catch (error) {
      log.error('Could not show recovery controls', error);
    } finally {
      prompting = false;
    }
  };

  const recover = async (automatic: boolean) => {
    if (!available() || (prompting && automatic)) {
      return;
    }
    if (recovering) {
      if (loadingApp) {
        failedDuringLoad = true;
      }
      return;
    }
    const exhausted = automatic && automaticReloads >= AUTOMATIC_RELOAD_LIMIT;
    if (automatic && !exhausted) {
      automaticReloads += 1;
    }
    recovering = true;
    let needsPrompt = false;
    // Destroy the failed document before draining writes and stopping its
    // native player. React cleanup cannot run after a C++ renderer crash,
    // and a still-live failed page could otherwise start playback again.
    const discardPage = async () => {
      try {
        await contents.loadURL('about:blank');
      } finally {
        // Even a failed navigation must stop the native audio owner.
        await stopPlayback();
        await flushPendingWrites();
      }
    };
    try {
      log.warn('Recovering FluidEQ window', { automatic, automaticReloads });
      if (exhausted) {
        log.error('Automatic window recovery budget exhausted');
        recordFailure('Automatic window recovery budget exhausted', '');
        // Hand the end of the road back to the page whenever the page can
        // still paint. Its crash screen scrolls, selects, copies and is
        // written in the app's own language; a native message box does none
        // of that, and in development it turned a React stack into an
        // unreadable wall. The box is the fallback for a dead document, not
        // the default. Nothing is blanked here: the screen is the last thing
        // left saying what happened.
        const shown = notice('blocked');
        if (shown) {
          // The page keeps its DOM, but not the audio it can no longer own.
          await stopPlayback();
          await flushPendingWrites();
        } else {
          await discardPage();
        }
        needsPrompt = !shown;
      } else {
        await discardPage();
        if (!available()) {
          return;
        }
        // Always our entry point, never a URL supplied by the failed page.
        loadingApp = true;
        await contents.loadURL(rendererUrl);
      }
    } catch (error) {
      log.error('Window recovery failed; automatic retry stopped', error);
      recordFailure(
        'Window recovery failed; automatic retry stopped',
        describeError(error),
      );
      needsPrompt = !notice('failed');
    } finally {
      loadingApp = false;
      recovering = false;
    }
    // Finish this flight before a dialog can start the next. Otherwise the
    // old finally block could clear the new flight's reentrancy guard.
    if (needsPrompt) {
      failedDuringLoad = false;
      await showFailure();
    } else if (failedDuringLoad) {
      failedDuringLoad = false;
      await recover(true);
    }
  };

  const request = (event: Electron.IpcMainEvent, args: unknown) => {
    if (
      !available() ||
      event.sender !== contents ||
      event.senderFrame !== contents.mainFrame ||
      contents.getURL().split('#')[0] !== rendererUrl.split('#')[0] ||
      !Array.isArray(args) ||
      args.length !== 1 ||
      (args[0] !== 'automatic' && args[0] !== 'manual')
    ) {
      return;
    }
    recover(args[0] === 'automatic').catch(log.error);
  };
  ipcMain.on(ChannelEnum.RECOVER_WINDOW, request);
  contents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') {
      log.error('Renderer process gone', details);
      recordFailure(
        `Renderer process gone: ${details.reason} (exit code ${details.exitCode})`,
        '',
      );
      recover(true).catch(log.error);
    }
  });
  contents.on('preload-error', (_event, path, error) => {
    log.error('Main window preload failed', error);
    recordFailure(`Main window preload failed: ${path}`, describeError(error));
    recover(true).catch(log.error);
  });
  contents.once('destroyed', () => {
    ipcMain.removeListener(ChannelEnum.RECOVER_WINDOW, request);
    app.removeListener('before-quit', onQuit);
  });
  return () => recover(true);
};

/** An uncaught main-process error leaves application invariants unknown.
 * Logging alone suppresses Node's exit and keeps that damaged process alive.
 * A fresh process may recover; continuing to write settings in this one may not.
 * Native aborts in main never enter JS handlers and require external supervision.
 */
export const installMainFailureRecovery = () => {
  let exiting = false;
  let shuttingDown = false;
  app.on('before-quit', () => {
    shuttingDown = true;
  });
  const fatal = (reason: unknown) => {
    if (exiting) {
      app.exit(1);
      return;
    }
    exiting = true;
    try {
      log.error('Fatal main-process error', reason);
      if (
        app.isPackaged &&
        !shuttingDown &&
        !isAppQuitting() &&
        !process.argv.includes(MAIN_RESTART_ARGUMENT)
      ) {
        app.relaunch({
          args: [...process.argv.slice(1), MAIN_RESTART_ARGUMENT],
        });
      }
    } finally {
      // Do not run async save/quit hooks against potentially partial state.
      // The replacement reads only the last settings already on disk.
      app.exit(1);
    }
  };
  process.on('uncaughtException', fatal);
  process.on('unhandledRejection', fatal);
};
