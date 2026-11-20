/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useLayoutEffect, useRef } from 'react';

/**
 * A box whose height follows its content smoothly instead of jumping: a menu
 * whose view changes — Manage, a form swapped in, a row added or gone —
 * grows or shrinks to its new size (Ivan, 2026-11-20: "add animations to all
 * those menus and navigations inside of them").
 *
 * The content is measured by a ResizeObserver, which says when its size
 * changed — nothing here guesses when — and the box is given that height in
 * pixels for the stylesheet's transition to run to. The first measure is
 * taken without one, so a menu opens at its size. Clipped with
 * `overflow: clip`, which unlike `hidden` makes no scroll container, so a
 * sticky foot inside still sticks to the menu that scrolls.
 */
const AnimatedHeight = ({
  className,
  children,
}: {
  /** The content's own class: its layout, which the box does not change. */
  className: string;
  children: ReactNode;
}) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    let height = content.offsetHeight;
    box.style.height = `${height}px`;
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight;
      if (next !== height) {
        height = next;
        box.style.height = `${next}px`;
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="animated-height" ref={outer}>
      <div className={className} ref={inner}>
        {children}
      </div>
    </div>
  );
};

export default AnimatedHeight;
