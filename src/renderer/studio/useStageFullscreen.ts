import { useCallback, useEffect, useState, type RefObject } from 'react';
import {
  claimStageFullScreen,
  isStageFullScreenClaimed,
} from '../utils/stageFullScreen';
import type { TStudioSize } from './StudioStage';

/**
 * The window full screen with the stage, and back. The stage's frame fills
 * the window through the page's own full screen, which no longer moves the
 * window (`disableHtmlFullscreenWindowResize` in `mainWindow.ts`), so the
 * window is asked for as well — claimed first, so the shell finds the claim
 * when the window says it is full screen (`stageFullScreen.ts`), and given
 * back only by the stage that asked, never out from under the app's own.
 */
const holdWindowFullScreen = (next: boolean) => {
  if (next === isStageFullScreenClaimed()) {
    return;
  }
  claimStageFullScreen(next);
  window.electron?.ipcRenderer.setWindowFullScreen(next).catch(() => undefined);
};

/**
 * Fullscreen is the real thing, not a bigger box: a scene that holds at
 * 1080p and falls apart at 4K is the commonest defect there is.
 *
 * Whether the screen is actually full is kept as its own state, read from
 * the browser rather than assumed from the size. The two can part: leaving
 * is a promise that can be refused — mid-transition, or by the window
 * manager — and the refusal was swallowed, which left the screen full with
 * the size back to windowed and the only way out unrendered. That is Ivan's
 * "exit button can't click it sometimes": the button was not there to
 * click, and nothing but Escape was left.
 */
export default function useStageFullscreen(
  frameRef: RefObject<HTMLDivElement | null>,
  size: TStudioSize,
  onExitFullscreen: () => void,
) {
  const [isFullscreen, setIsFullscreen] = useState(
    () =>
      typeof document !== 'undefined' && document.fullscreenElement !== null,
  );
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    setIsFullscreen(document.fullscreenElement === frame);
    if (size === 'full' && document.fullscreenElement !== frame) {
      holdWindowFullScreen(true);
      frame.requestFullscreen().catch(() => onExitFullscreen());
    }
    if (size !== 'full') {
      holdWindowFullScreen(false);
      if (document.fullscreenElement === frame) {
        document.exitFullscreen().catch(() => undefined);
      }
    }
    const onChange = () => {
      const full = document.fullscreenElement === frame;
      setIsFullscreen(full);
      if (size === 'full' && !full) {
        onExitFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [frameRef, size, onExitFullscreen]);
  // A stage taken away while full gives the window back.
  useEffect(() => () => holdWindowFullScreen(false), []);

  /**
   * The way out, from either side: the size goes back to what it was, and
   * the screen is asked to leave fullscreen even when the size already says
   * windowed — which is the state the two can be left in, and where a button
   * that only set the size would do nothing at all.
   */
  const leaveFullscreen = useCallback(() => {
    onExitFullscreen();
    if (document.fullscreenElement === frameRef.current) {
      document.exitFullscreen().catch(() => undefined);
    }
  }, [frameRef, onExitFullscreen]);

  return { isFullscreen, leaveFullscreen };
}
