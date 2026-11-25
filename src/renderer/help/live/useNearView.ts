/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useContext, useEffect, useState, type RefObject } from 'react';
import { HelpDrawsContext, HelpScrollContext } from '../HelpColumn';

/**
 * How near the reader a picture is drawn, and how far it goes before it is
 * taken down again, as shares of the article's height above and below what
 * shows. Two distances rather than one, so a figure standing on the line is
 * not built and torn down on every wheel step.
 */
const DRAW_WITHIN = '100% 0px';
const DROP_BEYOND = '200% 0px';

/**
 * Whether `element` is near enough to the guide's view to be drawn: within a
 * screen of it, and until it is more than two screens away.
 *
 * Drawn and then kept, as it was until 2.6, the guide grew without end as it
 * was read: forty figures of whole panels, ninety captures and every film's
 * poster, all alive at the foot of the guide — the renderer went from 890 MB
 * open to 1,610 MB read through, and stayed there scrolled back to the top
 * (help harness, 2026-11-25). A figure taken down keeps the room it measured
 * (`liveMeasures`), so nothing around it moves when it goes or comes back.
 *
 * Nothing in the article is drawn while the guide shows something over it
 * (`HelpDrawsContext`: the lightbox), which draws only its own figure.
 *
 * Measured on the article itself (`HelpScrollContext`): an observer of the
 * window would be told only once the figure was already showing, because the
 * article clips everything below its own edge. Without an observer to ask —
 * a test's document — everything is near.
 */
export default function useNearView(
  element: RefObject<Element | null>,
): boolean {
  const root = useContext(HelpScrollContext);
  const draws = useContext(HelpDrawsContext);
  const [isNear, setIsNear] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    const target = element.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNear(true);
        }
      },
      { root, rootMargin: DRAW_WITHIN },
    );
    const far = new IntersectionObserver(
      (entries) => {
        if (entries.every((entry) => !entry.isIntersecting)) {
          setIsNear(false);
        }
      },
      { root, rootMargin: DROP_BEYOND },
    );
    near.observe(target);
    far.observe(target);
    return () => {
      near.disconnect();
      far.disconnect();
    };
  }, [element, root]);
  return isNear && draws;
}
