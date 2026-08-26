/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface IDevSessionQuitApp {
  once(event: 'quit', listener: () => void): unknown;
}

export interface IDevSessionHostProcess {
  env: NodeJS.ProcessEnv;
  ppid: number;
  prependListener(
    event: 'message',
    listener: (message: unknown) => void,
  ): unknown;
  removeListener(
    event: 'message',
    listener: (message: unknown) => void,
  ): unknown;
  kill(pid: number, signal: NodeJS.Signals): boolean;
}

/**
 * End the dev launcher when the Electron application deliberately quits.
 *
 * electronmon deliberately survives a normal application exit so a later
 * file change can restart it. That is useful after a crash, but surprising
 * when Quit was intentional: the terminal remains occupied until Ctrl+C and
 * Windows then asks whether to terminate the batch job.
 *
 * Main-file hot restarts use electronmon's `reset` IPC message. Its listener
 * was registered before dev-main.cjs, so this listener is prepended to mark
 * that restart before electronmon calls app.quit().
 */
export const exitDevSessionOnAppQuit = (
  app: IDevSessionQuitApp,
  hostProcess: IDevSessionHostProcess = process as unknown as IDevSessionHostProcess,
): void => {
  if (hostProcess.env.FLUIDEQ_EXIT_DEV_SESSION_ON_QUIT !== '1') {
    return;
  }

  let restartingForFileChange = false;
  const markFileChangeRestart = (message: unknown) => {
    if (message === 'reset') {
      restartingForFileChange = true;
    }
  };
  hostProcess.prependListener('message', markFileChangeRestart);

  app.once('quit', () => {
    hostProcess.removeListener('message', markFileChangeRestart);
    if (restartingForFileChange) {
      return;
    }

    const monitorPid = hostProcess.ppid;
    if (!Number.isSafeInteger(monitorPid) || monitorPid <= 0) {
      return;
    }
    try {
      hostProcess.kill(monitorPid, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        // The app is already exiting, so report the launcher failure without
        // turning a successful application quit into a crash.
        // eslint-disable-next-line no-console
        console.error('Could not stop the FluidEQ dev session.', error);
      }
    }
  });
};
