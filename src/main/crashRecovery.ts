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

export const installWindowRecovery = (
  window: BrowserWindow,
  rendererUrl: string,
  stopPlayback: () => Promise<void>,
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

  const notice = (state: 'blocked' | 'failed') => {
    if (available() && !contents.isCrashed()) {
      contents.send(ChannelEnum.RECOVERY_STATUS, state);
    }
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
        detail: t('recovery.stopped'),
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
    try {
      log.warn('Recovering FluidEQ window', { automatic, automaticReloads });
      // Destroy the failed document before draining writes and stopping its
      // native player. React cleanup cannot run after a C++ renderer crash,
      // and a still-live failed page could otherwise start playback again.
      try {
        await contents.loadURL('about:blank');
      } finally {
        // Even a failed navigation must stop the native audio owner.
        await stopPlayback();
        await flushPendingWrites();
      }
      if (!available()) {
        return;
      }
      if (exhausted) {
        log.error('Automatic window recovery budget exhausted');
        notice('blocked');
        needsPrompt = true;
      } else {
        // Always our entry point, never a URL supplied by the failed page.
        loadingApp = true;
        await contents.loadURL(rendererUrl);
      }
    } catch (error) {
      log.error('Window recovery failed; automatic retry stopped', error);
      notice('failed');
      needsPrompt = true;
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
      recover(true).catch(log.error);
    }
  });
  contents.on('preload-error', (_event, _path, error) => {
    log.error('Main window preload failed', error);
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
