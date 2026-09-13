import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  CRISP_FROM,
  canZoom,
  clampView,
  fitScale,
  nextStop,
  panView,
  placement,
  zoomView,
  type IPoint,
  type ISize,
  type IZoomSpace,
  type IZoomView,
} from './pictureZoom';

/**
 * How far one pixel of wheel travel zooms, as an exponent: a mouse's notch
 * of 100 is a fifth, and a touchpad pinch, which Chromium sends as a wheel
 * with Ctrl held in steps of a few pixels, glides.
 */
const WHEEL_ZOOM = 0.002;

/** A wheel that counts in lines moves this many pixels to each. */
const WHEEL_LINE = 16;

/** The keys that zoom: in, out, or back to fitted. */
const ZOOM_KEYS: Record<string, 1 | -1 | 0> = {
  '+': 1,
  '=': 1,
  '-': -1,
  _: -1,
  '0': 0,
};

interface IZoomState {
  /** The picture this belongs to; any other picture is shown fitted. */
  key: string;
  /** Undefined while the picture is fitted. */
  view: IZoomView | undefined;
  /** Moved by a step rather than a gesture, so it glides there. */
  eased: boolean;
}

const held = (state: IZoomState | undefined, key: string) =>
  state?.key === key ? state.view : undefined;

/**
 * Where a pointer is in `place`, from its middle, in the place's own layout
 * pixels — the bounding box is scaled while the dialog opens.
 */
const pointIn = (
  place: HTMLElement,
  clientX: number,
  clientY: number,
  box: ISize,
): IPoint => {
  const rect = place.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * box.width - box.width / 2,
    y: ((clientY - rect.top) / rect.height) * box.height - box.height / 2,
  };
};

/**
 * Zoom and pan for one picture in `placeRef`: Ctrl with the wheel or a
 * pinch zooms about the pointer, the wheel and a drag pan a zoomed picture,
 * a double-click goes between fitted and close, and + − 0 step, anywhere
 * in the viewer.
 *
 * A zoom belongs to the picture `key` names, so stepping to another picture
 * shows it fitted without an effect putting it back — and without a frame
 * of the old zoom on the new picture.
 *
 * Every size is measured, never a timer's guess: the space is read once
 * before the first paint and then from a `ResizeObserver`.
 */
