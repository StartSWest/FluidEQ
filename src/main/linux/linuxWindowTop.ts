/* FluidEQ — GPL-3.0-or-later */
import { screen, type BrowserWindow } from 'electron';

const correcting = new WeakSet<BrowserWindow>();

const keepLinuxWindowTopVisible = (win: BrowserWindow) => {
  if (
    correcting.has(win) ||
    win.isDestroyed() ||
    win.isMaximized() ||
    win.isFullScreen()
  ) {
    return;
  }
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const scale = display.scaleFactor > 0 ? display.scaleFactor : 1;
  const deviceTop = Math.ceil(area.y * scale);
  const edge = Math.ceil(deviceTop / scale);
  // A frameless Linux window can be dragged with its caption behind the
  // desktop panel or above the screen. Keep that caption reachable without
  // changing the chosen width, height, or horizontal placement.
  if (bounds.y < edge) {
    // At 125%, the work-area edge can lie between device pixels. Rounding
    // it down through the native shadow insets put y=25 back at y=24 and
    // emitted another synchronous move. Choose an inward integer-DIP edge
    // and do not reenter while that correction is being applied.
    const top = Number.isInteger(scale)
      ? edge
      : Math.ceil((deviceTop + 1) / scale);
    correcting.add(win);
    try {
      win.setPosition(bounds.x, top);
    } finally {
      correcting.delete(win);
    }
  }
};

export default keepLinuxWindowTopVisible;
