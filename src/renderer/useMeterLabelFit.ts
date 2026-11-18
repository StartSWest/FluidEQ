/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The meter's LIVE OUTPUT label steps aside when it would run into the
 * readouts at the right of the same strip.
 *
 * Measured where the two actually stand, in whatever language is on screen,
 * every time either of them or the meter changes size: the label is 99px
 * from the pane's edge in English and 203 in Russian, so no one width of the
 * meter can say when it stops fitting (it was the Colourful pill it ran
 * into until that pill went, 2026-11-18; Spanish "SALIDA EN DIRECTO" ran
 * under it at widths English cleared). The label's text changes between
 * LIVE OUTPUT and SIGNAL, the readouts with the style and a clip, and the
 * language can change under a running window.
 *
 * The label is hidden with `visibility`, not removed, so its own width is
 * still there to measure: a label taken out of the layout would read as
 * fitting at once and come straight back, every frame.
 */
import { type RefObject, useLayoutEffect } from 'react';

/** Room kept between the label and the readouts, as the strip's other gaps. */
const CLEARANCE_PX = 8;

const useMeterLabelFit = (
  shellRef: RefObject<HTMLElement | null>,
  labelRef: RefObject<HTMLElement | null>,
  readoutRef: RefObject<HTMLElement | null>,
  /** The label is mounted at all (the meter switched off has none). */
  isLabelShown: boolean,
): void => {
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const label = labelRef.current;
    const readout = readoutRef.current;
    if (!shell || !label || !readout) {
      return undefined;
    }
    const measure = () => {
      const readoutBox = readout.getBoundingClientRect();
      // Nothing in the readouts (every figure given up to the meter's
      // width, `WaveformVisualizer.scss`): the pane's own edge is what it
      // would run past.
      const limit =
        readoutBox.width > 0
          ? readoutBox.left
          : shell.getBoundingClientRect().right;
      // Where its text reaches, not where its box ends: the box shrinks with
      // the strip and the text runs on past it.
      const reach = label.getBoundingClientRect().left + label.scrollWidth;
      const isCramped = reach + CLEARANCE_PX > limit;
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
    observer.observe(readout);
    return () => observer.disconnect();
  }, [shellRef, labelRef, readoutRef, isLabelShown]);
};

export default useMeterLabelFit;
