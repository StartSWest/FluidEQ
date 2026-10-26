/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import type { IHelpLiveFigure, THelpBox } from 'common/helpGuide';

/**
 * What a live figure turned out to be once drawn, in its own CSS pixels:
 * the part it shows (`frame`), and every control's box inside that part,
 * in the order the figure lists them — `undefined` for one the drawing has
 * nothing to match, which gets its line in the list and no circle.
 */
export interface IHelpLiveMeasure {
  readonly width: number;
  readonly height: number;
  readonly boxes: readonly (THelpBox | undefined)[];
}

interface IRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Below this, two measurements are the same: a zoom rounds to fractions. */
const SAME = 0.25;

const sameMeasure = (one: IHelpLiveMeasure, other: IHelpLiveMeasure) =>
  Math.abs(one.width - other.width) < SAME &&
  Math.abs(one.height - other.height) < SAME &&
  one.boxes.length === other.boxes.length &&
  one.boxes.every((box, index) => {
    const twin = other.boxes[index];
    return box === undefined || twin === undefined
      ? box === twin
      : box.every((value, at) => Math.abs(value - twin[at]) < SAME);
  });

/**
 * What can be seen of an element on screen: its rectangle cut to every
 * ancestor inside the drawing that clips what it holds. A row of a list
 * scrolled out of view still has a rectangle, below the list's own; counted,
 * the queue's remove keys reached past the bottom of the player and their
 * circle pointed at nothing.
 */
const clips = (overflow: string) => overflow !== 'visible' && overflow !== '';

const shownRect = (element: Element, drawing: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  let { left, top, right, bottom } = rect;
  for (
    let holder = element.parentElement;
    holder && holder !== drawing;
    holder = holder.parentElement
  ) {
    const style = getComputedStyle(holder);
    if ([style.overflow, style.overflowX, style.overflowY].some(clips)) {
      const clip = holder.getBoundingClientRect();
      left = Math.max(left, clip.left);
      top = Math.max(top, clip.top);
      right = Math.min(right, clip.right);
      bottom = Math.min(bottom, clip.bottom);
    }
  }
  return { left, top, right, bottom };
};

/**
 * Everything the selector matches in the drawing, taken together, in the
 * drawing's own CSS pixels. Read against the drawing's own rectangle, so
 * whatever zoom it is drawn at — the column's, or none in a test — divides
 * out; an element with nothing of it shown counts for nothing.
 */
const unionOf = (
  drawing: HTMLElement,
  origin: DOMRect,
  unit: number,
  selector: string,
): IRect | undefined => {
  const rects = Array.from(drawing.querySelectorAll(selector))
    .map((element) => shownRect(element, drawing))
    .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
  if (rects.length === 0) {
    return undefined;
  }
  return {
    left: (Math.min(...rects.map((rect) => rect.left)) - origin.left) / unit,
    top: (Math.min(...rects.map((rect) => rect.top)) - origin.top) / unit,
    right: (Math.max(...rects.map((rect) => rect.right)) - origin.left) / unit,
    bottom: (Math.max(...rects.map((rect) => rect.bottom)) - origin.top) / unit,
  };
};

/**
 * The figure as drawn, or `undefined` while nothing is laid out — a test's
 * document, or a host not yet in the page — when there is nothing to read.
 */
const measureDrawing = (
  drawing: HTMLElement,
  figure: IHelpLiveFigure,
): { measure: IHelpLiveMeasure; frame: IRect } | undefined => {
  const origin = drawing.getBoundingClientRect();
  if (origin.width <= 0) {
    return undefined;
  }
  const unit = origin.width / figure.width;
  const frame = (figure.frame &&
    unionOf(drawing, origin, unit, figure.frame)) || {
    left: 0,
    top: 0,
    right: figure.width,
    bottom: origin.height / unit,
  };
  return {
    frame,
    measure: {
      width: frame.right - frame.left,
      height: frame.bottom - frame.top,
      boxes: (figure.controls ?? []).map((control) => {
        const found = unionOf(drawing, origin, unit, control.target);
        return (
          found && [
            found.left - frame.left,
            found.top - frame.top,
            found.right - found.left,
            found.bottom - found.top,
          ]
        );
      }),
    },
  };
};

