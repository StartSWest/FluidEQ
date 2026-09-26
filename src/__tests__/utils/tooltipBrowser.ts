/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The browser the app's tooltips run in (`renderer/utils/tooltipLayer.ts`),
 * as far as jsdom does not provide one.
 *
 * jsdom has no popover, no top layer, no Web Animations, no pointer events
 * and no layout, and cannot tell focus the keyboard moved from focus a click
 * moved. Each is modelled here at that boundary, as Chromium behaves. The
 * layer has no timer: its rest is its entrance animation's own delay and its
 * fade ends on the animation's `finish` event, so this clock, which moves
 * only when a test calls `wait`, is how both are driven.
 *
 * The tooltip is read as a user reads it — its text while it is open and not
 * transparent — and Chromium's own tooltip as the nearest `title` above
 * whatever the pointer is on. Each test file gets a jsdom of its own, so none
 * of this reaches another file.
 */

// The layer's timings: the rest before a tooltip shows, its entrance after
// the rest, and the fade it leaves with.
export const HOLD_MS = 500;
export const ENTER_MS = 140;
export const LEAVE_MS = 150;
export const SHOWN_MS = HOLD_MS + ENTER_MS;

export const VIEW = { width: 1280, height: 800 };
/** One line of tooltip, as its stylesheet lays it out. */
export const TIP = { width: 120, height: 28 };

/** The document timeline, in milliseconds. It moves only in `wait`. */
let now = 0;

/**
 * A Web Animation as the layer uses one: it holds its first frame through its
 * delay under `fill: 'backwards'` and its last after the end under
 * `forwards`, reads `running` and then `finished`, and fires `finish` once,
 * on the frame its end is passed. Easing is not modelled: the tests ask only
 * whether the tooltip can be seen at all, and whether fully.
 */
export class ModelAnimation {
  readonly element: Element;

  readonly keyframes: Keyframe[];

  readonly delay: number;

  private readonly duration: number;

  private readonly fill: FillMode;

  private readonly startTime = now;

  private isCancelled = false;

  private hasFinished = false;

  private readonly finishListeners: EventListenerOrEventListenerObject[] = [];

  constructor(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    this.element = element;
    this.keyframes = keyframes;
    this.delay = options.delay ?? 0;
    this.duration = typeof options.duration === 'number' ? options.duration : 0;
    this.fill = options.fill ?? 'auto';
  }

  get currentTime(): number | null {
    return this.isCancelled ? null : Math.min(now - this.startTime, this.end);
  }

  get playState(): AnimationPlayState {
    if (this.isCancelled) {
      return 'idle';
    }
    return now - this.startTime >= this.end ? 'finished' : 'running';
  }

  private get end(): number {
    return this.delay + this.duration;
  }

  cancel(): void {
    this.isCancelled = true;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === 'finish') {
      this.finishListeners.push(listener);
    }
  }

  /** The frame after the clock moved: `finish`, once, if the end was passed. */
  frame(): void {
    if (this.hasFinished || this.playState !== 'finished') {
      return;
    }
    this.hasFinished = true;
    const event = new Event('finish');
    this.finishListeners.forEach((listener) => {
      if (typeof listener === 'function') {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    });
  }

  /** The opacity this puts on its element now; `undefined` where it has no effect. */
  opacity(): number | undefined {
    if (this.isCancelled) {
      return undefined;
    }
    const local = now - this.startTime;
    const first = Number(this.keyframes[0]?.opacity);
    const last = Number(this.keyframes[this.keyframes.length - 1]?.opacity);
    if (local < this.delay) {
      return this.fill === 'backwards' || this.fill === 'both'
        ? first
        : undefined;
    }
    if (local >= this.end) {
      return this.fill === 'forwards' || this.fill === 'both'
        ? last
        : undefined;
    }
    return first + ((last - first) * (local - this.delay)) / this.duration;
  }
}

const animations: ModelAnimation[] = [];

/** Lets `ms` of the timeline pass, and each animation it finished say so. */
export const wait = (ms: number) => {
  now += ms;
  animations.forEach((animation) => animation.frame());
};

