/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long a scene takes to come back once everything has stopped moving.
 *
 * A quarter of a second. It was tried at a full second, Ivan's own number,
 * and that was wrong: the ramp is not the whole wait, so on top of the box
 * settling it left the strip at less than full strength for a second and a
 * half.
 */
export const SETTLE_FADE_MS = 250;

/**
 * Sent from the canvas, bubbling, each time the picture settles into its box
 * again: a frame drawn for the box it stands in is on the canvas. A layer
 * that reveals more of the picture only once there is a picture there to
 * reveal (`useSceneColumnReach.ts`) waits on this.
 */
export const SCENE_SETTLED_EVENT = 'fluideq-scene-settled';

/** A box in CSS pixels. */
export interface ISceneBox {
  width: number;
  height: number;
}

/** The boxes the frames that may be on the canvas were drawn for. */
interface IBoxSpan {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

/** A resize observer's fractional boxes move by less without anything moving. */
const SAME_PX = 0.5;

const spanOf = (box: ISceneBox): IBoxSpan => ({
  minWidth: box.width,
  maxWidth: box.width,
  minHeight: box.height,
  maxHeight: box.height,
});

const widen = (span: IBoxSpan, box: ISceneBox): IBoxSpan => ({
  minWidth: Math.min(span.minWidth, box.width),
  maxWidth: Math.max(span.maxWidth, box.width),
  minHeight: Math.min(span.minHeight, box.height),
  maxHeight: Math.max(span.maxHeight, box.height),
});

/** How the canvas lays its picture over a box it was not drawn for. */
export interface ISceneCanvasFit {
  fit: 'contain' | 'cover';
  /** `object-position`; empty is the centre. */
  position: string;
}

/**
 * The fit that shows the picture already on the canvas over `box` without
 * scaling it, where there is one: a box that only grew or shrank in height,
 * the width the same, is the picture at its own size from the top — `contain`
 * leaves the new strip at the foot empty, `cover` cuts the old one off — and
 * on the column's layer that is exactly the picture the next frame draws, the
 * plot framing it from the top (`sceneView.ts`). Anything else, a width that
 * moved, is the picture scaled to cover the box at its own proportions.
 *
 * Every frame that may be on the canvas counts (`span`), not only the last
 * one settled: a frame drawn for a box the panel has since left can still
 * land, and a fit right for one height and wrong for another would scale it.
 */
export const fitWhileMoving = (
  span: IBoxSpan | undefined,
  box: ISceneBox | undefined,
): ISceneCanvasFit => {
  const sameWidth =
    span !== undefined &&
    box !== undefined &&
    Math.abs(span.minWidth - box.width) <= SAME_PX &&
    Math.abs(span.maxWidth - box.width) <= SAME_PX;
  if (sameWidth && span.maxHeight <= box.height + SAME_PX) {
    return { fit: 'contain', position: '50% 0' };
  }
  if (sameWidth && span.minHeight >= box.height - SAME_PX) {
    return { fit: 'cover', position: '50% 0' };
  }
  return { fit: 'cover', position: '' };
};

export interface ISceneCanvasHold {
  /** The host's box changed (`ResizeObserver`); `box` when it was measured. */
  boxChanged(box: ISceneBox | undefined): void;
  /**
   * The canvas went into another host (`rehost`): a box nothing has measured
   * yet, so no picture on it is known to fit it.
   */
  moved(): void;
  /** Held from outside: no frame settles the picture until let go. */
  pin(held: boolean): void;
  /** A frame is sent to the worker now: the box turn it is drawn for. */
  sending(): number;
  /** The worker's newest frame on the canvas was drawn for `turn`. */
  onCanvas(turn: number | undefined): void;
}

/**
 * One rule for a canvas whose pixels belong to a worker: while the box is
 * moving the scene keeps its last picture, never stretched, never scaled and
 * never taken away, and the first frame drawn for the box it stands in takes
 * its place.
 *
 * The canvas is pulled to its host's size by CSS while the pixels behind it
 * belong to the worker, so every box change leaves the old picture over the
 * new box until the worker catches up. Stretched to it, going into full
 * screen, that was 88ms of a strip 214 rows tall pulled over a box of 1316 —
 * unmistakable on anything with straight lines in it (Ivan, 2026-09-26: "the
 * scene itself kind of compresses"). It was then taken off the screen for
 * those moments instead, and the scene blinked out on every change of mode
 * (Ivan, 2026-09-27: "can we avoid hiding the graph for a milise when resizing
 * on changing modes?"). So it is laid over the box at its own proportions
 * (`fitWhileMoving`): at its own size where the box only changed height,
 * covering it where the width moved too.
 *
 * Switched in a ResizeObserver, which runs after the frame callbacks and
 * before the paint: it lands in the same frame the box changed in, and a
 * stretched frame is never painted. Noticing it from the draw loop would let
 * one frame through.
 *
 * The picture fills its box again only once a frame drawn for that box is ON
 * THE CANVAS, as the worker reports it — not when the worker has been sent
 * the frame, nor when it answers. The worker answers a frame at once and
 * draws it on its own next animation frame, later still while it paces or
 * the GPU holds two frames already, so settling on the answer put the old
 * picture back to filling the new box — stretched — until the worker caught
 * up. That was the scene pulled tall for up to a second each time the EQ
 * page's See through left 0 and the picture ran on under the bands' card
 * (Ivan, 2026-11-25: "the scene kind of stretches out for a second").
 *
 * A box does not change once — the graph's plot arrived at its height in
 * three steps — and a frame that happened to arrive between belongs to a size
 * the panel has already left. Every box change takes a turn, each frame
 * carries the turn it was sent for, and only a frame of the current turn on
 * the canvas settles it.
 *
 * The first picture is the one exception: before anything is drawn there is
 * nothing to keep, and the scene fades in on its first frame — unless it
 * arrives at once. A graph look does: the page has been drawing it and hands
 * it over on the engine's first frame of it, and faded in, the look sank to
 * nothing at the handover and climbed back over this quarter second (Ivan,
 * 2026-09-28: "still doing the flashing when switching viz").
 *
 * No timer anywhere: it changes on a box changing and settles on a frame
 * arriving, and the frame loop is kicked on every resize.
 */
export const createSceneCanvasHold = (
  canvas: HTMLCanvasElement,
  arrival: 'fade' | 'at-once',
  /** The first picture has been put on, its fade (if any) just started. */
  firstShown: () => void,
): ISceneCanvasHold => {
  let settled = true;
  let turn = 0;
  let hasShown = false;
  let pinned = false;
  let box: ISceneBox | undefined;
  let span: IBoxSpan | undefined;
  canvas.style.transition = `opacity ${SETTLE_FADE_MS}ms ease-out`;

  const hold = () => {
    turn += 1;
    if (hasShown) {
      const { fit, position } = fitWhileMoving(span, box);
      canvas.style.objectFit = fit;
      canvas.style.objectPosition = position;
    } else if (settled) {
      canvas.style.transition = 'none';
      canvas.style.opacity = '0';
    }
    settled = false;
  };

  const settle = () => {
    settled = true;
    span = box ? spanOf(box) : undefined;
    canvas.style.objectFit = '';
    canvas.style.objectPosition = '';
    if (!hasShown) {
      hasShown = true;
      canvas.style.transition =
        arrival === 'fade' ? `opacity ${SETTLE_FADE_MS}ms ease-out` : 'none';
      canvas.style.opacity = '1';
      firstShown();
    }
    canvas.dispatchEvent(new Event(SCENE_SETTLED_EVENT, { bubbles: true }));
  };

  return {
    boxChanged: (measured) => {
      box = measured ?? box;
      hold();
    },
    moved: () => {
      box = undefined;
      span = undefined;
      hold();
    },
    pin: (held) => {
      if (held === pinned) {
        return;
      }
      pinned = held;
      // A new turn either way: held, the picture goes now; let go, only a
      // frame sent from here on brings it back.
      hold();
    },
    sending: () => {
      if (box) {
        span = span ? widen(span, box) : spanOf(box);
      }
      return turn;
    },
    onCanvas: (drawnFor) => {
      if (settled || pinned || drawnFor !== turn) {
        return;
      }
      settle();
    },
  };
};
