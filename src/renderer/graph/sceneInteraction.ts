import {
  codeOfCameraKey,
  type ISceneCameraControl,
} from 'common/sceneCameraControl';
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
import { HOME_CAMERA, NO_POINTER, NO_TAP } from './sceneFrameRest';

/**
 * The viewer's hands on a scene: where the pointer is, a tap, and the camera
 * a 3D scene lets them turn (`common/sceneCamera.ts`). One of these per
 * surface a scene is drawn on; the runner reads it every frame
 * (`useSceneRunner.ts`) and hands the scene `uPointer`, `uTap` and `uCamera`.
 *
 * The gestures are the app's, the same in every scene and on every surface:
 * the camera's key - Ctrl (⌘ on a Mac) unless the viewer chose another
 * (`common/sceneCameraControl.ts`) - and a drag to turn and tilt (the scene
 * follows the hand, as a thing picked up and turned does), or that key and
 * the mouse moving alone where they chose that; the key and the wheel - or a
 * touchpad's pinch, which arrives as Ctrl and the wheel - to move in and out,
 * all held inside the angles the scene's author allows. A plain press, click,
 * double click or wheel is never the camera's (Ivan, 2026-11-08: "cannot move
 * just with mouse move only when control click so double click goes full
 * screen too", "same for zoom with control scroll"): a plain drag turned the
 * scene on the Studio's stage and in the gallery, the graph's right and
 * middle drags did too, and a double click meant to take the picture full
 * screen began a turn instead. Holding the key over a scene that can be
 * turned shows the open hand.
 *
 * Over a scene that can be turned the camera's key is the camera's: a key
 * other than the three modifiers goes no further into the window there, and
 * Alt does not reach the window's menu. Everywhere else, and in a field being
 * typed in, it is what it always was. The key is the app's alone: a scene is
 * handed its pointer and its camera, never a key or whether one is held.
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
   * What the panel keeps for itself - a band's handle, say: a press there is
   * never the scene's, neither a turn nor a tap, and neither is a wheel.
   * Buttons, fields, links and menus are always the panel's.
   */
  owns?: (target: Element) => boolean;
}

/**
 * What the viewer's hand did, where on the page (client pixels), for what
 * draws at the hand (`ScenePointerLayer`, which places it on its own box): a
 * move with how far it went, or a tap.
 */
export type TSceneGesture =
  | { kind: 'move'; x: number; y: number; dx: number; dy: number }
  | { kind: 'tap'; x: number; y: number };

/** Something that tells of gestures, and the way to stop it telling. */
export type TGestureSource = (
  listener: (gesture: TSceneGesture) => void,
) => () => void;

export interface ISceneInteraction {
  read(elapsedMs: number): ISceneHands;
  /** Told of every move and tap over an attached surface. */
  onGesture(listener: (gesture: TSceneGesture) => void): () => void;
  setLimits(limits: ISceneCameraLimits | undefined): void;
  /** Back to the author's view, gliding. */
  reset(): void;
  /** At the author's view at once, and no tap: a different scene begins. */
  home(): void;
  /** The camera is somewhere other than the author's view. */
  moved(): boolean;
  /** The scene on it can be turned: its camera's key does something here. */
  turns(): boolean;
  /**
   * The camera's key is held with the pointer over a surface this is on:
   * what brings the Reset view button (`SceneViewReset`).
   */
  keyHeldOver(): boolean;
  /** Told when `moved()`, `turns()` or `keyHeldOver()` may have changed. */
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

/** Typed into, where a key is a letter and never the camera's. */
const isTypedInto = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    Boolean(target.closest('input, textarea, select')));

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

/**
 * `control` is how the camera is moved, asked on every gesture so a change
 * holds from the next one: the window's choice (`sceneCameraControlStore`),
 * or on the desktop the choice main hands its page.
 */
