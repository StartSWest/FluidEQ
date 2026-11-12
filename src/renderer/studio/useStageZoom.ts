import { useEffect, useRef, useState, type RefObject } from 'react';
import useSpaceHeld from './useSpaceHeld';

/**
 * A closer look at the Studio's stage (Ivan, 2026-11-08: "zoom and pan the
 * scene so I can take pictures of visible area", "control scroll or add
 * icons on top, zoom the scene, space pan scene that is zoomed").
 *
 * The scene is drawn again at the size it is zoomed to — never a picture
 * stretched — so what is magnified has its own detail; the runner holds
 * every drawing to a 4K frame's pixels (`useSceneRunner`), so a close look
 * costs at most what full screen on a 4K monitor does.
 *
 * Ctrl with the wheel (or a pinch) zooms about the pointer; it is the
 * view's here, and the plain wheel stays the camera's, as everywhere a scene
 * can be turned. With Space held a drag moves the zoomed view instead of
 * turning the scene. Both are taken on the stage's well, before the scene's
 * own hands hear them (`sceneInteraction.ts` listens on the stage inside).
 */

export interface IStageView {
  scale: number;
  /** Where the zoomed picture's top left corner stands, from the screen's. */
  x: number;
  y: number;
}

/** As close as a look goes: past it the 4K budget only magnifies pixels. */
export const MOST_STAGE_ZOOM = 4;

/** The buttons' steps. */
/**
 * The furthest the stage is stood back from, in Edit mode: a quarter of its
 * size, with the editor's grid round it (Ivan, 2026-11-11: "it is the user
 * who decides to zoom out to see more"). Everywhere else the whole picture is
 * the furthest there is.
 */
export const LEAST_EDIT_ZOOM = 0.25;

const STOPS = [0.25, 0.35, 0.5, 0.7, 1, 1.5, 2, 3, 4];

/** How far one pixel of wheel zooms, as an exponent (`usePictureZoom`). */
const WHEEL_ZOOM = 0.002;
const WHEEL_LINE = 16;

const FITTED: IStageView = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * How much of the picture stays on screen however far Edit mode's canvas is
 * moved: enough to be grabbed again and brought back.
 */
const KEPT_IN_VIEW = 0.2;

/**
 * A view that keeps the screen covered by the picture — or, on Edit mode's
 * canvas (`least` under 1), keeps a fifth of the picture on it. There the
 * member moves the scene out from under the panels that float over it, as
 * on any editor's canvas, at whatever size it is (Ivan, 2026-11-11: "if the
 * user hits space while in the editor, show the hand cursor so they can move
 * the scene"); held to the screen, a scene at its own size could not move.
 */
const held = (
  view: IStageView,
  width: number,
  height: number,
  least: number,
) => {
  const scale = clamp(view.scale, least, MOST_STAGE_ZOOM);
  if (least < 1) {
    const keptX = width * scale * KEPT_IN_VIEW;
    const keptY = height * scale * KEPT_IN_VIEW;
    return {
      scale,
      x: clamp(view.x, keptX - width * scale, width - keptX),
      y: clamp(view.y, keptY - height * scale, height - keptY),
    };
  }
  // Closer than whole, the picture covers the screen and is moved inside
  // it; stood back, it is smaller than the screen and stays inside it.
  const spareX = width - width * scale;
  const spareY = height - height * scale;
  return {
    scale,
    x: clamp(view.x, Math.min(spareX, 0), Math.max(spareX, 0)),
    y: clamp(view.y, Math.min(spareY, 0), Math.max(spareY, 0)),
  };
};

/** The view zoomed to `scale` with the screen's point (`px`, `py`) held still. */
const zoomedAbout = (
  from: IStageView,
  scale: number,
  px: number,
  py: number,
  width: number,
  height: number,
  least: number,
) => {
  const to = clamp(scale, least, MOST_STAGE_ZOOM);
  const ratio = to / from.scale;
  return held(
    {
      scale: to,
      x: px - (px - from.x) * ratio,
      y: py - (py - from.y) * ratio,
    },
    width,
    height,
    least,
  );
};