/** How many animations have been started, finished or not. */
export const animationCount = () => animations.length;

/** The newest entrance: the only animation of the layer's that waits. */
export const lastEntrance = (): ModelAnimation | undefined =>
  animations.filter((animation) => animation.delay > 0).pop();

const layer: Element[] = [];
/** Chromium's top layer, bottom first, in the order things were shown in it. */
export const topLayer: readonly Element[] = layer;

/**
 * Whether focus last moved by the keyboard, which is Chromium's
 * `:focus-visible` for everything but a text field — and no test of the
 * tooltips focuses one.
 */
let isKeyboardFocus = false;

const boxes = new Map<Element, DOMRect>();

const rectOf = (
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
});

/** Where `element` is laid out, in the window's pixels. */
export const layOut = (
  element: Element,
  left: number,
  top: number,
  width: number,
  height: number,
) => {
  boxes.set(element, rectOf(left, top, width, height));
};

const nativeMatches = Element.prototype.matches;

const modelTheBrowser = () => {
  Object.defineProperty(HTMLElement.prototype, 'popover', {
    configurable: true,
    get(this: HTMLElement): string | null {
      return this.getAttribute('popover');
    },
    set(this: HTMLElement, value: string | null) {
      if (value === null) {
        this.removeAttribute('popover');
      } else {
        this.setAttribute('popover', value);
      }
    },
  });
  // As the specification checks a popover: not one at all is refused,
  // showing a shown one or hiding a hidden one does nothing, and one outside
  // the document cannot be shown.
  Object.defineProperty(HTMLElement.prototype, 'showPopover', {
    configurable: true,
    writable: true,
    value(this: HTMLElement) {
      if (!this.hasAttribute('popover')) {
        throw new DOMException('Not a popover.', 'NotSupportedError');
      }
      if (layer.includes(this)) {
        return;
      }
      if (!this.isConnected) {
        throw new DOMException('Not in the document.', 'InvalidStateError');
      }
      layer.push(this);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
    configurable: true,
    writable: true,
    value(this: HTMLElement) {
      const index = layer.indexOf(this);
      if (index >= 0) {
        layer.splice(index, 1);
      }
    },
  });
  // The two selectors jsdom cannot answer: it throws on the first, and
  // takes every focus for the keyboard's on the second.
  Object.defineProperty(Element.prototype, 'matches', {
    configurable: true,
    writable: true,
    value(this: Element, selectors: string): boolean {
      if (selectors === ':popover-open') {
        return layer.includes(this);
      }
      if (selectors === ':focus-visible') {
        return isKeyboardFocus && document.activeElement === this;
      }
      return nativeMatches.call(this, selectors);
    },
  });
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value(
      this: Element,
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ) {
      const animation = new ModelAnimation(
        this,
        Array.isArray(keyframes) ? keyframes : [],
        typeof options === 'number' ? { duration: options } : (options ?? {}),
      );
      animations.push(animation);
      return animation;
    },
  });
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    writable: true,
    value(this: Element): DOMRect {
      if (this.classList.contains('app-tooltip')) {
        return rectOf(0, 0, TIP.width, TIP.height);
      }
      return boxes.get(this) ?? rectOf(0, 0, 0, 0);
    },
  });
  Object.defineProperties(document.documentElement, {
    clientWidth: { configurable: true, get: () => VIEW.width },
    clientHeight: { configurable: true, get: () => VIEW.height },
  });
};

type TPoint = { x: number; y: number };

/** What the pointer is on, as the browser tracks it for its boundary events. */
let under: Element | null = null;

export const pointerEvent = (
  type: string,
  init: MouseEventInit = {},
  pointerType = 'mouse',
): MouseEvent => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
};

/** `event` arriving at whatever the pointer is on. */
export const atPointer = (event: Event) => {
  under?.dispatchEvent(event);
};

/**
 * The pointer moving onto `element`, reported as the browser reports it:
 * `pointerout` on what it leaves and `pointerover` on what it reaches, each
 * naming the other. Moving about inside one element fires neither, and an
 * element taken out of the page hears nothing.
 */