export const createSceneInteraction = (
  control: () => ISceneCameraControl,
): ISceneInteraction => {
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
  const gestureListeners = new Set<(gesture: TSceneGesture) => void>();
  const tell = (gesture: TSceneGesture) =>
    gestureListeners.forEach((listener) => listener(gesture));
  /** Every element the gestures are on, and whether the pointer is over it. */
  const attached = new Map<HTMLElement, { hovered: boolean }>();
  /** The camera's key held, as the last pointer event or key said. */
  let cameraKeyHeld = false;
  /**
   * A camera key that is not a modifier, held as its own key down and up
   * said: a pointer event carries only the modifiers.
   */
  let plainKeyHeld = false;
  /**
   * The Ctrl key itself is down, as its own key down and up said: a
   * touchpad's pinch arrives as a wheel with \`ctrlKey\` set and no Ctrl
   * pressed, which is how it is told from Ctrl and the wheel.
   */
  let ctrlPressed = false;
  /**
   * Turning by the key and the mouse moving alone (`move`): since the first
   * move with the key held, and when the last move was, for the speed handed
   * on when the key is let go.
   */
  let movingTurn = false;
  let movedTurnAt = 0;

  /** The camera's key is down, as `event` and the keys before it tell. */
  const heldIn = (event: MouseEvent | KeyboardEvent) => {
    const { key } = control();
    if (key === 'ctrl') {
      return event.ctrlKey || event.metaKey;
    }
    if (key === 'alt') {
      return event.altKey;
    }
    if (key === 'shift') {
      return event.shiftKey;
    }
    return plainKeyHeld;
  };

  const announce = () => {
    const now = !isHome(camera);
    if (now !== wasMoved) {
      wasMoved = now;
      listeners.forEach((listener) => listener());
    }
  };

  const turning = () =>
    movingTurn || [...presses.values()].some((press) => press.turning);

  /**
   * The key let go after turning by moving alone: the camera glides on with
   * the hand's speed, as after a drag, unless the hand had stopped first.
   */
  const endMovingTurn = (at: number) => {
    if (!movingTurn) {
      return;
    }
    movingTurn = false;
    if (
      prefersReducedMotion() ||
      at - movedTurnAt > STOPPED_BEFORE_RELEASE_MS
    ) {
      glide = { yaw: 0, pitch: 0 };
    }
  };

  /**
   * The cursor over each element: an open hand while Ctrl is held over a
   * scene that can be turned — what a press would do then — and a closed one
   * while it is being turned. Written only when it changes, as a data
   * attribute the stylesheet reads.
   */
  /** `keyHeldOver()` as subscribers were last told it. */
  let toldKeyHeldOver = false;
  const keyHeldOver = () =>
    cameraKeyHeld && [...attached.values()].some(({ hovered }) => hovered);

  const showHands = () => {
    if (keyHeldOver() !== toldKeyHeldOver) {
      toldKeyHeldOver = !toldKeyHeldOver;
      listeners.forEach((listener) => listener());
    }
    attached.forEach(({ hovered }, element) => {
      let hand: THand = '';
      if (limits) {
        if (turning()) {
          hand = 'grabbing';
        } else if (hovered && cameraKeyHeld) {
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

  /** Back to the author's view, gliding. */
  const reset = () => {
    glide = { yaw: 0, pitch: 0 };
    returning = !isHome(camera);
  };

  const setLimits = (next: ISceneCameraLimits | undefined) => {
    // Asked every frame with the pack's own object: the same object is the
    // same limits, and only a new version of the scene is worth comparing.
    if (next === limits || JSON.stringify(next) === JSON.stringify(limits)) {
      limits = next;
      return;
    }
    const turnedBefore = Boolean(limits);
    limits = next;
    if (Boolean(next) !== turnedBefore) {
      listeners.forEach((listener) => listener());
    }
    camera = next
      ? clampSceneCamera(camera, next)
      : { ...DEFAULT_SCENE_CAMERA };
    glide = { yaw: 0, pitch: 0 };
    announce();
  };

  const attach = (element: HTMLElement, options: IAttachOptions) => {
    const entry = { hovered: false };
    /**
     * The camera's key going down or up: over a still pointer it opens or
     * closes the hand, let go it ends a turn made by moving alone, and over a
     * scene that can be turned its own press is the scene's.
     */
    const onKey = (event: KeyboardEvent) => {
      const { key } = control();
      const code = codeOfCameraKey(key);
      const typing = isTypedInto(event.target);
      const isTheKey =
        code === undefined
          ? key === 'alt' && event.key === 'Alt'
          : event.code === code;
      if (code !== undefined && isTheKey && !typing) {
        plainKeyHeld = event.type === 'keydown';
      }
      if (event.key === 'Control') {
        ctrlPressed = event.type === 'keydown';
      }
      if (isTheKey && !typing && limits && entry.hovered) {
        event.preventDefault();
        event.stopPropagation();
      }
      const held = heldIn(event);
      if (held !== cameraKeyHeld) {
        cameraKeyHeld = held;
        if (!held) {
          endMovingTurn(event.timeStamp);
        }
        showHands();
      }
    };
    const onBlur = () => {
      cameraKeyHeld = false;
      plainKeyHeld = false;
      ctrlPressed = false;
      endMovingTurn(performance.now());
      showHands();
    };
    /** The swallow waiting after a turning drag, taken back by the next press. */
    let swallowing: (() => void) | undefined;
    const stopSwallowing = () => {
      swallowing?.();
      swallowing = undefined;
    };
    /**
     * The click (or menu) a release of `button` is followed by, taken before
     * the panel hears it: a turned drag or a reset is not a click.
     */
    const swallowAfter = (button: number) => {
      const types = eventsAfter(button);
      const swallow = (click: Event) => {
        click.stopPropagation();
        click.preventDefault();
        element.removeEventListener(click.type, swallow, { capture: true });
      };
      types.forEach((type) =>
        element.addEventListener(type, swallow, { capture: true }),
      );
      swallowing = () =>
        types.forEach((type) =>
          element.removeEventListener(type, swallow, { capture: true }),
        );
    };
    /** Where the mouse was last over this element: how far each move went. */
    let lastMove: { x: number; y: number } | undefined;
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
      const last = lastMove;
      lastMove = { x: event.clientX, y: event.clientY };
      if (!entry.hovered || heldIn(event) !== cameraKeyHeld) {
        entry.hovered = true;
        cameraKeyHeld = heldIn(event);
        if (!cameraKeyHeld) {
          endMovingTurn(event.timeStamp);
        }
        showHands();
      }
      if (uv) {
        pointerX = uv.x;
        pointerY = uv.y;
        over = true;
        stirred = true;
        if (last && !owned(event.target)) {
          tell({
            kind: 'move',
            x: event.clientX,
            y: event.clientY,
            dx: event.clientX - last.x,
            dy: event.clientY - last.y,
          });
        }
      }
      // The key and the mouse moving alone, where that is the viewer's way:
      // only with no press under way, which turns (or is the panel's) by
      // itself.
      if (
        control().move === 'move' &&
        cameraKeyHeld &&
        limits &&
        uv &&
        last &&
        presses.size === 0 &&
        !owned(event.target)
      ) {
        const dt = Math.max(1, event.timeStamp - movedTurnAt);
        const before = camera;
        camera = dragSceneCamera(
          camera,
          event.clientX - last.x,
          event.clientY - last.y,
          uv.height,
          limits,
        );
        // The first move of a hold has no speed of its own yet.
        glide = movingTurn
          ? {
              yaw: angleTowards(before.yaw, camera.yaw) / dt,
              pitch: (camera.pitch - before.pitch) / dt,
            }
          : { yaw: 0, pitch: 0 };
        movingTurn = true;
        movedTurnAt = event.timeStamp;
        returning = false;
        showHands();
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
      // The camera's key and the primary button, and nothing else: a plain
      // press, click or double click goes on to the panel untouched - the
      // graph's marquee, its double click to full screen, the stage's double
      // click. Where moving alone turns, a press with the key held is the
      // scene's too, or the graph's marquee would start under the turn.
      const turnsNow = Boolean(limits) && event.button === 0 && heldIn(event);
      endMovingTurn(event.timeStamp);
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
        tell({ kind: 'tap', x: event.clientX, y: event.clientY });
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
          swallowAfter(press.button);
        }
      }
    };

    const onLeave = (event: PointerEvent) => {
      over = false;
      lastMove = undefined;
      entry.hovered = false;
      endMovingTurn(event.timeStamp);
      showHands();
    };

    const onWheel = (event: WheelEvent) => {
      if (
        !limits ||
        limits.zoom[1] - limits.zoom[0] < 1e-3 ||
        owned(event.target)
      ) {
        return;
      }
      // The camera's key and the wheel - and a touchpad's pinch, whatever the
      // key - the zoom, wherever the scene can be turned at all (a band's own
      // Ctrl and wheel is its Q, and a band is owned). The plain wheel is
      // never the scene's - it scrolls the page or the panel it crosses.
      const pinch = event.ctrlKey && !ctrlPressed;
      if (!heldIn(event) && !pinch) {
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
    const win = element.ownerDocument.defaultView;
    // Captured at the window: the key over a scene is the scene's before any
    // shortcut of the window's hears it.
    win?.addEventListener('keydown', onKey, { capture: true });
    win?.addEventListener('keyup', onKey, { capture: true });
    win?.addEventListener('blur', onBlur);
    attached.set(element, entry);
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
      win?.removeEventListener('keydown', onKey, { capture: true });
      win?.removeEventListener('keyup', onKey, { capture: true });
      win?.removeEventListener('blur', onBlur);
      presses.clear();
      over = false;
      pressedNow = false;
    };
  };

  return {
    read,
    onGesture: (listener) => {
      gestureListeners.add(listener);
      return () => {
        gestureListeners.delete(listener);
      };
    },
    setLimits,
    reset,
    home: () => {
      camera = { ...DEFAULT_SCENE_CAMERA };
      glide = { yaw: 0, pitch: 0 };
      returning = false;
      tap = undefined;
      taps = 0;
      announce();
    },
    moved: () => wasMoved,
    turns: () => Boolean(limits),
    keyHeldOver,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach,
  };
};
