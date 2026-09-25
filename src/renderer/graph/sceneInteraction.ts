import {
  clampSceneCamera,
  DEFAULT_SCENE_CAMERA,
  turnsRound,
  type ISceneCamera,
  type ISceneCameraLimits,
} from 'common/sceneCamera';
import { SCENE_TAP_AGE_LIMIT_S } from 'common/sceneUniformContract';
import { getEaseFactor } from 'common/smoothing';
import { prefersReducedMotion } from '../utils/bandReveal';
import { HOME_CAMERA, NO_POINTER, NO_TAP } from './sceneGl';

/**
 * The viewer's hands on a scene: where the pointer is, a tap, and the camera
 * a 3D scene lets them turn (`common/sceneCamera.ts`). One of these per
 * surface a scene is drawn on; the runner reads it every frame
 * (`useSceneRunner.ts`) and hands the scene `uPointer`, `uTap` and `uCamera`.
 *
 * The gestures are the app's, the same in every scene: drag to turn and tilt
 * (the scene follows the hand, as a thing picked up and turned does), the
 * wheel or a pinch to move in and out, all held inside the angles the scene's
 * author allows. Which drags turn the camera is each surface's to say
 * (`attach`): on the graph a plain drag is the band marquee whenever bands can
 * be edited, and turning the scene must never cost the equaliser its gesture.
 *
 * No timers: the camera's glide after a release and its way home on a reset
 * are stepped by the frames the scene is already drawing.
 */

export interface ISceneHands {
  pointer: readonly [number, number, number, number];
  tap: readonly [number, number, number, number];
  camera: readonly [number, number, number];
  /** Something is moving under the viewer's hand: keep drawing at full rate. */
  busy: boolean;
}

export interface IAttachOptions {
  /** The scene's own box, which uv is measured across. */
  frame: () => DOMRect | undefined;
  /**
   * Whether this press turns the camera rather than doing what it did. Asked
   * only of presses the panel does not own.
   */
  turns: (event: PointerEvent) => boolean;
  /**
   * Whether a plain press turns the camera here, so the pointer shows a hand
   * over a scene that can be turned, and the wheel moves it in and out.
   * Absent: never.
   */
  grabs?: () => boolean;
  /**
   * What the panel keeps for itself - a band's handle, say: a press there is
   * never the scene's, neither a turn nor a tap, and neither is a wheel.
   * Buttons, fields, links and menus are always the panel's.
   */
  owns?: (target: Element) => boolean;
}

export interface ISceneInteraction {
  read(elapsedMs: number): ISceneHands;
  setLimits(limits: ISceneCameraLimits | undefined): void;
  /** Back to the author's view, gliding. */
  reset(): void;
  /** At the author's view at once, and no tap: a different scene begins. */
  home(): void;
  /** The camera is somewhere other than the author's view. */
  moved(): boolean;
  /** Told when `moved()` may have changed, for a Reset button. */
  subscribe(listener: () => void): () => void;
  attach(element: HTMLElement, options: IAttachOptions): () => void;
}

/** A drag across the panel's height turns the scene this far. */
const TURN_PER_HEIGHT = Math.PI * 0.8;
/** One notch of a mouse wheel (100 px of deltaY) moves in or out by this. */
const ZOOM_PER_PX = 0.0015;
/** How long a flung camera takes to lose half its speed. */
const GLIDE_HALF_LIFE_MS = 160;
/** A press that moves less than this is a tap, not a drag. */
const TAP_TRAVEL_PX = 6;
/** How quickly a press is felt, and how long the pointer takes to leave. */
const PRESS_HALF_LIFE_MS = 40;
const PRESENCE_HALF_LIFE_MS = 220;
/** The way home after a reset. */
const RETURN_HALF_LIFE_MS = 140;
/** A hand that stopped this long before letting go hands on no speed. */
const STOPPED_BEFORE_RELEASE_MS = 80;

/** Controls are the panel's wherever they are: never a turn, a tap or a zoom. */
const CONTROLS = 'button, input, select, textarea, a, [role="menu"]';

/** The cursor over an element the gestures are on. */
type THand = '' | 'grab' | 'grabbing';

