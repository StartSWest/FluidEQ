/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useRef } from 'react';
import { onPlot, type IDynamicsPlot } from './dynamicsPlot';
import type { IDynamicsPointAt } from './dynamicsPoints';

interface IProps {
  plot: IDynamicsPlot;
  at: IDynamicsPointAt;
  text: string;
}

const HEIGHT = 19;
const PAD = 7;
/** A first guess at the text's width, replaced by its measure before paint. */
const GUESS_PX = 6;

/**
 * The values of the point in hand, in a tag over it — under it where the
 * square has no room above — and never past the square's sides. Sized to its
 * text as laid out, in any script, before the frame is painted.
 */
const DspDynamicsTag = ({ plot, at, text }: IProps) => {
  const box = useRef<SVGRectElement>(null);
  const label = useRef<SVGTextElement>(null);
  const { x, y } = onPlot(plot, at.inDb, at.outDb);
  const top = y - 12 - HEIGHT < plot.top ? y + 13 : y - 12 - HEIGHT;

  useLayoutEffect(() => {
    const measured = label.current?.getComputedTextLength?.() ?? 0;
    const width = (measured > 0 ? measured : text.length * GUESS_PX) + PAD * 2;
    const left = Math.min(
      Math.max(x - width / 2, plot.left + 2),
      plot.left + plot.size - width - 2,
    );
    box.current?.setAttribute('x', left.toFixed(1));
    box.current?.setAttribute('width', width.toFixed(1));
    label.current?.setAttribute('x', (left + width / 2).toFixed(1));
  }, [plot, text, x]);

  return (
    <g className="dsp-dynamics-tag" aria-hidden="true">
      <rect
        ref={box}
        x={(x - (text.length * GUESS_PX) / 2 - PAD).toFixed(1)}
        y={top.toFixed(1)}
        width={(text.length * GUESS_PX + PAD * 2).toFixed(1)}
        height={HEIGHT}
        rx="5"
      />
      <text
        ref={label}
        x={x.toFixed(1)}
        y={(top + 13).toFixed(1)}
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
};

export default DspDynamicsTag;
