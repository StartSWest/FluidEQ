import { useCallback, useEffect, type RefObject } from 'react';
import {
  claimStageFullScreen,
  isStageFullScreenClaimed,
} from '../utils/stageFullScreen';
import type { TStudioSize } from './StudioStage';
import useFullscreenShown from './useFullscreenShown';

/**
 * The window full screen with the stage, and back. The stage's frame fills
 * the window through the page's own full screen, which no longer moves the
 * window (`disableHtmlFullscreenWindowResize` in `mainWindow.ts`), so the
 * window is asked for as well — claimed first, so the shell finds the claim
 * when the window says it is full screen (`stageFullScreen.ts`), and given
 * back only by the stage that asked, never out from under the app's own.
 *
 * Answers the window's reply when one was asked for: main sets the window's
 * state inside the call (`windowMode.ts`), and on Windows the window has
 * finished resizing by the time it replies.
 */
const holdWindowFullScreen = (next: boolean): Promise<unknown> | undefined => {
  if (next === isStageFullScreenClaimed()) {
    return undefined;
  }
  claimStageFullScreen(next);
  return window.electron?.ipcRenderer
    .setWindowFullScreen(next)
    .catch(() => undefined);
};

/**
 * Out of full screen, the window first and the element after it.
 *
 * Both at once, the element's exit — a round trip inside the page — can land
 * before the window's, which goes through main and Windows, and for those
 * frames the window's layout would stand over the whole screen, the chat
 * beside a stage a screen wide, until the window shrank under it: the same
 * picture the page drew when its layout followed the press. The window
 * first, the full-screen layout shrinks with it and the window's layout
 * comes back once, at the window's size. Coming in is the other way round
 * already: the element fills the window at once and the window grows with
 * it.
 *
 * Asked twice — the way-out button, then the size it set going back — the
 * second waits on the same answer rather than leaving at once, and a press
 * back into full screen meanwhile (the window claimed again) keeps the
 * element where it is.
 */
let windowLeaving: Promise<unknown> | undefined;
const leaveScreen = (frame: Element) => {
  const exitElement = () => {
    if (!isStageFullScreenClaimed() && document.fullscreenElement === frame) {
      document.exitFullscreen().catch(() => undefined);
    }
  };
  const released = holdWindowFullScreen(false);
  if (released) {
    windowLeaving = released;
  }
  const waiting = windowLeaving;
  if (!waiting) {
    exitElement();
    return;
  }
  const answered = () => {
    if (windowLeaving === waiting) {
      windowLeaving = undefined;
    }
    exitElement();
  };
  waiting.then(answered, answered);
};

/**
 * Fullscreen is the real thing, not a bigger box: a scene that holds at
 * 1080p and falls apart at 4K is the commonest defect there is.
 *
 * Whether the screen is actually full is kept apart from the size, read from
 * the browser (`useFullscreenShown.ts`). The two can part: leaving is a
 * promise that can be refused — mid-transition, or by the window manager —
 * and the refusal was swallowed, which left the screen full with the size
 * back to windowed and the only way out unrendered. That is Ivan's "exit
 * button can't click it sometimes": the button was not there to click, and
 * nothing but Escape was left. The size is what was asked for; what is drawn
 * full screen follows the screen.
 */
export default function useStageFullscreen(
  frameRef: RefObject<HTMLDivElement | null>,
  size: TStudioSize,
  onExitFullscreen: () => void,
  /**
   * What fills the screen, when it is more than the stage: the Studio's
   * grid, so its work pane and chat can stand over the scene in full screen
   * (`useFullscreenPanes.ts`). The stage itself otherwise.
   */
  targetRef?: RefObject<HTMLElement | null>,
) {
  const target = targetRef ?? frameRef;
  const isFullscreen = useFullscreenShown(target);
  useEffect(() => {
    const frame = target.current;
    if (!frame) {
      return undefined;
    }
    if (size === 'full') {
      holdWindowFullScreen(true);
      if (document.fullscreenElement !== frame) {
        frame.requestFullscreen().catch(() => onExitFullscreen());
      }
    } else {
      leaveScreen(frame);
    }
    const onChange = () => {
      if (size === 'full' && document.fullscreenElement !== frame) {
        onExitFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [target, size, onExitFullscreen]);
  // A stage taken away while full gives the window back.
  useEffect(
    () => () => {
      holdWindowFullScreen(false);
    },
    [],
  );

  /**
   * The way out, from either side: the size goes back to what it was, and
   * the screen is asked to leave fullscreen even when the size already says
   * windowed — which is the state the two can be left in, and where a button
   * that only set the size would do nothing at all.
   */
  const leaveFullscreen = useCallback(() => {
    onExitFullscreen();
    const frame = target.current;
    if (frame) {
      leaveScreen(frame);
    }
  }, [target, onExitFullscreen]);

  return { isFullscreen, leaveFullscreen };
}
