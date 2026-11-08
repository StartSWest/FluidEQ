import { useEffect, useState } from 'react';

/** A field a key typed into belongs to: a space there is a space. */
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement);

/**
 * Whether Space is held, the way drawing and design tools take it: while it
 * is down, a drag moves the picture instead of drawing on it (Ivan,
 * 2026-11-08: "pan with space pressed"). A space typed into a field stays a
 * space, and a window losing focus lets go, or the key would be held for good
 * once its release went to another window.
 *
 * `enabled` false lets go at once and listens to nothing.
 */
export default function useSpaceHeld(enabled = true): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setHeld(false);
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || typingIn(event.target)) {
        return;
      }
      // Not a press of the button that has the focus, nor a page scroll, nor
      // the graph's own Space (`FrequencyResponseChart`), which listens on
      // the window and would change the graph's look behind the hand.
      event.preventDefault();
      event.stopPropagation();
      setHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      // A button with the focus is pressed on Space's release.
      if (!typingIn(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      setHeld(false);
    };
    const letGo = () => setHeld(false);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', letGo);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', letGo);
    };
  }, [enabled]);
  return held;
}
