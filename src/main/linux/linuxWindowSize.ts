/* FluidEQ — GPL-3.0-or-later */
import type { BrowserWindow } from 'electron';
import type { ISize } from '../../common/windowMode';

interface ISizeHold {
  size: ISize;
  release: () => void;
}

const holds = new WeakMap<BrowserWindow, ISizeHold>();

export const linuxWindowSizeOf = (win: BrowserWindow): ISize | undefined =>
  holds.get(win)?.size;

export const releaseLinuxWindowSize = (win: BrowserWindow) => {
  const hold = holds.get(win);
  if (hold) {
    holds.delete(win);
    hold.release();
  }
};

export const holdLinuxWindowSize = (
  win: BrowserWindow,
  size: ISize,
  onRelease: () => void,
) => {
  releaseLinuxWindowSize(win);
  // Electron's synchronous unmaximize/bounds events precede the compositor's
  // final configure. Its restored frame insets can then enlarge the amp.
  // Keep the chosen size as a native ceiling until the renderer has actually
  // drawn it, using the existing reveal message as the acknowledgement.
  const release = () => releaseLinuxWindowSize(win);
  const contents = win.webContents;
  holds.set(win, {
    size: { ...size },
    release: () => {
      contents.removeListener('did-start-loading', release);
      contents.removeListener('render-process-gone', release);
      win.removeListener('closed', release);
      if (!win.isDestroyed()) {
        onRelease();
      }
    },
  });
  contents.once('did-start-loading', release);
  contents.once('render-process-gone', release);
  win.once('closed', release);
};
