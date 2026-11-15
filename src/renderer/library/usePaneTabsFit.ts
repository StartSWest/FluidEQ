/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

/**
 * Whether the right pane's tabs have room for their words, measured rather
 * than set at a width (Ivan, 2026-11-15: "let's make it responsive here with
 * icons" - "A continuación" ran into "Detalles" in a narrow pane).
 *
 * A fixed breakpoint cannot serve twelve languages: "Up next" and
 * "A continuación" need half and twice the room of each other. So the row
 * measures what its words need while they are shown - each label's full
 * width plus the tab's own icon, gap and padding - and folds to icons alone
 * the moment that is more than it has. Folded, the words are not laid out
 * and cannot be measured, so the need measured last is what unfolds it
 * again; a change of language (`labelsKey`) unfolds the row to measure
 * afresh. Before the paint, so a row that does not fit is never drawn
 * squeezed for a frame.
 */
const usePaneTabsFit = (
  rowRef: RefObject<HTMLDivElement | null>,
  labelsKey: string,
): boolean => {
  const [isCompact, setIsCompact] = useState(false);
  /** What the words need, measured while they were shown; 0 for not yet
   * measured since the words last changed. */
  const needRef = useRef(0);
  const measuredKeyRef = useRef(labelsKey);
  if (measuredKeyRef.current !== labelsKey) {
    measuredKeyRef.current = labelsKey;
    needRef.current = 0;
  }

  // Re-run after every fold and unfold as well as on new words: folded, the
  // words are not laid out, so words that changed while folded unfold the
  // row once to be measured, and this runs again to decide on the result.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) {
      return undefined;
    }
    const roomOf = (element: HTMLElement): number => {
      const style = getComputedStyle(element);
      return (
        element.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)
      );
    };
    const measureNeed = (): number => {
      const tabs = Array.from(
        row.querySelectorAll<HTMLElement>('.library-pane__tab'),
      );
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      return tabs.reduce(
        (sum, tab) => {
          const label = tab.querySelector<HTMLElement>('.library-pane__label');
          const icon = tab.querySelector<SVGElement>('.library-pane__icon');
          const style = getComputedStyle(tab);
          // The label's whole text, the icon, the gap between them and the
          // tab's padding - never the tab's own width, which the row
          // stretches to a third of itself whatever its words need.
          return (
            sum +
            (label?.scrollWidth ?? 0) +
            (icon?.getBoundingClientRect().width ?? 0) +
            (parseFloat(style.columnGap) || 0) +
            parseFloat(style.paddingLeft) +
            parseFloat(style.paddingRight)
          );
        },
        gap * Math.max(0, tabs.length - 1),
      );
    };
    const check = () => {
      if (!isCompact) {
        needRef.current = measureNeed();
      } else if (needRef.current === 0) {
        setIsCompact(false);
        return;
      }
      const shouldFold = needRef.current > roomOf(row) + 0.5;
      if (shouldFold !== isCompact) {
        setIsCompact(shouldFold);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef, labelsKey, isCompact]);

  return isCompact;
};

export default usePaneTabsFit;
