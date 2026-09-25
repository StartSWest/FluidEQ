/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { prefersReducedMotion } from './bandReveal';
import '../styles/Tooltip.scss';

/**
 * The app's own tooltips, drawn in place of the system's.
 *
 * Every tooltip in the window is still written as a `title` — four hundred of
 * them, and a screen reader and the tests read the text there — and this
 * layer is what shows it (Ivan, 2026-09-25: "custom nice tooltips instead of
 * system one"). Chromium draws its own tooltip for any element under the
 * pointer that carries a title, and nothing but the attribute's absence
 * stops it, so the element being hovered LENDS its title to the layer: the
 * text is taken off while the pointer is on it and put back when it leaves.
 * Every titled ancestor is lent as well, because an inner element's empty
 * title is not something every engine lets stop an outer one's.
 *
 * React still owns the attribute. It may rewrite it while the pointer is
 * there — a play button that becomes pause — or take it away, and taking
 * away an attribute that is already gone is not a change anything can hear:
 * the title would be put back on the way out over a React that had removed
 * it. So a lent title is left as an EMPTY title rather than removed. An empty
 * title shows nothing, and React writing another one or removing it is a
 * mutation the layer is told about, while its own writes are discarded as it
 * makes them (`takeRecords`).
 *
 * One element for the whole window, in the top layer, so the Help guide's
 * modal dialog cannot cover it. Installed from `index.tsx`, beside the other
 * window-wide listeners, and never in the tests: they read titles as the page
 * wrote them.
 */

// How long the pointer rests on something before its tooltip appears — the
// wait the Gallery's loading ring holds for. Sweeping across a toolbar shows
// nothing; resting on a button reads as asking. It is the entrance's own
// delay, an animation on the tooltip that no code waits on, and it is kept
// with Animations off: the wait is the point there, not the motion.
const HOLD_MS = 500;
const ENTER_MS = 140;
// A tooltip leaving fades over this long, and while it is still on screen the
// next one takes its place at once — moving along a row of buttons reads each
// of them without the wait again at every one.
const LEAVE_MS = 150;
// `$ease-out` in `_motion.scss`.
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GAP_PX = 6;
const EDGE_PX = 8;
// Anything bigger than this — a list row, a canvas, a plot — is described
// where the pointer came onto it, a cursor's height below it, rather than
// under its middle, which could be half a window away.
const ANCHOR_MAX_WIDTH_PX = 240;
const ANCHOR_MAX_HEIGHT_PX = 64;
const CURSOR_CLEARANCE_PX = 20;
// A title is the accessible name of a button with nothing else to go by —
// the icon buttons — and a lent one would leave it nameless for as long as
// the pointer is on it. Only those borrow the text as a label meanwhile; a
// field has its label, a row its own words.
const NAMED_BY_TITLE = 'button, [role="button"], a[href]';
// Their titles are not tooltips.
const NOT_TOOLTIPS = 'iframe, webview';

type TPoint = { x: number; y: number };

// An SVG shape takes no `title` attribute — its tooltip is a <title> child,
// which is the system's and cannot be lent — so it asks for this one with
// `data-tooltip` instead. No browser draws anything for that, so it is read
// as written and never lent.
const SOURCES = '[title], [data-tooltip]';

/** A tooltip's text held by the layer while the pointer is on its element. */
type TLoan = {
  element: Element;
  /** The text as the page last wrote it; empty is none. */
  text: string;
  /** A `title`, taken off the element; otherwise a `data-tooltip`, left be. */
  isLent: boolean;
  /** The page took the attribute away while it was lent. */
  isWithdrawn: boolean;
  /** The accessible name lent along with it, while the layer still owns it. */
  label?: string;
};

/** Innermost first: the first with text is the one described. */
let loans: TLoan[] = [];
let pointer: TPoint = { x: 0, y: 0 };
/** Pressed, scrolled or typed over: stays hidden until the pointer leaves. */
let isDismissed = false;