/**
 * `camera` turned by a drag of `dx`, `dy` pixels on a panel `height` tall:
 * right turns the scene right, down tilts its top towards the viewer.
 */
export const dragSceneCamera = (
  camera: ISceneCamera,
  dx: number,
  dy: number,
  height: number,
  limits: ISceneCameraLimits,
): ISceneCamera => {
  const per = TURN_PER_HEIGHT / Math.max(1, height);
  return clampSceneCamera(
    {
      yaw: camera.yaw - dx * per,
      pitch: camera.pitch + dy * per,
      zoom: camera.zoom,
    },
    limits,
  );
};

/** `camera` moved in (wheel up, negative) or out by `deltaY` pixels of wheel. */
export const zoomSceneCamera = (
  camera: ISceneCamera,
  deltaY: number,
  limits: ISceneCameraLimits,
): ISceneCamera =>
  clampSceneCamera(
    { ...camera, zoom: camera.zoom * Math.exp(-deltaY * ZOOM_PER_PX) },
    limits,
  );

const isHome = (camera: ISceneCamera) =>
  Math.abs(camera.yaw) < 1e-3 &&
  Math.abs(camera.pitch) < 1e-3 &&
  Math.abs(camera.zoom - 1) < 1e-3;

/**
 * Whether a wheel of `deltaY` over `element` would scroll something around it:
 * an ancestor that scrolls and has room left that way, or the page itself.
 */
const scrollsFrom = (element: HTMLElement, deltaY: number) => {
  const hasRoom = (node: Element) =>
    deltaY < 0
      ? node.scrollTop > 0
      : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1 &&
      hasRoom(node)
    ) {
      return true;
    }
  }
  const page = element.ownerDocument.scrollingElement;
  return Boolean(
    page && page.scrollHeight > page.clientHeight + 1 && hasRoom(page),
  );
};

/** The shortest way round from `from` to `to`, for a scene that turns round. */
const angleTowards = (from: number, to: number) => {
  const turn = 2 * Math.PI;
  return ((((to - from + Math.PI) % turn) + turn) % turn) - Math.PI;
};

interface IPress {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  turning: boolean;
  /** Which button: the event its release is followed by depends on it. */
  button: number;
  at: number;
  /** Stops listening for its release anywhere in the window. */
  forget: () => void;
}

/**
 * The events a release of `button` is followed by: a click for the left one
 * (and a finger or a pen); the menu and an auxiliary click for the right; an
 * auxiliary click for the rest. Only those are swallowed after a turning
 * drag, and only until the next press - a click listener left waiting after a
 * right drag, which no click follows, took the next real one.
 */
const eventsAfter = (button: number): readonly string[] => {
  if (button === 0) {
    return ['click'];
  }
  return button === 2 ? ['contextmenu', 'auxclick'] : ['auxclick'];
};

