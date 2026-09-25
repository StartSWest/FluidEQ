/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Ref } from 'react';
import '../styles/LiveFigure.scss';

interface ILiveFigureProps {
  /** The element's own class, for where it stands and how its text looks. */
  className: string;
  /**
   * Every text the figure can show at its widest — `0.00`, `-00.0 dB`, each
   * note a voice can be read as. Its width is theirs, whatever it says now.
   */
  widest: readonly string[];
  /** For a figure rewritten straight, never through React (`liveText.ts`). */
  textRef?: Ref<HTMLSpanElement>;
  /** The figure itself, for a look that changes with what it says. */
  figureRef?: Ref<HTMLSpanElement>;
  /**
   * What it says: before the first frame, or all along when React writes it.
   * Nothing, for a figure that has nothing to say until then.
   */
  children?: string;
}

/**
 * A figure that changes while the window is being looked at — a meter's
 * reading, a frame's cost, a held peak — laid out on its own so the rest of
 * the window is not laid out with it.
 *
 * New text is new layout, and a readout in plain flow had the whole window
 * laid out again for it: its box is as wide as its text, the row as wide as
 * its boxes, and so on up to the page. Measured on the Studio with a scene
 * playing, the meters' readouts, its cost readings, the titlebar's peak and
 * the side bar's peak between them had the window laid out on every frame,
 * which the Ambient mode — asking where every visualizer stands each frame —
 * paid for on the spot (`visualizerSurfaces.ts`).
 *
 * So the text stands in a box whose size nothing inside it decides
 * (`contain: size layout`), which the browser lays out alone, and the box
 * takes its width from lines nobody sees holding every text it can show —
 * laid out once, and again only when the language changes. That box cannot
 * be the item of a grid or a flex row itself: those place their items with
 * the sizes they worked out, so the browser never lays one of them out
 * alone. It stands inside this element, which is the item.
 */
export default function LiveFigure({
  className,
  widest,
  textRef,
  figureRef,
  children,
}: ILiveFigureProps) {
  return (
    <span className={`live-figure ${className}`} ref={figureRef}>
      <span className="live-figure__room" aria-hidden="true">
        {widest.map((text) => (
          <span key={text}>{text}</span>
        ))}
      </span>
      <span className="live-figure__text" ref={textRef}>
        {children}
      </span>
    </span>
  );
}
