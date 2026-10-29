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
        !frames.canPlace() ||
        window.isDestroyed() ||
        window.isFullScreen() ||
        window.isSimpleFullScreen()
      ) {
        return;
      }
      const positionToApply = target;
      applying = true;
      try {
        frames.withoutAnimation(() => {
          window.setWindowButtonPosition(positionToApply);
          frames.align(positionToApply);
        });
      } finally {
        applying = false;
      }
    };
    const frames = watchMacTitlebar(window, () => {
      if (
        applying ||
        !target ||
        !frames.canPlace() ||
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
          Math.abs(actual.y - target.y) > 0.5 ||
          !actual.aligned)
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
      if (target?.x === next.x && target.y === next.y) {
        const actual = frames.read();
        if (
          actual &&
          actual.aligned &&
          Math.abs(actual.x - next.x) <= 0.5 &&
          Math.abs(actual.y - next.y) <= 0.5
        ) {
          // Focus/show/overlay pushes can repeat the unchanged page slot.
          // Redrawing that native container again creates a needless flash.
          return;
        }
      }
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
