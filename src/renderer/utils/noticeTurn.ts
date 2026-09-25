/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useReducer, useSyncExternalStore } from 'react';

/**
 * Which notice may be on screen, decided once, in React.
 *
 * The notices used to hide one another from the stylesheets, with rules of
 * the form `body:has(.a) .b { display: none }`. A `:has()` anchored on the
 * body is a question about the whole document, so the browser had to be
 * ready to ask it again after a change anywhere in the window — a row of the
 * Library scrolled in, a readout rewritten — to learn whether some notice had
 * arrived. Each notice now says here whether it wants the screen, and a
 * notice that has to wait renders nothing at all.
 *
 * Wanting the screen is what being in the document used to mean to those
 * rules, so a notice that is itself waiting still holds back the ones below
 * it, exactly as a `display: none` element still matched their `:has()`.
 *
 * The order is the one the stylesheets encoded, unchanged:
 *
 * - **The engine's spot**, centred under the titlebar, holds one card at a
 *   time. The output notice and the Room's 7.1 offer come first; the engine
 *   trouble notice waits for both; the engine update notice waits for all
 *   three. (The output notice over the Room's offer is the output panel's
 *   own decision, made where both are rendered.)
 * - **The corner** holds one card at a time, and gives way to everything
 *   that opens in the strip under the titlebar and reaches it below about
 *   1500px of width: anything modal, any card in the engine's spot, the
 *   restart and capture notices, the missing-engine banner, the song EQ
 *   toast that shares the corner, and full screen, which takes away the
 *   titlebar the corner is placed under. Then the Plus terms notice, then
 *   news of a scene reviewed, then the maker's month running out — the
 *   newest news about a maker's scenes goes before a week's warning.
 *
 * Everything not named as waiting for something above never waits.
 */
export type TNoticeClaim =
  /** The output panel's notice: this output is not being processed. */
  | 'output'
  /** The Room's offer to set the output to 7.1 (`RoomOutputNotice`). */
  | 'room'
  | 'engineTrouble'
  | 'engineUpdate'
  /** The shell's restart and live-capture notices. */
  | 'audioRestart'
  /** The missing-engine banner (`PrereqMissingModal`). */
  | 'prereq'
  | 'songEq'
  | 'plusTerms'
  | 'sceneReview'
  | 'makerMonth'
  /** The window is full screen: graph or media (`useAppFullMark`). */
  | 'appFull'
  /**
   * An `aria-modal="true"` element anywhere in the document. Not claimed by
   * anybody: the dialogs that carry it do not know about notices, so this
   * module looks for them itself, and only while a notice that waits for
   * them wants the screen (see `watchModals`).
   */
  | 'modal';

/** Everything the corner waits for, before the corner's own order. */
const CORNER_WAITS_FOR: readonly TNoticeClaim[] = [
  'modal',
  'output',
  'room',
  'engineTrouble',
  'engineUpdate',
  'audioRestart',
  'prereq',
  'songEq',
  'appFull',
];

/** For each notice, the claims that keep it off the screen. */
export const NOTICE_WAITS_FOR: Readonly<
  Record<TNoticeClaim, readonly TNoticeClaim[]>
> = {
  output: [],
  room: [],
  engineTrouble: ['output', 'room'],
  engineUpdate: ['output', 'room', 'engineTrouble'],
  audioRestart: [],
  prereq: [],
  songEq: [],
  plusTerms: CORNER_WAITS_FOR,
  sceneReview: [...CORNER_WAITS_FOR, 'plusTerms'],
  makerMonth: [...CORNER_WAITS_FOR, 'plusTerms', 'sceneReview'],
  appFull: [],
  modal: [],
};

/** Whether `notice` may be on screen while `claimed` want it. */
export const noticeMayShow = (
  notice: TNoticeClaim,
  claimed: ReadonlySet<TNoticeClaim>,
): boolean => !NOTICE_WAITS_FOR[notice].some((other) => claimed.has(other));

/** Anything a person has to answer before the window is theirs again. */
const MODAL = '[aria-modal="true"]';

/** The notices that wait for a modal; the watch runs only while one wants in. */
const WAITS_FOR_MODAL = (
  Object.keys(NOTICE_WAITS_FOR) as TNoticeClaim[]
).filter((notice) => NOTICE_WAITS_FOR[notice].includes('modal'));

