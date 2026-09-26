/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  hideTooltip,
  retextTooltip,
  showTooltip,
  shownTooltip,
  tooltipText,
  type TPoint,
} from './tooltipPopover';

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
 * The tooltip itself — the one element that shows it, where it stands and
 * how it comes and goes — is `tooltipPopover.ts`'s. Installed from
 * `index.tsx`, beside the other window-wide listeners, and never in the
 * tests: they read titles as the page wrote them.
 */

// A title is the accessible name of a button with nothing else to go by —
// the icon buttons — and a lent one would leave it nameless for as long as
// the pointer is on it. Only those borrow the text as a label meanwhile; a
// field has its label, a row its own words.
const NAMED_BY_TITLE = 'button, [role="button"], a[href]';
// Their titles are not tooltips.
const NOT_TOOLTIPS = 'iframe, webview';

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

/** The loan the tooltip describes: the innermost that still has text. */
const described = () => loans.find((loan) => loan.text !== '');

/** Shows, moves or hides the pointer's tooltip to match the loans. */
const present = () => {
  const shown = shownTooltip();
  if (shown?.byFocus) {
    return;
  }
  const loan = described();
  if (!loan || isDismissed) {
    hideTooltip(true);
    return;
  }
  if (shown?.element === loan.element && tooltipText() === loan.text) {
    return;
  }
  if (shown?.element === loan.element) {
    retextTooltip(loan.element, loan.text, pointer);
    return;
  }
  showTooltip(loan.element, loan.text, pointer, false);
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
  if (!shownTooltip()?.byFocus) {
    hideTooltip(true);
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

/**
 * What the pointer rests on, and the way up from it watched for a tooltip
 * arriving there.
 *
 * What is lent is decided as the pointer arrives. A title written after that,
 * with the pointer already resting, was heard by nothing, and the system's
 * tooltip read it on the next move of the mouse inside — the Gallery card's
 * Add button, titled Remove once it has been pressed, showed "Remove" in
 * Windows' own box. A `title` or `data-tooltip` appearing anywhere on the way
 * up is read now as the pointer arriving would read it. What the layer writes
 * lands on what it has lent, which reads empty or is its own loan, so none of
 * it is anything arriving.
 */
let resting: Element | undefined;

const onArrivals = (records: MutationRecord[]) => {
  const on = resting;
  const hasArrived = records.some(
    ({ target }) =>
      target instanceof Element &&
      textOf(target) !== '' &&
      !loans.some((loan) => loan.element === target),
  );
  if (!on?.isConnected || !hasArrived) {
    return;
  }
  const chain = describedChain(on);
  if (chain.length === 0) {
    return;
  }
  // Read again from the titles the page wrote; a press that brought the title
  // still keeps it away until the pointer moves on.
  const wasDismissed = isDismissed;
  returnLoans();
  isDismissed = wasDismissed;
  lend(chain);
};

const arrivals = new MutationObserver(onArrivals);

const restOn = (element: Element | undefined) => {
  // Disconnecting drops what is queued: the loans just put back for the last
  // place the pointer rested are not arrivals at the next.
  arrivals.disconnect();
  resting = element;
  for (let node = element ?? null; node; node = node.parentElement) {
    arrivals.observe(node, {
      attributes: true,
      attributeFilter: ['title', 'data-tooltip'],
    });
  }
};

/** The control a pointer inside it is on: moving onto its icon is not leaving. */
const controlOf = (element: Element): Element =>
  element.closest(NAMED_BY_TITLE) ?? element;

const onPointerOver = (event: PointerEvent) => {
  if (event.pointerType === 'touch' || !(event.target instanceof Element)) {
    returnLoans();
    restOn(undefined);
    return;
  }
  const { target } = event;
  pointer = { x: event.clientX, y: event.clientY };
  const isSameControl =
    resting !== undefined && controlOf(target) === controlOf(resting);
  // Still on what is lent, or on something inside it with nothing of its own
  // to say: nothing changes. Its own title reads empty while it is lent, so
  // this is asked before anything is looked up by text.
  if (loans.length > 0 && target.closest(SOURCES) === loans[0].element) {
    restOn(target);
    return;
  }
  // Put back first, so the new chain is read from the titles the page wrote.
  returnLoans();
  restOn(target);
  if (!isSameControl) {
    isDismissed = false;
  }
  const chain = describedChain(target);
  if (chain.length > 0) {
    // The pointer arriving somewhere new is the newer question than the
    // control Tab left focused.
    if (shownTooltip()?.byFocus) {
      hideTooltip(true);
    }
    lend(chain);
  }
};

const onPointerOut = (event: PointerEvent) => {
  // Out of the window altogether: nothing else will be hovered to say so.
  if (event.relatedTarget === null) {
    returnLoans();
    restOn(undefined);
  }
};

/** Hidden until the pointer moves onto something else. */
const dismiss = () => {
  // Resting on something with no tooltip yet counts: a press is what titles
  // the Gallery's Add button.
  if (loans.length > 0 || resting) {
    isDismissed = true;
  }
  hideTooltip(false);
};

const onScroll = (event: Event) => {
  const scrolled = event.target;
  const on = shownTooltip()?.element;
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
  showTooltip(target, text, undefined, true);
};

const onFocusOut = (event: FocusEvent) => {
  const shown = shownTooltip();
  if (shown?.byFocus && shown.element === event.target) {
    hideTooltip(true);
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
