/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useContext, useEffect, useState, type RefObject } from 'react';
import { HelpScrollContext } from '../HelpColumn';

/**
 * Whether `element` has come within a screen of being seen in the guide's
 * article, and from then on, true: a live figure draws a whole panel, and
 * the guide has thirty chapters, so each is drawn as the reader nears it and
 * then kept, rather than all at once when the guide opens or again on every
 * return.
 *
 * Within a screen, measured on the article itself (`HelpScrollContext`): an
 * observer of the window would be told only once the figure was already
 * showing, because the article clips everything below its own edge. Without
 * an observer to ask — a test's document — everything is near.
 */
export default function useNearView(
  element: RefObject<Element | null>,
): boolean {
  const root = useContext(HelpScrollContext);
  const [isNear, setIsNear] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    const target = element.current;
    if (isNear || !target) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNear(true);
        }
      },
      { root, rootMargin: '100% 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [element, isNear, root]);
  return isNear;
}
