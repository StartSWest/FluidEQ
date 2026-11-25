/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';

interface IMark {
  /** Where the number stands, in the frame's own pixels. */
  readonly left: number;
  readonly top: number;
}

/**
 * Where a number stands against its part: beside it by default, so it never
 * hides the reading it points at, or on it for a part too small to cover.
 */
export type TMarkSide = 'left' | 'right' | 'top' | 'corner' | 'center';

export interface ITourMark {
  readonly target: string;
  readonly side?: TMarkSide;
}

/** Half a mark and the air between it and its part. */
const MARK_REACH = 15;

interface ITourLiveFigureProps {
  /** The app's own controls on made-up data (`live26/`). */
  Drawing: ComponentType;
  /** The width the drawing is laid out at, in CSS pixels. */
  width: number;
  /**
   * Its height as expected, for the frame's size before it is drawn. The
   * drawing's own height is measured before the first paint and wins, so a
   * longer language that wraps a line is never cut off.
   */
  height: number;
  /**
   * The parts the slide's three points name, in their order, each matched
   * inside the drawing by a selector. Each gets its number beside the part.
   */
  marks?: readonly ITourMark[];
}

/**
 * The most a drawing is drawn up: past this the app's 12px labels read as
 * a poster's, and nobody would mistake the panel for the one in their
 * window.
 */
const MOST = 1.2;

const sameMarks = (one: readonly (IMark | undefined)[], other: typeof one) =>
  one.length === other.length &&
  one.every((mark, index) => {
    const twin = other[index];
    return mark === undefined || twin === undefined
      ? mark === twin
      : Math.abs(mark.left - twin.left) < 0.5 &&
          Math.abs(mark.top - twin.top) < 0.5;
  });

/**
 * A live figure of 2.6's What's New: the app's own panel, laid out at a
 * fixed size and drawn as large as the slide's room allows by CSS `zoom`
 * (which lays it out again at the drawn size, so its text stays as crisp as
 * the window's own), with a numbered mark on each part the points name.
 *
 * The frame is sized from the drawing's fixed size before anything is
 * drawn in it, so nothing on the slide moves while it fills (Ivan,
 * 2026-11-24: "nothing moves when data arrives").
 *
 * NOTHING IN IT CAN BE PRESSED OR READ OUT: `inert` and `aria-hidden`, the
 * slide's words say what it shows. And it is drawn only while some of it is
 * in sight of the slide's scroller: scrolled away, the drawing is unmounted
 * and every loop inside it stops with it, the frame keeping its place.
 */
