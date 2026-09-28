import { useEffect, useEffectEvent, type RefObject } from 'react';
import holdFocusReturn from './focusReturn';

/**
 * Every stop Tab walks inside a modal.
 *
 * A radio group is one stop, at its checked choice; arrows move within it, as
 * they do everywhere else. Anything else made focusable on purpose — the
 * framing editor's photo, moved with the arrows — is a stop too, and a button
 * taken out of the order on purpose — the picture viewer's thumbnails, walked
 * with the arrows — is not. Links, lists and text areas are stops as well:
 * left out, the publish dialog's description could not be reached from the
 * keyboard, and About's links were skipped.
 */
const TAB_STOPS = [
  'a[href]:not([tabindex="-1"])',
  'button:not(:disabled):not([tabindex="-1"])',
  'input:not([type="radio"]):not(:disabled)',
  'input[type="radio"]:checked',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex="0"]',
].join(', ');

/**
 * Move focus to the next stop inside `surface` — the previous one with Shift —
 * wrapping at either end, and keep the key from leaving it. Does nothing when
 * the surface has no stop, so Tab is never swallowed by an empty dialog.
 */
export function moveTabStop(surface: HTMLElement | null, event: KeyboardEvent) {
  const targets = Array.from(
    surface?.querySelectorAll<HTMLElement>(TAB_STOPS) ?? [],
  );
  if (!targets.length) {
    return;
  }
  event.preventDefault();
  const current = targets.findIndex(
    (target) => target === document.activeElement,
  );
  targets[
    (current + (event.shiftKey ? -1 : 1) + targets.length) % targets.length
  ]?.focus();
}

/**
 * What a small modal needs from the keyboard: Escape cancels it unless it is
 * busy, Tab stays inside it, and focus goes to `initial` on the way in and
 * back to wherever it was on the way out.
 *
 * The Studio's share dialog, its publish dialog and the gallery's report
 * dialog all had to behave this way, and three copies of a focus trap drift.
 */
export default function useModalKeys(
  surfaceRef: RefObject<HTMLElement | null>,
  initialRef: RefObject<HTMLElement | null>,
  { busy, onCancel }: { busy: boolean; onCancel: () => void },
) {
  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    initialRef.current?.focus();
    return giveFocusBack;
    // Where focus goes in is decided once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read at the key, not subscribed with: a window hands most dialogs a new
  // `onCancel` on every render of its own, several times a second while
  // anything plays.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!busy) {
        event.preventDefault();
        onCancel();
      }
      return;
    }
    if (event.key === 'Tab') {
      moveTabStop(surfaceRef.current, event);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
}