interface IHelpLiveSurfaceProps {
  figure: IHelpLiveFigure;
  Drawing: ComponentType;
  /** How large it is drawn, as a share of its own CSS pixels. */
  zoom: number;
  /** Told each time what is drawn measures differently. */
  onMeasure?: (measure: IHelpLiveMeasure) => void;
}

/**
 * A live figure's drawing: the panel laid out at the figure's own width,
 * moved so the part it frames stands at the corner, and clipped to that
 * part, all of it scaled by CSS `zoom` — which lays it out at the drawn size,
 * so its box in the page is the size it is seen at and the circles beside it
 * can be placed by the same numbers (`HelpLiveFigure`).
 *
 * NOTHING IN IT CAN BE PRESSED, FOCUSED OR READ OUT: it is `inert` and
 * `aria-hidden`, and the figure says what it shows in words. It is a picture
 * of the app, never a second copy of it to operate.
 *
 * It measures what it drew after every render — a language changing what
 * fits on a row is a render — and when anything in it is resized, loads or
 * finishes moving afterwards, which is how a cover arriving late or a menu's
 * opening scale is heard; never on a clock.
 */
export default function HelpLiveSurface({
  figure,
  Drawing,
  zoom,
  onMeasure,
}: IHelpLiveSurfaceProps) {
  const drawingRef = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<{
    measure: IHelpLiveMeasure;
    frame: IRect;
  }>();
  const remeasure = useRef<() => void>(() => undefined);
  remeasure.current = () => {
    const drawing = drawingRef.current;
    const next = drawing && measureDrawing(drawing, figure);
    // The frame's corner too: a part that moves without changing size keeps
    // every box and would leave the drawing shifted under its own clip.
    const isSame =
      drawn &&
      next &&
      sameMeasure(drawn.measure, next.measure) &&
      Math.abs(drawn.frame.left - next.frame.left) < SAME &&
      Math.abs(drawn.frame.top - next.frame.top) < SAME;
    if (next && !isSame) {
      setDrawn(next);
    }
  };

  useLayoutEffect(() => {
    // A drawing is a picture shown whole, so its images load now. A cover
    // asks to load lazily, which the browser judges against the screen, and
    // inside a zoomed panel clipped to one of its parts — the enlarged one
    // in the lightbox above all — it judged two covers never shown and the
    // player's album art stayed an empty square.
    drawingRef.current
      ?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')
      .forEach((image) => {
        image.loading = 'eager';
      });
    remeasure.current();
  });

  useEffect(() => {
    const drawing = drawingRef.current;
    if (!drawing || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => remeasure.current());
    observer.observe(drawing);
    drawing
      .querySelectorAll(
        [
          figure.frame,
          ...(figure.controls ?? []).map((control) => control.target),
        ]
          .filter((selector): selector is string => Boolean(selector))
          .join(', '),
      )
      .forEach((element) => observer.observe(element));
    // A picture arriving, and a part that moves into place as it mounts —
    // the menu opens with a scale — which no resize reports: a transform
    // changes nothing's size, and measured mid-way the menu's frame lost its
    // last row. The drawing's motion is cut to a millisecond
    // (`_helpLive.scss`), never to nothing, so these still arrive.
    const remeasureNow = () => remeasure.current();
    const SETTLED = ['load', 'animationend', 'transitionend'] as const;
    SETTLED.forEach((type) =>
      drawing.addEventListener(type, remeasureNow, true),
    );
    return () => {
      observer.disconnect();
      SETTLED.forEach((type) =>
        drawing.removeEventListener(type, remeasureNow, true),
      );
    };
  }, [figure]);

  useEffect(() => {
    if (drawn) {
      onMeasure?.(drawn.measure);
    }
  }, [drawn, onMeasure]);

  const frame = drawn?.frame;
  return (
    <div
      className="help-live"
      inert
      aria-hidden="true"
      style={{
        zoom,
        width: drawn?.measure.width ?? figure.width,
        height: drawn?.measure.height ?? figure.height,
      }}
    >
      <div
        ref={drawingRef}
        className="help-live__drawing"
        style={{
          width: figure.width,
          left: -(frame?.left ?? 0),
          top: -(frame?.top ?? 0),
        }}
      >
        <Drawing />
      </div>
    </div>
  );
}
