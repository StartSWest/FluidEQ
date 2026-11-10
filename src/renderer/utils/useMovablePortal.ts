/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * One subtree rendered once and shown in whichever place takes it: its
 * components stay mounted while its elements move, so state held inside it
 * (the words being written, a picture attached, a menu open) goes where it
 * goes. Rendering the same component in two places would mount two, each
 * with state of its own, and the one left behind would take what was
 * written with it.
 *
 * `portal` is rendered where the subtree belongs in the tree; `place` is the
 * ref of the element it is shown in. A place taken away keeps what was
 * scrolled inside the subtree for the next: an element out of the document
 * forgets how far it was scrolled, and a conversation would come back at
 * its first line.
 *
 * `className` names the element the subtree is held in, for the sheet to
 * lay it out (`display: contents` lets it be part of the place's own
 * layout).
 */
export default function useMovablePortal(
  children: ReactNode,
  className: string,
) {
  const [host] = useState(() => {
    const element = document.createElement('div');
    element.className = className;
    return element;
  });
  const scrolled = useRef<
    Array<{ element: Element; top: number; atEnd: boolean }>
  >([]);

  // React lets go of a place before it removes it from the document, and
  // takes the next one after: the scroll is read while it still stands.
  // What was at its end stays at its end, whatever the new place's size
  // does to its height: a conversation following a reply keeps following,
  // and one that fitted whole (so scrolled nowhere) comes back at its
  // newest line, not its first.
  const place = useCallback(
    (slot: HTMLElement | null) => {
      if (!slot) {
        scrolled.current = Array.from(host.querySelectorAll('*'))
          .filter((element) =>
            /auto|scroll|overlay/.test(getComputedStyle(element).overflowY),
          )
          .map((element) => ({
            element,
            top: element.scrollTop,
            atEnd:
              element.scrollTop + element.clientHeight >=
              element.scrollHeight - 1,
          }));
        return;
      }
      slot.appendChild(host);
      scrolled.current.forEach(({ element, top, atEnd }) => {
        element.scrollTop = atEnd ? element.scrollHeight : top;
      });
      scrolled.current = [];
    },
    [host],
  );

  return { portal: createPortal(children, host), place };
}