export default function TourLiveFigure({
  Drawing,
  width,
  height,
  marks = [],
}: ITourLiveFigureProps) {
  const roomRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0);
  const [drawnHeight, setDrawnHeight] = useState(height);
  // In sight until the observer says otherwise: the slide was just put on
  // stage, and starting hidden drew one empty frame before the panel.
  const [isInSight, setInSight] = useState(true);
  const [placed, setPlaced] = useState<readonly (IMark | undefined)[]>([]);

  useLayoutEffect(() => {
    const room = roomRef.current;
    if (!room) {
      return undefined;
    }
    const fit = () => {
      const box = room.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) {
        return;
      }
      setZoom(Math.min(MOST, box.width / width, box.height / drawnHeight));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(fit);
    observer.observe(room);
    return () => observer.disconnect();
  }, [width, drawnHeight]);

  // The drawing's own height, before the first paint and whenever its
  // contents change size: read in the drawing's own pixels, whatever zoom
  // it is drawn at.
  useLayoutEffect(() => {
    const drawing = drawingRef.current;
    if (!drawing) {
      return undefined;
    }
    const measure = () => {
      const scale = zoom || 1;
      const next = drawing.getBoundingClientRect().height / scale;
      if (next > 0) {
        setDrawnHeight((before) =>
          Math.abs(before - next) < 1 ? before : Math.ceil(next),
        );
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(drawing);
    return () => observer.disconnect();
  }, [zoom, isInSight]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => setInSight(entries.some((entry) => entry.isIntersecting)),
      { root: room.closest('.feature-tour__stage') },
    );
    observer.observe(room);
    return () => observer.disconnect();
  }, []);

  // The numbers follow the parts after every render and whenever anything
  // in the drawing finishes arriving: a part that moves as it mounts is
  // only where it stays once its motion ends.
  const place = useRef<() => void>(() => undefined);
  place.current = () => {
    const drawing = drawingRef.current;
    if (!drawing || marks.length === 0) {
      return;
    }
    const origin = drawing.getBoundingClientRect();
    // A number may stand out past the frame, in the room around it, but
    // never past the room: it would be cut off at the stage's edge.
    const room = roomRef.current?.getBoundingClientRect() ?? origin;
    const leftmost = room.left - origin.left + MARK_REACH;
    const rightmost = room.right - origin.left - MARK_REACH;
    const next = marks.map(({ target, side = 'left' }) => {
      const part = drawing.querySelector(target);
      if (!part) {
        return undefined;
      }
      const box = part.getBoundingClientRect();
      if (box.width <= 0 && box.height <= 0) {
        return undefined;
      }
      const left = box.left - origin.left;
      const top = box.top - origin.top;
      const middle = { left: left + box.width / 2, top: top + box.height / 2 };
      if (side === 'center') {
        return middle;
      }
      if (side === 'corner') {
        return {
          left: Math.max(leftmost, left),
          top: Math.max(MARK_REACH, top),
        };
      }
      if (side === 'top') {
        return {
          left: middle.left,
          top: Math.max(MARK_REACH, top - MARK_REACH),
        };
      }
      // Beside it, on the asked side while there is room there.
      const before = left - MARK_REACH;
      const after = left + box.width + MARK_REACH;
      const fitsBefore = before >= leftmost;
      const fitsAfter = after <= rightmost;
      if (side === 'left' ? fitsBefore : !fitsAfter && fitsBefore) {
        return { left: before, top: middle.top };
      }
      if (fitsAfter) {
        return { left: after, top: middle.top };
      }
      // A part as wide as its room: the number sits on its top-left corner,
      // as a badge does, over the edge rather than over what it holds.
      return { left: Math.max(leftmost, left), top: Math.max(MARK_REACH, top) };
    });
    const lowest = origin.height - MARK_REACH;
    const held = next.map(
      (mark) =>
        mark && {
          left: mark.left,
          top: Math.min(lowest, Math.max(MARK_REACH, mark.top)),
        },
    );
    setPlaced((before) => (sameMarks(before, held) ? before : held));
  };
  useLayoutEffect(() => place.current());
  useEffect(() => {
    const drawing = drawingRef.current;
    if (!drawing) {
      return undefined;
    }
    const again = () => place.current();
    const SETTLED = ['load', 'animationend', 'transitionend'] as const;
    SETTLED.forEach((type) => drawing.addEventListener(type, again, true));
    return () =>
      SETTLED.forEach((type) => drawing.removeEventListener(type, again, true));
  }, [isInSight]);

  const shown = zoom > 0;
  return (
    <div ref={roomRef} className="tour-live">
      <div
        className="tour-live__frame"
        inert
        aria-hidden="true"
        style={{
          width: shown ? width * zoom : undefined,
          height: shown ? drawnHeight * zoom : undefined,
          visibility: shown ? undefined : 'hidden',
        }}
      >
        <div
          ref={drawingRef}
          className="tour-live__drawing"
          style={{ width, zoom: zoom || 1 }}
        >
          {isInSight && <Drawing />}
        </div>
        {isInSight &&
          placed.map(
            (mark, index) =>
              mark && (
                <span
                  // eslint-disable-next-line react/no-array-index-key -- a mark is its point's number
                  key={index}
                  className="tour-live__mark"
                  style={{ left: mark.left, top: mark.top }}
                >
                  {index + 1}
                </span>
              ),
          )}
      </div>
    </div>
  );
}
