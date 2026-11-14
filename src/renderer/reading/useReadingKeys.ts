import { type RefObject, useEffect } from 'react';
import { READING_ZOOM_KEYS_CHANNEL, zoomKeyOf } from 'common/readingZoom';
import {
  largerReadingText,
  resetReadingText,
  smallerReadingText,
} from './readingSize';

/**
 * Ctrl with +, − and 0, and Ctrl with the wheel, size the reading text while
 * a reading area (the Forum, Help) has the keyboard or the pointer was last
 * pressed in it.
 *
 * Main zooms the whole window on those keys and reads them before the page
 * does, so the page tells main when a reading area has them
 * (`common/readingZoom.ts`) and main lets them through; anywhere else they
 * zoom the window as before. "Has them" is focus inside the area, or the
 * last press inside it: a click on a post's text focuses nothing, and that
 * reader is still reading there.
 *
 * The Forum and Help can both be open, Help over the Forum, so main hears
 * whether ANY area holds the keys: one area letting go while the other takes
 * them would otherwise race, and the last message would win.
 */
const holding = new Set<symbol>();
// The bridge is read as possibly absent, as the account stores read it: Help
// is also drawn where there is no main to tell (its renderer tests, the
// film pages), and there the keys have nobody to take them from.
const tellMain = (hasKeys: boolean) => {
  window.electron?.ipcRenderer.sendMessage(READING_ZOOM_KEYS_CHANNEL, [
    hasKeys,
  ]);
};
const hold = (area: symbol, next: boolean) => {
  const before = holding.size > 0;
  if (next) {
    holding.add(area);
  } else {
    holding.delete(area);
  }
  if (holding.size > 0 !== before) {
    tellMain(holding.size > 0);
  }
};

const step = (key: ReturnType<typeof zoomKeyOf>) => {
  if (key === 'in') {
    largerReadingText();
  } else if (key === 'out') {
    smallerReadingText();
  } else if (key === 'reset') {
    resetReadingText();
  }
};

export default function useReadingKeys(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return undefined;
    }
    const area = Symbol('reading area');
    let active = false;
    const setActive = (next: boolean) => {
      if (next !== active) {
        active = next;
        hold(area, next);
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