export const moveTo = (
  element: Element | null,
  at: TPoint = { x: 10, y: 10 },
  pointerType = 'mouse',
) => {
  const from = under;
  if (from === element) {
    return;
  }
  const position = { clientX: at.x, clientY: at.y };
  if (from?.isConnected) {
    from.dispatchEvent(
      pointerEvent(
        'pointerout',
        { ...position, relatedTarget: element },
        pointerType,
      ),
    );
  }
  under = element;
  element?.dispatchEvent(
    pointerEvent(
      'pointerover',
      { ...position, relatedTarget: from },
      pointerType,
    ),
  );
};

/** Out of the window altogether: a `pointerout` naming nowhere it went. */
export const leaveWindow = () => moveTo(null);

/** A press where the pointer is: down, focus to what takes it, up, click. */
export const pressPointer = () => {
  const target = under;
  if (!(target instanceof HTMLElement)) {
    throw new Error('The pointer is on nothing that can be pressed.');
  }
  target.dispatchEvent(pointerEvent('pointerdown'));
  isKeyboardFocus = false;
  target.focus();
  target.dispatchEvent(pointerEvent('pointerup'));
  target.click();
};

/** A key going down where focus is. */
export const pressKey = (key: string) => {
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
  isKeyboardFocus = true;
};

/** Tab arriving at `element`: the key goes down where focus was, then focus moves. */
export const tabTo = (element: HTMLElement) => {
  pressKey('Tab');
  element.focus();
};

/** Mutation observers are told in a microtask, never during the write. */
export const observersHear = () => Promise.resolve();

export const tooltip = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.app-tooltip');

export const isOpen = (): boolean => {
  const tip = tooltip();
  return tip !== null && layer.includes(tip);
};

/** The opacity the tooltip is drawn at: none while it is closed. */
export const drawnOpacity = (): number => {
  const tip = tooltip();
  if (!tip || !layer.includes(tip)) {
    return 0;
  }
  const effects = animations
    .filter((animation) => animation.element === tip)
    .map((animation) => animation.opacity())
    .filter((opacity): opacity is number => opacity !== undefined);
  return effects.length > 0 ? effects[effects.length - 1] : 1;
};

/** The tooltip as a user reads it: its text while it is drawn at all. */
export const seen = (): string | undefined => {
  const tip = tooltip();
  return tip && drawnOpacity() > 0 ? (tip.textContent ?? '') : undefined;
};

/**
 * What Chromium's own tooltip would read for the element under the pointer:
 * the nearest title above it, where an empty one reads as nothing.
 */
export const systemTooltip = (): string => {
  for (let node: Element | null = under; node; node = node.parentElement) {
    if (node instanceof HTMLElement && node.hasAttribute('title')) {
      return node.getAttribute('title') ?? '';
    }
  }
  return '';
};

let page: HTMLElement | undefined;

/** Puts `html` in the page, in place of what the test put there before. */
export const build = (html: string) => {
  if (!page) {
    throw new Error('The page is built between setUpTooltipBrowser hooks.');
  }
  page.innerHTML = html;
};

export const find = <T extends Element = HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) {
    throw new Error(`Nothing in the page matches ${selector}.`);
  }
  return found;
};

/**
 * Models the browser, installs the layer once for the file as `index.tsx`
 * does for the window, and leaves the pointer, focus, clock and top layer as
 * they were found after every test.
 */
export const setUpTooltipBrowser = (installLayer: () => void) => {
  beforeAll(() => {
    modelTheBrowser();
    installLayer();
  });

  beforeEach(() => {
    page = document.createElement('main');
    document.body.append(page);
  });

  afterEach(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    leaveWindow();
    window.dispatchEvent(new Event('blur'));
    isKeyboardFocus = false;
    under = null;
    page?.remove();
    page = undefined;
    document.documentElement.removeAttribute('data-motion');
    wait(SHOWN_MS);
    animations.length = 0;
    boxes.clear();
    // A popover taken out of the page leaves the top layer with it.
    layer.splice(
      0,
      layer.length,
      ...layer.filter((element) => element.isConnected),
    );
  });
};