export default function usePictureZoom(
  placeRef: RefObject<HTMLDivElement | null>,
  key: string,
  width: number,
  height: number,
  /** The most the picture is enlarged by when fitted. */
  most: number,
) {
  const [box, setBox] = useState<ISize>();
  const [state, setState] = useState<IZoomState>();
  // Forgotten as soon as another picture is shown, not only hidden: a zoom
  // kept under its key came back on that picture when the arrows stepped
  // back to it. Reset while rendering, so no frame draws it on either one.
  if (state && state.key !== key) {
    setState(undefined);
  }
  const [dragging, setDragging] = useState(false);
  const drag = useRef<
    { pointer: number; x: number; y: number; from: IZoomView } | undefined
  >(undefined);

  useLayoutEffect(() => {
    const place = placeRef.current;
    if (!place) {
      return undefined;
    }
    const measure = (w: number, h: number) =>
      setBox((now) => {
        if (w < 1 || h < 1) {
          return undefined;
        }
        return now &&
          Math.round(now.width) === Math.round(w) &&
          Math.round(now.height) === Math.round(h)
          ? now
          : { width: w, height: h };
      });
    // Layout pixels, not the bounding box: the dialog is still scaled by
    // its opening animation when this runs.
    measure(place.clientWidth, place.clientHeight);
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(place);
    return () => observer.disconnect();
  }, [placeRef]);

  const space = useMemo<IZoomSpace | undefined>(
    () =>
      box && {
        size: { width, height },
        box,
        fit: fitScale({ width, height }, box, most),
      },
    [box, width, height, most],
  );
  const current = state?.key === key ? state : undefined;
  const view =
    space && current?.view ? clampView(current.view, space) : undefined;
  const fit = space?.fit ?? 1;
  const scale = view?.scale ?? fit;
  const pannable =
    !!space &&
    !!view &&
    (width * view.scale > space.box.width + 0.5 ||
      height * view.scale > space.box.height + 0.5);

  const zoomStep = useCallback(
    (direction: 1 | -1) => {
      if (!space) {
        return;
      }
      setState((now) => {
        const from = held(now, key);
        const at = from ? clampView(from, space).scale : space.fit;
        return {
          key,
          view: zoomView(
            from,
            nextStop(at, space.fit, direction),
            { x: 0, y: 0 },
            space,
          ),
          eased: true,
        };
      });
    },
    [key, space],
  );

  const toFit = useCallback(
    () => setState({ key, view: undefined, eased: true }),
    [key],
  );

  useEffect(() => {
    const place = placeRef.current;
    if (!place || !space) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      // Nothing behind the viewer scrolls while the pointer is on the
      // picture. Ctrl with the wheel is already refused as page zoom for the
      // whole window (index.tsx), and still arrives here to zoom the picture.
      event.preventDefault();
      let unit = 1;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        unit = WHEEL_LINE;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        unit = space.box.height;
      }
      if (event.ctrlKey || event.metaKey) {
        const point = pointIn(place, event.clientX, event.clientY, space.box);
        const factor = Math.exp(-event.deltaY * unit * WHEEL_ZOOM);
        setState((now) => {
          const from = held(now, key);
          const at = from ? clampView(from, space).scale : space.fit;
          return {
            key,
            view: zoomView(from, at * factor, point, space),
            eased: false,
          };
        });
        return;
      }
      // A plain wheel pans a zoomed picture, sideways with Shift, and leaves
      // a fitted one alone.
      const sideways = event.shiftKey && event.deltaX === 0;
      const dx = (sideways ? event.deltaY : event.deltaX) * unit;
      const dy = (sideways ? 0 : event.deltaY) * unit;
      setState((now) => {
        const from = held(now, key);
        return from
          ? {
              key,
              view: panView(clampView(from, space), -dx, -dy, space),
              eased: false,
            }
          : now;
      });
    };
    place.addEventListener('wheel', onWheel, { passive: false });
    return () => place.removeEventListener('wheel', onWheel);
  }, [placeRef, space, key]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = ZOOM_KEYS[event.key];
      if (
        direction === undefined ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (direction === 0) {
        toFit();
      } else {
        zoomStep(direction);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toFit, zoomStep]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !pannable || !view) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from: view,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const from = drag.current;
    if (!from || from.pointer !== event.pointerId || !space) {
      return;
    }
    setState({
      key,
      view: panView(
        from.from,
        event.clientX - from.x,
        event.clientY - from.y,
        space,
      ),
      eased: false,
    });
  };

  const endDrag = () => {
    drag.current = undefined;
    setDragging(false);
  };

  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (!space) {
      return;
    }
    if (view) {
      toFit();
      return;
    }
    // Its own pixels when it is shown smaller than that, twice the fitted
    // size when it already fits at its own size or more.
    const target = space.fit < 1 ? 1 : space.fit * 2;
    setState({
      key,
      view: zoomView(
        undefined,
        target,
        pointIn(event.currentTarget, event.clientX, event.clientY, space.box),
        space,
      ),
      eased: true,
    });
  };

  const drawn = space && placement(scale, view ?? { x: 0, y: 0 }, space);

  return {
    /** The picture's size and place in its space; none until it is measured. */
    frameStyle: drawn
      ? ({
          width: drawn.width,
          height: drawn.height,
          transform: `translate(${drawn.left}px, ${drawn.top}px)`,
        } as CSSProperties)
      : undefined,
    percent: Math.round(scale * 100),
    zoomed: !!view,
    pannable,
    dragging,
    eased: !!current?.eased,
    crisp: !!view && scale >= CRISP_FROM,
    canZoomIn: canZoom(scale, fit, 1),
    canZoomOut: canZoom(scale, fit, -1),
    zoomIn: () => zoomStep(1),
    zoomOut: () => zoomStep(-1),
    toFit,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onDoubleClick,
    },
  };
}
