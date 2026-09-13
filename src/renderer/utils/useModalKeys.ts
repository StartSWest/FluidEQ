import { useEffect, type RefObject } from 'react';

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
    const previousFocus = document.activeElement;
    initialRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
    // Where focus goes in is decided once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busy) {
          event.preventDefault();
          onCancel();
        }
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      // A radio group is one stop, at its checked choice; arrows move within
      // it, as they do everywhere else. Anything else made focusable on
      // purpose — the framing editor's photo, moved with the arrows — is a
      // stop too, and a button taken out of the order on purpose — the
      // picture viewer's thumbnails, walked with the arrows — is not.
      const targets = Array.from(
        surfaceRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled):not([tabindex="-1"]), input:not([type="radio"]):not(:disabled), input[type="radio"]:checked, [tabindex="0"]',
        ) ?? [],
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
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel, surfaceRef]);
}