let tip: HTMLDivElement | undefined;
let entrance: Animation | undefined;
let entranceDelay = 0;
let exit: Animation | undefined;
/** What the tooltip on screen describes, and whether it came by keyboard. */
let shown: { element: Element; byFocus: boolean } | undefined;

const tooltip = (): HTMLDivElement => {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'app-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.popover = 'manual';
    document.body.append(tip);
  }
  return tip;
};

const isOpen = () => tip?.matches(':popover-open') === true;

/** Whether a tooltip can be seen right now, fading out included. */
const isSeen = (): boolean => {
  if (!isOpen()) {
    return false;
  }
  if (exit) {
    return exit.playState === 'running';
  }
  if (!entrance || entrance.playState === 'finished') {
    return true;
  }
  const time = entrance.currentTime;
  return typeof time === 'number' && time >= entranceDelay;
};

const place = (element: Element, point: TPoint | undefined) => {
  const box = tooltip();
  const anchor = element.getBoundingClientRect();
  const { width, height } = box.getBoundingClientRect();
  const viewWidth = document.documentElement.clientWidth;
  const viewHeight = document.documentElement.clientHeight;
  const atPointer =
    point !== undefined &&
    (anchor.width > ANCHOR_MAX_WIDTH_PX ||
      anchor.height > ANCHOR_MAX_HEIGHT_PX);
  const centre = atPointer ? point.x : anchor.left + anchor.width / 2;
  const below = atPointer
    ? point.y + CURSOR_CLEARANCE_PX
    : anchor.bottom + GAP_PX;
  const above = (atPointer ? point.y : anchor.top) - GAP_PX - height;
  const isBelow = below + height <= viewHeight - EDGE_PX || above < EDGE_PX;
  const top = Math.min(
    Math.max(isBelow ? below : above, EDGE_PX),
    viewHeight - EDGE_PX - height,
  );
  const left = Math.min(
    Math.max(centre - width / 2, EDGE_PX),
    viewWidth - EDGE_PX - width,
  );
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(top)}px`;
  return isBelow;
};

const show = (
  element: Element,
  text: string,
  point: TPoint | undefined,
  byFocus: boolean,
) => {
  const box = tooltip();
  const isWarm = isSeen();
  exit?.cancel();
  exit = undefined;
  entrance?.cancel();
  entrance = undefined;
  if (!isWarm && isOpen()) {
    // Shown again, so it is the newest thing in the top layer: a dialog
    // opened since would otherwise stand over it.
    box.hidePopover();
  }
  if (!isOpen()) {
    box.showPopover();
  }
  box.textContent = text;
  const isBelow = place(element, point);
  shown = { element, byFocus };
  if (isWarm) {
    return;
  }
  const isStill = prefersReducedMotion();
  entranceDelay = HOLD_MS;
  entrance = box.animate(
    isStill
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          {
            opacity: 0,
            transform: `translateY(${isBelow ? -3 : 3}px) scale(0.98)`,
          },
          { opacity: 1, transform: 'none' },
        ],
    {
      duration: isStill ? 1 : ENTER_MS,
      delay: HOLD_MS,
      easing: EASE_OUT,
      fill: 'backwards',
    },
  );
};

const hide = (isFading: boolean) => {
  shown = undefined;
  if (!isOpen()) {
    return;
  }
  const box = tooltip();
  const wasSeen = isSeen();
  entrance?.cancel();
  entrance = undefined;
  if (!isFading || !wasSeen || prefersReducedMotion()) {
    exit?.cancel();
    exit = undefined;
    box.hidePopover();
    return;
  }
  if (exit) {
    return;
  }
  const leaving = box.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: LEAVE_MS,
    easing: 'ease-out',
    fill: 'forwards',
  });
  exit = leaving;
  // Another tooltip taking this one's place cancels the fade, which does not
  // finish it.
  leaving.addEventListener('finish', () => {
    if (exit !== leaving) {
      return;
    }
    exit = undefined;
    leaving.cancel();
    box.hidePopover();
  });
};

/** The loan the tooltip describes: the innermost that still has text. */
const described = () => loans.find((loan) => loan.text !== '');

/** Shows, moves or hides the pointer's tooltip to match the loans. */
const present = () => {
  if (shown?.byFocus) {
    return;
  }
  const loan = described();
  if (!loan || isDismissed) {
    hide(true);
    return;
  }
  if (shown?.element === loan.element && tip?.textContent === loan.text) {
    return;
  }
  if (shown?.element === loan.element) {
    tooltip().textContent = loan.text;
    place(loan.element, pointer);
    return;
  }
  show(loan.element, loan.text, pointer, false);
};

const lending = new MutationObserver((records) => onLoanMutations(records));

/** A write of the layer's own, which its observer must not report back. */
const ownWrite = (write: () => void) => {
  onLoanMutations(lending.takeRecords());
  write();
  lending.takeRecords();
};

const lendLabel = (loan: TLoan) => {
  const { element, text } = loan;
  if (loan.label !== undefined) {
    if (element.getAttribute('aria-label') !== loan.label) {
      loan.label = undefined;
      return;
    }
    if (text === '') {
      element.removeAttribute('aria-label');
      loan.label = undefined;
    } else if (text !== loan.label) {
      element.setAttribute('aria-label', text);
      loan.label = text;
    }
    return;
  }
  if (
    text !== '' &&
    element.matches(NAMED_BY_TITLE) &&
    !element.hasAttribute('aria-label') &&
    !element.hasAttribute('aria-labelledby') &&
    (element.textContent ?? '').trim() === ''
  ) {
    element.setAttribute('aria-label', text);
    loan.label = text;
  }
};

function onLoanMutations(records: MutationRecord[]) {
  let changed = false;
  records.forEach((record) => {
    const loan = loans.find((each) => each.element === record.target);
    if (!loan) {
      return;
    }
    if (record.attributeName === 'aria-label') {
      // The page named it itself; the name is its own from here on.
      loan.label = undefined;
      return;
    }
    if (!loan.isLent) {
      if (record.attributeName === 'data-tooltip') {
        loan.text = loan.element.getAttribute('data-tooltip') ?? '';
        changed = true;
      }
      return;
    }
    if (record.attributeName !== 'title') {
      return;
    }
    const value = loan.element.getAttribute('title');
    loan.isWithdrawn = value === null;
    loan.text = value ?? '';
    if (value) {
      ownWrite(() => {
        loan.element.setAttribute('title', '');
        lendLabel(loan);
      });
    } else if (loan.label !== undefined) {
      ownWrite(() => lendLabel(loan));
    }
    changed = true;
  });
  if (changed) {
    present();
  }
}

// An element taken out of the page while the pointer rests on it hears no
// pointer leaving it; its tooltip would stay over whatever took its place.
const presence = new MutationObserver(() => {
  if (loans.length > 0 && !loans[0].element.isConnected) {
    returnLoans();
  }
});

function returnLoans() {
  if (loans.length === 0) {
    return;
  }
  onLoanMutations(lending.takeRecords());
  lending.disconnect();
  presence.disconnect();
  loans.forEach(({ element, text, isLent, isWithdrawn, label }) => {
    if (
      isLent &&
      !isWithdrawn &&
      text !== '' &&
      element.getAttribute('title') === ''
    ) {
      element.setAttribute('title', text);
    }
    if (label !== undefined && element.getAttribute('aria-label') === label) {
      element.removeAttribute('aria-label');
    }
  });
  loans = [];
  isDismissed = false;
  if (!shown?.byFocus) {
    hide(true);
  }
}

const textOf = (element: Element) =>
  element.getAttribute('title') ?? element.getAttribute('data-tooltip') ?? '';

/** What the pointer on `from` is told about, innermost first. */
const describedChain = (from: Element): Element[] => {
  const chain: Element[] = [];
  let element: Element | null = from.closest(SOURCES);
  while (element) {
    if (element.matches(NOT_TOOLTIPS)) {
      return [];
    }
    if (textOf(element)) {
      chain.push(element);
    } else if (chain.length === 0) {
      // An empty title is the page saying "nothing here", as it is for the
      // browser; what is outside it is not this element's to describe.
      return [];
    }
    element = element.parentElement?.closest(SOURCES) ?? null;
  }
  return chain;
};

const lend = (chain: Element[]) => {
  loans = chain.map((element) => {
    const isLent = element.hasAttribute('title');
    const loan: TLoan = {
      element,
      text: textOf(element),
      isLent,
      isWithdrawn: false,
    };
    if (isLent) {
      element.setAttribute('title', '');
      lendLabel(loan);
    }
    return loan;
  });
  loans.forEach(({ element }) =>
    lending.observe(element, {
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'data-tooltip'],
    }),
  );
  presence.observe(document.body, { childList: true, subtree: true });
  present();
};

const onPointerOver = (event: PointerEvent) => {
  if (event.pointerType === 'touch' || !(event.target instanceof Element)) {
    returnLoans();
    return;
  }
  pointer = { x: event.clientX, y: event.clientY };
  // Still on what is lent, or on something inside it with nothing of its own
  // to say: nothing changes. Its own title reads empty while it is lent, so
  // this is asked before anything is looked up by text.
  if (loans.length > 0 && event.target.closest(SOURCES) === loans[0].element) {
    return;
  }
  // Put back first, so the new chain is read from the titles the page wrote.
  returnLoans();
  const chain = describedChain(event.target);
  if (chain.length > 0) {
    // The pointer arriving somewhere new is the newer question than the
    // control Tab left focused.
    if (shown?.byFocus) {
      hide(true);
    }
    lend(chain);
  }
};

const onPointerOut = (event: PointerEvent) => {
  // Out of the window altogether: nothing else will be hovered to say so.
  if (event.relatedTarget === null) {
    returnLoans();
  }
};

/** Hidden until the pointer moves onto something else. */
const dismiss = () => {
  if (loans.length > 0) {
    isDismissed = true;
  }
  hide(false);
};

const onScroll = (event: Event) => {
  const scrolled = event.target;
  const on = shown?.element;
  if (
    on &&
    (scrolled === document ||
      (scrolled instanceof Node && scrolled.contains(on)))
  ) {
    dismiss();
  }
};

// The keyboard's equivalent of resting the pointer on something: a control
// reached with Tab shows what the pointer would have been told.
const onFocusIn = (event: FocusEvent) => {
  const { target } = event;
  if (!(target instanceof Element) || !target.matches(':focus-visible')) {
    return;
  }
  const lent = loans.find((loan) => loan.element === target);
  const text = lent ? lent.text : textOf(target);
  if (!text || target.matches(NOT_TOOLTIPS)) {
    return;
  }
  // The pointer's own loans stay lent while it rests there, or the system's
  // tooltip would come back for them.
  if (loans.length > 0) {
    isDismissed = true;
  }
  show(target, text, undefined, true);
};

const onFocusOut = (event: FocusEvent) => {
  if (shown?.byFocus && shown.element === event.target) {
    hide(true);
  }
};

const installTooltipLayer = () => {
  document.addEventListener('pointerover', onPointerOver, true);
  document.addEventListener('pointerout', onPointerOut, true);
  document.addEventListener('pointerdown', dismiss, true);
  document.addEventListener('pointercancel', dismiss, true);
  document.addEventListener('keydown', dismiss, true);
  document.addEventListener('wheel', dismiss, { capture: true, passive: true });
  document.addEventListener('scroll', onScroll, {
    capture: true,
    passive: true,
  });
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  window.addEventListener('blur', dismiss);
  window.addEventListener('resize', dismiss);
};

export default installTooltipLayer;