export default function useStageZoom(
  wellRef: RefObject<HTMLDivElement | null>,
  screenRef: RefObject<HTMLDivElement | null>,
  width: number,
  height: number,
  /** How far the stage may be stood back from: 1, or less in Edit mode. */
  least = 1,
) {
  const [stored, setStored] = useState<IStageView>(FITTED);
  const view = held(stored, width, height, least);
  // Closer than the whole picture, stood back from it, or moved off it:
  // anything but the picture laid exactly on the screen.
  const zoomed =
    Math.abs(view.scale - 1) > 0.001 ||
    Math.abs(view.x) > 0.5 ||
    Math.abs(view.y) > 0.5;
  // Space is the view's only while there is a view to move: unzoomed, a
  // stage takes nothing from the keyboard — except Edit mode's canvas,
  // where the scene can always be moved.
  const movable = zoomed || least < 1;
  const spaceHeld = useSpaceHeld(movable);
  const [dragging, setDragging] = useState(false);
  const live = useRef({ view, width, height, spaceHeld, movable, least });
  live.current = { view, width, height, spaceHeld, movable, least };

  useEffect(() => {
    const well = wellRef.current;
    if (!well) {
      return undefined;
    }
    const pointIn = (clientX: number, clientY: number) => {
      const rect = screenRef.current?.getBoundingClientRect();
      return rect
        ? { x: clientX - rect.left, y: clientY - rect.top }
        : { x: live.current.width / 2, y: live.current.height / 2 };
    };
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE : 1;
      const at = pointIn(event.clientX, event.clientY);
      const now = live.current;
      setStored(
        zoomedAbout(
          now.view,
          now.view.scale * Math.exp(-event.deltaY * unit * WHEEL_ZOOM),
          at.x,
          at.y,
          now.width,
          now.height,
          now.least,
        ),
      );
    };
    let drag:
      { pointer: number; x: number; y: number; from: IStageView } | undefined;
    const onDown = (event: PointerEvent) => {
      const now = live.current;
      if (!now.spaceHeld || !now.movable || event.button !== 0) {
        return;
      }
      // The scene's hands never hear a press that moves the view.
      event.preventDefault();
      event.stopPropagation();
      try {
        well.setPointerCapture(event.pointerId);
      } catch {
        // A pointer already gone cannot be captured; the drag still follows
        // it while it stays over the stage, and its up ends it.
      }
      drag = {
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        from: now.view,
      };
      setDragging(true);
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) {
        return;
      }
      event.stopPropagation();
      const { width: w, height: h, least: furthest } = live.current;
      setStored(
        held(
          {
            ...drag.from,
            x: drag.from.x + event.clientX - drag.x,
            y: drag.from.y + event.clientY - drag.y,
          },
          w,
          h,
          furthest,
        ),
      );
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) {
        return;
      }
      event.stopPropagation();
      drag = undefined;
      setDragging(false);
    };
    well.addEventListener('wheel', onWheel, { capture: true, passive: false });
    well.addEventListener('pointerdown', onDown, { capture: true });
    well.addEventListener('pointermove', onMove, { capture: true });
    well.addEventListener('pointerup', onUp, { capture: true });
    well.addEventListener('pointercancel', onUp, { capture: true });
    return () => {
      well.removeEventListener('wheel', onWheel, { capture: true });
      well.removeEventListener('pointerdown', onDown, { capture: true });
      well.removeEventListener('pointermove', onMove, { capture: true });
      well.removeEventListener('pointerup', onUp, { capture: true });
      well.removeEventListener('pointercancel', onUp, { capture: true });
    };
  }, [wellRef, screenRef]);

  /** The next stop in `direction`, about the middle of the screen. */
  const step = (direction: 1 | -1) => {
    const next =
      direction > 0
        ? STOPS.find((stop) => stop > view.scale + 0.01)
        : [...STOPS]
            .reverse()
            .find((stop) => stop < view.scale - 0.01 && stop >= least - 0.001);
    setStored(
      zoomedAbout(
        view,
        next ?? view.scale,
        width / 2,
        height / 2,
        width,
        height,
        least,
      ),
    );
  };

  return {
    view,
    zoomed,
    /** Space is held where the view can move: the hand moves it. */
    panning: spaceHeld && movable,
    dragging,
    percent: Math.round(view.scale * 100),
    canZoomIn: view.scale < MOST_STAGE_ZOOM - 0.01,
    canZoomOut: view.scale > least + 0.01,
    zoomIn: () => step(1),
    zoomOut: () => step(-1),
    toFit: () => setStored(FITTED),
  };
}

export type TStageZoom = ReturnType<typeof useStageZoom>;
