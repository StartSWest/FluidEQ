/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { TRAIL_LENGTH } from './dynamicsLive';
import { meterY, type IDynamicsPlot } from './dynamicsPlot';
import type { IDynamicsBus, IDynamicsFrame } from './useDynamicsLive';

interface IProps {
  index: number;
  plot: IDynamicsPlot;
  bus: IDynamicsBus;
}

/** Under this a push is too short for an arrow to be drawn, dB. */
const ARROW_DB = 0.6;
/** Past this the meter marks the deepest hold or the largest lift, dB. */
const PEAK_MARK_DB = 0.3;
const TRAIL = Array.from({ length: TRAIL_LENGTH }, (_, index) => index);

const place = (element: SVGElement | null, values: Record<string, number>) => {
  if (!element) {
    return;
  }
  Object.entries(values).forEach(([name, value]) => {
    element.setAttribute(name, value.toFixed(1));
  });
};

const show = (element: SVGElement | null, isShown: boolean) => {
  element?.setAttribute('visibility', isShown ? 'visible' : 'hidden');
};

/**
 * The band as it plays, over its curve: the dot riding the curve at the
 * band's level, its trail, the arrow from where the band would sit untouched
 * to where it was pushed, and the gain on the meter beside the square.
 *
 * Every element is in the drawing from the first frame and only moved or
 * hidden after, by the live loop and never by a render, so nothing on the
 * card is laid out again while the music plays.
 */
const DspDynamicsLiveMarks = ({ index, plot, bus }: IProps) => {
  const marks = useRef<SVGGElement>(null);
  const trail = useRef<(SVGCircleElement | null)[]>([]);
  const across = useRef<SVGLineElement>(null);
  const down = useRef<SVGLineElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const shaft = useRef<SVGPathElement>(null);
  const head = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const fill = useRef<SVGRectElement>(null);
  const lowest = useRef<SVGLineElement>(null);
  const highest = useRef<SVGLineElement>(null);
  const plotRef = useRef(plot);
  plotRef.current = plot;

  useEffect(() => {
    const paint = (frame: IDynamicsFrame | undefined) => {
      const p = plotRef.current;
      const band = frame?.bands[index];
      const now = band?.now;
      show(marks.current, now !== undefined);
      const meterTop = meterY(p, Math.max(0, now?.gainDb ?? 0));
      const meterBottom = meterY(p, Math.min(0, now?.gainDb ?? 0));
      place(fill.current, {
        y: meterTop,
        height: Math.max(0, meterBottom - meterTop),
      });
      const peak = (element: SVGLineElement | null, gainDb: number) => {
        show(element, now !== undefined && Math.abs(gainDb) > PEAK_MARK_DB);
        place(element, { y1: meterY(p, gainDb), y2: meterY(p, gainDb) });
      };
      peak(lowest.current, band?.lowestDb ?? 0);
      peak(highest.current, band?.highestDb ?? 0);
      if (!band || !now) {
        return;
      }
      const x = p.x(now.levelDb);
      const y = p.y(now.levelDb + now.gainDb);
      const untouchedY = p.y(now.levelDb);
      place(dot.current, { cx: x, cy: y });
      place(across.current, { x1: p.left, y1: y, x2: x, y2: y });
      place(down.current, { x1: x, y1: y, x2: x, y2: p.top + p.size });
      const pushed = Math.abs(now.gainDb) > ARROW_DB;
      show(ring.current, pushed);
      show(shaft.current, pushed);
      show(head.current, pushed);
      if (pushed) {
        // The arrow runs from the ring to the dot and stops short of both.
        const sign = now.gainDb < 0 ? 1 : -1;
        const tip = y + sign * 4.5;
        place(ring.current, { cx: x, cy: untouchedY });
        shaft.current?.setAttribute(
          'd',
          `M${x.toFixed(1)} ${(untouchedY - sign * 3).toFixed(1)}L${x.toFixed(
            1,
          )} ${tip.toFixed(1)}`,
        );
        head.current?.setAttribute(
          'd',
          `M${(x - 3.2).toFixed(1)} ${(tip - sign * 3.5).toFixed(
            1,
          )}L${x.toFixed(1)} ${tip.toFixed(1)}L${(x + 3.2).toFixed(1)} ${(
            tip -
            sign * 3.5
          ).toFixed(1)}`,
        );
      }
      const behind = band.trail;
      TRAIL.forEach((slot) => {
        const circle = trail.current[slot];
        // The newest marks nearest the dot, the oldest faintest and smallest.
        const mark = behind[behind.length - 1 - slot];
        show(circle ?? null, mark !== undefined);
        if (mark && circle) {
          place(circle, {
            cx: p.x(mark.levelDb),
            cy: p.y(mark.levelDb + mark.gainDb),
          });
        }
      });
    };
    paint(bus.last());
    return bus.subscribe(paint);
  }, [bus, index, plot]);

  const span = TRAIL_LENGTH;
  return (
    <>
      <g
        ref={marks}
        className="dsp-dynamics-live"
        visibility="hidden"
        aria-hidden="true"
      >
        <line ref={across} className="dsp-dynamics-live__guide" />
        <line ref={down} className="dsp-dynamics-live__guide" />
        {TRAIL.map((slot) => (
          <circle
            key={slot}
            ref={(node) => {
              trail.current[slot] = node;
            }}
            className="dsp-dynamics-live__trail"
            r={(1.2 + 2 * (1 - (slot + 1) / span)).toFixed(2)}
            opacity={(0.08 + 0.42 * (1 - (slot + 1) / span)).toFixed(2)}
            visibility="hidden"
          />
        ))}
        <circle ref={ring} className="dsp-dynamics-live__ring" r="2.5" />
        <path ref={shaft} className="dsp-dynamics-live__arrow" />
        <path ref={head} className="dsp-dynamics-live__arrow" />
        <circle ref={dot} className="dsp-dynamics-live__dot" r="5" />
      </g>
      <g className="dsp-dynamics-meter-live" aria-hidden="true">
        <rect
          ref={fill}
          className="dsp-dynamics-meter__fill"
          x={plot.meterX + 1.5}
          width={plot.meterWidth - 3}
          y={meterY(plot, 0)}
          height="0"
          rx="1.5"
        />
        <line
          ref={lowest}
          className="dsp-dynamics-meter__peak"
          x1={plot.meterX}
          x2={plot.meterX + plot.meterWidth}
          visibility="hidden"
        />
        <line
          ref={highest}
          className="dsp-dynamics-meter__peak"
          x1={plot.meterX}
          x2={plot.meterX + plot.meterWidth}
          visibility="hidden"
        />
      </g>
    </>
  );
};

export default DspDynamicsLiveMarks;
