/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The meter's LIVE OUTPUT label steps aside when it would run into the
 * Rainbow pill centred over the same strip.
 *
 * The strip used to drop the label at a fixed meter width, 325px, measured
 * for English. Every other language is a different length on both sides of
 * that sum: Spanish "SALIDA EN DIRECTO" against "COLORIDO" ran its last
 * word under the pill at widths English clears (Ivan, 2026-11-15). So the
 * two are measured where they actually stand, in whatever language is on
 * screen, every time either of them or the meter changes size — the label's
 * text changes between LIVE OUTPUT and SIGNAL, and the language can change
 * under a running window.
 *
 * The label is hidden with `visibility`, not removed, so its own width is
 * still there to measure: a label taken out of the layout would read as
 * fitting at once and come straight back, every frame.
 */
import { type RefObject, useLayoutEffect } from 'react';

/** Room kept between the label and the pill, as the strip's other gaps. */
const CLEARANCE_PX = 8;

const useMeterLabelFit = (
  shellRef: RefObject<HTMLElement | null>,
  labelRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  /** The label is mounted at all (the meter switched off has none). */
  isLabelShown: boolean,
): void => {
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const label = labelRef.current;
    const pill = pillRef.current;
    if (!shell || !label || !pill) {
      return undefined;
    }
    const measure = () => {
      const pillBox = pill.getBoundingClientRect();
      // No pill drawn (the strip is too narrow for it, `Euphoria.scss`):
      // nothing to run into, and the meter's own width rules decide.
      const isCramped =
        pillBox.width > 0 &&
        label.getBoundingClientRect().right + CLEARANCE_PX > pillBox.left;
      if (isCramped) {
        label.dataset.cramped = '';
      } else {
        delete label.dataset.cramped;
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    observer.observe(label);
    observer.observe(pill);
    return () => observer.disconnect();
  }, [shellRef, labelRef, pillRef, isLabelShown]);
};

export default useMeterLabelFit;