export const createSceneInteraction = (): ISceneInteraction => {
  let limits: ISceneCameraLimits | undefined;
  let camera: ISceneCamera = { ...DEFAULT_SCENE_CAMERA };
  /** Radians a millisecond the camera is gliding at after a fling. */
  let glide = { yaw: 0, pitch: 0 };
  let returning = false;
  let pointerX = NO_POINTER[0];
  let pointerY = NO_POINTER[1];
  let presence = 0;
  let over = false;
  let held = 0;
  let pressedNow = false;
  let tap: { x: number; y: number; at: number } | undefined;
  let taps = 0;
  const presses = new Map<number, IPress>();
  /** Two fingers apart this far at the start of a pinch, and the zoom then. */
  let pinch: { distance: number; zoom: number } | undefined;
  let wasMoved = false;
  /** The pointer moved over a surface since the last frame read it. */
  let stirred = false;
  const listeners = new Set<() => void>();
  /** Every element the gestures are on, with how it says a plain press turns. */
  const attached = new Map<HTMLElement, () => boolean>();

  const announce = () => {
    const now = !isHome(camera);
    if (now !== wasMoved) {
      wasMoved = now;
      listeners.forEach((listener) => listener());
    }
  };

  const turning = () => [...presses.values()].some((press) => press.turning);

  /**
   * The cursor over each element: a hand where a plain press turns a scene
   * that can be turned, a closed one while it is being turned. Written only
   * when it changes, as a data attribute the stylesheet reads.
   */
  const showHands = () => {
    attached.forEach((grabs, element) => {
      let hand: THand = '';
      if (limits) {
        if (turning()) {
          hand = 'grabbing';
        } else if (grabs()) {
          hand = 'grab';
        }
      }
      if ((element.dataset.sceneHand ?? '') === hand) {
        return;
      }
      if (hand) {
        element.dataset.sceneHand = hand;
      } else {
        delete element.dataset.sceneHand;
      }
    });
  };

  const read = (elapsedMs: number): ISceneHands => {
    const step = Math.max(0, Math.min(200, elapsedMs));
    if (limits) {
      if (returning) {
        const ease = prefersReducedMotion()
          ? 1
          : getEaseFactor(step, RETURN_HALF_LIFE_MS);
        const yaw = turnsRound(limits)
          ? camera.yaw + angleTowards(camera.yaw, 0) * ease
          : camera.yaw * (1 - ease);
        camera = {
          yaw,
          pitch: camera.pitch * (1 - ease),
          zoom: camera.zoom + (1 - camera.zoom) * ease,
        };
        if (isHome(camera)) {
          camera = { ...DEFAULT_SCENE_CAMERA };
          returning = false;
        }
      } else if (!turning() && (glide.yaw !== 0 || glide.pitch !== 0)) {
        camera = clampSceneCamera(
          {
            yaw: camera.yaw + glide.yaw * step,
            pitch: camera.pitch + glide.pitch * step,
            zoom: camera.zoom,
          },
          limits,
        );
        const fade = 2 ** (-step / GLIDE_HALF_LIFE_MS);
        glide = { yaw: glide.yaw * fade, pitch: glide.pitch * fade };
        if (Math.abs(glide.yaw) + Math.abs(glide.pitch) < 1e-6) {
          glide = { yaw: 0, pitch: 0 };
        }
      }
      announce();
    }
    presence +=
      ((over ? 1 : 0) - presence) * getEaseFactor(step, PRESENCE_HALF_LIFE_MS);
    held +=
      ((pressedNow ? 1 : 0) - held) * getEaseFactor(step, PRESS_HALF_LIFE_MS);
    showHands();
    const now = performance.now();
    const moving = stirred;
    stirred = false;
    return {
      pointer: [pointerX, pointerY, held, presence],
      tap: tap
        ? [
            tap.x,
            tap.y,
            Math.min(SCENE_TAP_AGE_LIMIT_S, (now - tap.at) / 1000),
            taps,
          ]
        : NO_TAP,
      camera: limits ? [camera.yaw, camera.pitch, camera.zoom] : HOME_CAMERA,
      // A pointer merely resting over a silent scene does not keep it from
      // resting: most scenes never read it, and one that does still sees the
      // pointer at the resting pace. A pointer moving, or a hand on the scene,
      // does.
      busy:
        turning() ||
        returning ||
        glide.yaw !== 0 ||
        glide.pitch !== 0 ||
        moving ||
        held > 0.01,
    };
  };

  const setLimits = (next: ISceneCameraLimits | undefined) => {
    // Asked every frame with the pack's own object: the same object is the
    // same limits, and only a new version of the scene is worth comparing.
    if (next === limits || JSON.stringify(next) === JSON.stringify(limits)) {
      limits = next;
      return;
    }
    limits = next;
    camera = next
      ? clampSceneCamera(camera, next)
      : { ...DEFAULT_SCENE_CAMERA };
    glide = { yaw: 0, pitch: 0 };
    announce();
  };

  const attach = (element: HTMLElement, options: IAttachOptions) => {
    /** Pressed since the pointer came over it: the plain wheel is the scene's. */
    let engaged = false;
    /** The swallow waiting after a turning drag, taken back by the next press. */
    let swallowing: (() => void) | undefined;
    const stopSwallowing = () => {
      swallowing?.();
      swallowing = undefined;
    };
    const owned = (target: EventTarget | null) =>
      target instanceof Element &&
      (Boolean(target.closest(CONTROLS)) || Boolean(options.owns?.(target)));
    const uvOf = (event: PointerEvent | WheelEvent) => {
      const box = options.frame();
      if (!box || box.width <= 0 || box.height <= 0) {
        return undefined;
      }
      return {
        x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
        // The scene's uv starts at the bottom; the page's at the top.
        y: Math.max(0, Math.min(1, 1 - (event.clientY - box.top) / box.height)),
        height: box.height,
      };
    };

    /** A press over with no tap, no glide: let go where it did not count. */
    const drop = (pointerId: number) => {
      const press = presses.get(pointerId);
      if (!press) {
        return;
      }
      press.forget();
      presses.delete(pointerId);
      pinch = undefined;
      pressedNow = presses.size > 0;
      showHands();
    };

    const onMove = (event: PointerEvent) => {
      const uv = uvOf(event);
      if (uv) {
        pointerX = uv.x;
        pointerY = uv.y;
        over = true;
        stirred = true;
      }
      const press = presses.get(event.pointerId);
      if (!press) {
        return;
      }
      if (event.buttons === 0) {
        // Let go where nothing heard it: it is over, and held nothing.
        drop(event.pointerId);
        return;
      }
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      const dt = Math.max(1, event.timeStamp - press.at);
      press.x = event.clientX;
      press.y = event.clientY;
      press.at = event.timeStamp;
      if (!press.turning || !limits || !uv) {
        return;
      }
      if (presses.size >= 2) {
        // Two fingers: how far apart they are is the zoom.
        const [a, b] = [...presses.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch && pinch.distance > 0) {
          camera = clampSceneCamera(
            { ...camera, zoom: pinch.zoom * (distance / pinch.distance) },
            limits,
          );
        } else {
          pinch = { distance, zoom: camera.zoom };
        }
        return;
      }
      const before = camera;
      camera = dragSceneCamera(camera, dx, dy, uv.height, limits);
      // The speed of the hand at release is what the camera glides on with,
      // the short way round: a whole turn wraps at the back, and the angle
      // there jumps by a turn it never travelled - taken straight, a release
      // there set the view whirling for seconds.
      glide = {
        yaw: angleTowards(before.yaw, camera.yaw) / dt,
        pitch: (camera.pitch - before.pitch) / dt,
      };
      returning = false;
      event.preventDefault();
    };

    const onDown = (event: PointerEvent) => {
      // Whatever a drag before this left waiting to swallow belonged to that
      // drag: a new press is followed by its own click, which is not it.
      stopSwallowing();
      const uv = uvOf(event);
      if (!uv || owned(event.target)) {
        return;
      }
      pointerX = uv.x;
      pointerY = uv.y;
      over = true;
      pressedNow = true;
      engaged = true;
      const turnsNow = Boolean(limits) && options.turns(event);
      // A press this element does not capture - the panel's own, the marquee
      // - may be let go anywhere, where only the window hears it; held until
      // then, it kept the scene busy and `uPointer.z` at 1.
      const view = element.ownerDocument.defaultView;
      const { pointerId } = event;
      const release = (up: PointerEvent) => {
        if (up.pointerId === pointerId) {
          drop(pointerId);
        }
      };
      view?.addEventListener('pointerup', release);
      view?.addEventListener('pointercancel', release);
      presses.get(pointerId)?.forget();
      presses.set(pointerId, {
        id: pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        turning: turnsNow,
        button: event.button,
        at: event.timeStamp,
        forget: () => {
          view?.removeEventListener('pointerup', release);
          view?.removeEventListener('pointercancel', release);
        },
      });
      if (turnsNow) {
        // The press is the scene's: whatever else the panel does with a press
        // - the band marquee, a click that clears the selection - never sees
        // it. Captured, so the drag carries on past the panel's edge.
        event.stopPropagation();
        event.preventDefault();
        glide = { yaw: 0, pitch: 0 };
        pinch = undefined;
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // A pointer that is already gone cannot be captured; its up follows.
        }
        showHands();
      }
    };

    const onUp = (event: PointerEvent) => {
      const press = presses.get(event.pointerId);
      press?.forget();
      presses.delete(event.pointerId);
      pinch = undefined;
      if (presses.size === 0) {
        pressedNow = false;
      }
      if (!press) {
        return;
      }
      const travel = Math.hypot(
        event.clientX - press.startX,
        event.clientY - press.startY,
      );
      const uv = uvOf(event);
      // A tap is a primary press that stayed put - a finger, a pen or the
      // left button - never a right click on its way to a menu.
      if (
        travel < TAP_TRAVEL_PX &&
        uv &&
        event.type === 'pointerup' &&
        press.button === 0
      ) {
        tap = { x: uv.x, y: uv.y, at: performance.now() };
        taps = (taps + 1) % 4096;
      }
      if (press.turning) {
        showHands();
        // A hand that stopped before it let go has no speed to hand on.
        const stoppedFirst =
          event.timeStamp - press.at > STOPPED_BEFORE_RELEASE_MS;
        if (
          prefersReducedMotion() ||
          event.type !== 'pointerup' ||
          stoppedFirst
        ) {
          glide = { yaw: 0, pitch: 0 };
        }
        // A turned drag is not a click: the panel's own click - fading its
        // toolbar, clearing a selection, a menu - must not follow it.
        if (travel >= TAP_TRAVEL_PX && event.type === 'pointerup') {
          const types = eventsAfter(press.button);
          const swallow = (click: Event) => {
            click.stopPropagation();
            click.preventDefault();
            element.removeEventListener(click.type, swallow, {
              capture: true,
            });
          };
          types.forEach((type) =>
            element.addEventListener(type, swallow, { capture: true }),
          );
          swallowing = () =>
            types.forEach((type) =>
              element.removeEventListener(type, swallow, { capture: true }),
            );
        }
      }
    };

    const onLeave = () => {
      over = false;
      engaged = false;
    };

    const onWheel = (event: WheelEvent) => {
      if (
        !limits ||
        limits.zoom[1] - limits.zoom[0] < 1e-3 ||
        owned(event.target)
      ) {
        return;
      }
      // A touchpad's pinch arrives as Ctrl and the wheel, and so does Ctrl
      // with a mouse's: the zoom, wherever the scene can be turned at all (a
      // band's own Ctrl and wheel is its Q, and a band is owned).
      const pinching = event.ctrlKey;
      // The plain wheel only where a plain press is the scene's, and even
      // there the page's scroll comes first until the scene has been pressed:
      // a stage two-thirds of the gallery's height took every wheel that
      // crossed it, and the page could not be scrolled past it.
      if (
        !pinching &&
        (!(options.grabs?.() ?? false) ||
          (!engaged && scrollsFrom(element, event.deltaY)))
      ) {
        return;
      }
      event.preventDefault();
      const lines = event.deltaMode === 1 ? 33 : 1;
      camera = zoomSceneCamera(camera, event.deltaY * lines, limits);
      returning = false;
    };

    // Capture: the scene hears a press before the panel's own handlers, and
    // is the one to decide whether it turns the camera or passes it on.
    element.addEventListener('pointerdown', onDown, { capture: true });
    element.addEventListener('pointermove', onMove, { capture: true });
    element.addEventListener('pointerup', onUp, { capture: true });
    element.addEventListener('pointercancel', onUp, { capture: true });
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('wheel', onWheel, { passive: false });
    attached.set(element, options.grabs ?? (() => false));
    showHands();
    return () => {
      stopSwallowing();
      presses.forEach((press) => press.forget());
      attached.delete(element);
      delete element.dataset.sceneHand;
      element.removeEventListener('pointerdown', onDown, { capture: true });
      element.removeEventListener('pointermove', onMove, { capture: true });
      element.removeEventListener('pointerup', onUp, { capture: true });
      element.removeEventListener('pointercancel', onUp, { capture: true });
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('wheel', onWheel);
      presses.clear();
      over = false;
      pressedNow = false;
    };
  };

  return {
    read,
    setLimits,
    reset: () => {
      glide = { yaw: 0, pitch: 0 };
      returning = !isHome(camera);
    },
    home: () => {
      camera = { ...DEFAULT_SCENE_CAMERA };
      glide = { yaw: 0, pitch: 0 };
      returning = false;
      tap = undefined;
      taps = 0;
      announce();
    },
    moved: () => wasMoved,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach,
  };
};
