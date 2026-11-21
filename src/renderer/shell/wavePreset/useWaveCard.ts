/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/**
 * The plate's card, open on a press and nothing else (Ivan, 2026-11-20: "I
 * want instead to open the window and allow the user to click change
 * preset"; the card that came up on pointing got between him and the
 * presets).
 *
 * It closes as every menu here does: a press anywhere outside the plate and
 * its card, Escape, and the focus moving on past it — Tab out of its last
 * button is leaving it. Escape hands the focus back to the plate when it was
 * inside, or the next Tab would start from the top of the window.
 *
 * Opened from the keyboard, the focus moves to the card's first button, so
 * Enter or Space on the plate lands somewhere that answers the next key.
 * Opened with the pointer it stays on the plate: moved, it lit the button's
 * focus ring under a mouse that had not asked for it, and Tab from the plate
 * reaches the card next anyway, since the card follows it.
 */
const useWaveCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const holderRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const isInside = (target: EventTarget | null) =>
      target instanceof Node && holderRef.current?.contains(target) === true;
    const onPress = (event: PointerEvent) => {
      if (!isInside(event.target)) {
        setIsOpen(false);
      }
    };
    // `focusin`, not the holder's blur: a press on the card's own words
    // blurs its button towards the body, which is not leaving the card.
    const onFocus = (event: FocusEvent) => {
      if (!isInside(event.target)) {
        setIsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (isInside(document.activeElement)) {
        plateRef.current?.focus();
      }
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPress);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPress);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  // Whether the press that opened it came from a key: a click a key makes
  // carries no click count (`detail` 0), a pointer's always one or more.
  const byKeyRef = useRef(false);
  // Stable, so it runs once per opening, when the card is drawn.
  const cardRef = useCallback((card: HTMLDivElement | null) => {
    if (card && byKeyRef.current) {
      card.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  }, []);

  return {
    isOpen,
    toggle: useCallback((event: MouseEvent<HTMLButtonElement>) => {
      byKeyRef.current = event.detail === 0;
      setIsOpen((open) => !open);
    }, []),
    close: useCallback(() => setIsOpen(false), []),
    holderRef,
    plateRef,
    cardRef,
  };
};

export default useWaveCard;