const counts = new Map<TNoticeClaim, number>();
let claimed: ReadonlySet<TNoticeClaim> = new Set();
let isModalUp = false;
let modalWatch: MutationObserver | undefined;
const listeners = new Set<() => void>();

const holdsModal = (node: Node): boolean =>
  node instanceof Element &&
  (node.matches(MODAL) || node.querySelector(MODAL) !== null);

/** A batch of changes that could have brought a dialog or taken one away. */
const touchesModal = (records: MutationRecord[]) =>
  records.some(
    (record) =>
      record.type === 'attributes' ||
      Array.from(record.addedNodes).some(holdsModal) ||
      Array.from(record.removedNodes).some(holdsModal),
  );

const isClaimed = (claim: TNoticeClaim) => (counts.get(claim) ?? 0) > 0;

/**
 * Start or stop looking for dialogs, as the notices that wait for them come
 * and go.
 *
 * Only elements added or taken away, and changes to `aria-modal` itself, are
 * looked at, and only the added or removed subtree is searched; the whole
 * document is asked again only when one of those held a modal. None of it
 * runs while no corner notice has anything to say, which is nearly always.
 */
const watchModals = (onChange: () => void) => {
  const wanted =
    typeof document !== 'undefined' &&
    typeof MutationObserver !== 'undefined' &&
    WAITS_FOR_MODAL.some(isClaimed);
  if (wanted && !modalWatch) {
    modalWatch = new MutationObserver((records) => {
      if (touchesModal(records)) {
        isModalUp = document.querySelector(MODAL) !== null;
        onChange();
      }
    });
    modalWatch.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal'],
    });
    isModalUp = document.querySelector(MODAL) !== null;
  } else if (!wanted && modalWatch) {
    modalWatch.disconnect();
    modalWatch = undefined;
    isModalUp = false;
  }
};

const publish = () => {
  watchModals(publish);
  const next = new Set<TNoticeClaim>(
    Array.from(counts.keys()).filter(isClaimed),
  );
  if (isModalUp) {
    next.add('modal');
  }
  const same =
    next.size === claimed.size &&
    Array.from(next).every((claim) => claimed.has(claim));
  if (same) {
    return;
  }
  claimed = next;
  listeners.forEach((listener) => listener());
};

/**
 * Say that `claim` wants the screen until the returned function is called.
 * Counted, so two copies of one notice (the restart and the capture notice
 * are both `audioRestart`) hold it until both are gone.
 */
export const claimNotice = (
  claim: Exclude<TNoticeClaim, 'modal'>,
): (() => void) => {
  counts.set(claim, (counts.get(claim) ?? 0) + 1);
  publish();
  let isHeld = true;
  return () => {
    if (!isHeld) {
      return;
    }
    isHeld = false;
    counts.set(claim, Math.max(0, (counts.get(claim) ?? 0) - 1));
    publish();
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const readClaimed = () => claimed;

/**
 * Claim the screen for as long as `wants` holds, for a notice nothing ever
 * hides. In a layout effect, so a notice arriving and the ones it hides
 * going happen before the frame is painted, as the stylesheet rule did.
 */
export const useNoticeClaim = (
  claim: Exclude<TNoticeClaim, 'modal'>,
  wants: boolean,
) => {
  useLayoutEffect(
    () => (wants ? claimNotice(claim) : undefined),
    [claim, wants],
  );
};

/**
 * Claim the screen for as long as `wants` holds, and answer whether this
 * notice has it now.
 */
export const useNoticeTurn = (
  notice: Exclude<TNoticeClaim, 'modal'>,
  wants: boolean,
): boolean => {
  useNoticeClaim(notice, wants);
  const current = useSyncExternalStore(subscribe, readClaimed, readClaimed);
  // `useSyncExternalStore` subscribes after the frame is painted. A claim
  // made in the commit that mounts this notice lands before then, and would
  // otherwise show both cards for a frame.
  const [, recheck] = useReducer((count: number) => count + 1, 0);
  useLayoutEffect(() => {
    if (readClaimed() !== current) {
      recheck();
    }
  });
  return wants && noticeMayShow(notice, current);
};
