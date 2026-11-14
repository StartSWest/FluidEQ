import { type RefObject, useEffect } from 'react';
import { READING_ZOOM_KEYS_CHANNEL, zoomKeyOf } from 'common/readingZoom';
import {
  largerForumText,
  resetForumText,
  smallerForumText,
} from './forumTextSize';

/**
 * Ctrl with +, − and 0, and Ctrl with the wheel, size the Forum's text while
 * the Forum has the keyboard or the pointer was last pressed in it.
 *
 * Main zooms the whole window on those keys and reads them before the page
 * does, so the Forum tells main when it has them (`common/readingZoom.ts`)
 * and main lets them through; anywhere else they zoom the window as before.
 * "Has them" is focus inside the Forum, or the last press inside it: a click
 * on a post's text focuses nothing, and that reader is still reading here.
 */
const tellMain = (hasKeys: boolean) => {
  window.electron.ipcRenderer.sendMessage(READING_ZOOM_KEYS_CHANNEL, [hasKeys]);
};

const step = (key: ReturnType<typeof zoomKeyOf>) => {
  if (key === 'in') {
    largerForumText();
  } else if (key === 'out') {
    smallerForumText();
  } else if (key === 'reset') {
    resetForumText();
  }
};

export default function useForumTextKeys(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return undefined;
    }
    let active = false;
    const setActive = (next: boolean) => {
      if (next !== active) {
        active = next;
        tellMain(next);
      }
    };
    const inside = (target: EventTarget | null) =>
      target instanceof Node && element.contains(target);

    setActive(inside(document.activeElement));

    const onPointerDown = (event: PointerEvent) =>
      setActive(inside(event.target));
    const onFocusIn = (event: FocusEvent) => setActive(inside(event.target));
    const onKeyDown = (event: KeyboardEvent) => {
      if (!active) {
        return;
      }
      const key = zoomKeyOf({
        key: event.key,
        code: event.code,
        control: event.ctrlKey,
        alt: event.altKey,
      });
      if (key) {
        event.preventDefault();
        step(key);
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) {
        return;
      }
      event.preventDefault();
      step(event.deltaY < 0 ? 'in' : 'out');
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('keydown', onKeyDown, true);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('keydown', onKeyDown, true);
      element.removeEventListener('wheel', onWheel);
      setActive(false);
    };
  }, [root]);
}
