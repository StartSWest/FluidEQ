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
import { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';

/** Everything the arrows walk in the plate's list, in the order shown. */
const STOPS =
  '.wave-preset-menu input, .wave-preset-menu__row:not(:disabled), .wave-preset-menu__foot';

/**
 * The plate's list, open on a press (Ivan, 2026-11-20, the mockup's
 * direction B: "I want exactly something like this").
 *
 * It closes as every menu here does: a press outside the plate and the list,
 * Escape — which hands the focus back to the plate, or the next Tab would
 * start from the top of the window — and the focus moving on past it. Up and
 * down walk the field, the rows and the foot, and wrap.
 *
 * Opened from the keyboard, the list takes the focus (the field when it has
 * one, else the row that plays), so the arrows answer at once. Opened with the
 * pointer the list itself takes it, which draws no ring, and the arrows still
 * answer.
 */
const useWaveMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const holderRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLButtonElement>(null);
  // A click a key makes carries no click count (`detail` 0).
  const byKeyRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const isInside = (target: EventTarget | null) =>
      (target instanceof Node &&
        holderRef.current?.contains(target) === true) ||
      isInsideAnchoredMenu(target);
    const onPress = (event: PointerEvent) => {
      if (!isInside(event.target)) {
        setIsOpen(false);
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!isInside(event.target)) {
        setIsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      // A key the panel answered itself (`presetMenuKeys`): Escape that
      // cleared a search, the arrows walking the rows from the field.
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === 'Escape') {
        if (isInside(document.activeElement)) {
          plateRef.current?.focus();
        }
        setIsOpen(false);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }
      const menu = document.querySelector('.wave-preset-menu');
      if (!menu?.contains(document.activeElement)) {
        return;
      }
      const stops = Array.from(menu.querySelectorAll<HTMLElement>(STOPS));
      if (stops.length === 0) {
        return;
      }
      event.preventDefault();
      const at = stops.findIndex((stop) => stop === document.activeElement);
      const down = event.key === 'ArrowDown';
      const from = at === -1 && !down ? 0 : at;
      const next =
        stops[(from + (down ? 1 : -1) + stops.length) % stops.length];
      next.focus({ preventScroll: true });
      // jsdom has none, and the cases that open this are not about scrolling.
      if (typeof next.scrollIntoView === 'function') {
        next.scrollIntoView({ block: 'nearest' });
      }
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

  /**
   * Handed the list as it is drawn — AnchoredMenu draws nothing until it has
   * placed it — so the playing row is brought into view and the focus goes
   * in once per opening. Stable for that reason.
   */
  const arrive = useCallback((menu: HTMLDivElement | null) => {
    if (!menu) {
      return;
    }
    const playing = menu.querySelector<HTMLElement>(
      '.wave-preset-menu__list .wave-preset-menu__row[aria-checked="true"]',
    );
    if (playing && typeof playing.scrollIntoView === 'function') {
      playing.scrollIntoView({ block: 'nearest' });
    }
    if (!byKeyRef.current) {
      menu.focus({ preventScroll: true });
      return;
    }
    const first =
      menu.querySelector<HTMLElement>('input') ??
      menu.querySelector<HTMLElement>(
        '.wave-preset-menu__row[aria-checked="true"]',
      ) ??
      menu.querySelector<HTMLElement>(STOPS);
    first?.focus({ preventScroll: true });
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
    arrive,
  };
};

export default useWaveMenu;
