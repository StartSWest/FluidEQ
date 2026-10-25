/* FluidEQ — GPL-3.0-or-later */

import type { BrowserWindow, Point } from 'electron';
import log from 'electron-log';
import watchMacTitlebar from './macTitlebarFrames';

const placements = new WeakMap<BrowserWindow, (position: Point) => void>();

/** Keep Electron's requested position in step with AppKit's actual frames. */
export default function placeMacTrafficLights(
  window: BrowserWindow,
  position: Point,
) {
  let place = placements.get(window);
  if (!place) {
    let target: Point | undefined;
    let applying = false;
    const apply = () => {
      if (
        applying ||
        !target ||
        window.isDestroyed() ||
        window.isFullScreen() ||
        window.isSimpleFullScreen()
      ) {
        return;
      }
      applying = true;
      try {
        window.setWindowButtonPosition(target);
      } finally {
        applying = false;
      }
    };
    const frames = watchMacTitlebar(window, () => {
      if (
        applying ||
        !target ||
        window.isDestroyed() ||
        window.isFullScreen() ||
        window.isSimpleFullScreen()
      ) {
        return;
      }
      const actual = frames.read();
      if (
        actual &&
        !actual.hidden &&
        (Math.abs(actual.x - target.x) > 0.5 ||
          Math.abs(actual.y - target.y) > 0.5)
      ) {
        apply();
        log.debug('Mac window controls after native titlebar layout', {
          before: actual,
          after: frames.read(),
          target,
        });
      }
    });
    place = (next) => {
      target = next;
      apply();
    };
    placements.set(window, place);
    window.once('closed', () => {
      placements.delete(window);
      frames.stop();
    });
  }
  place(position);
}
