/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { prefersReducedMotion } from '../../utils/bandReveal';
import { useTranslation } from '../../utils/I18nContext';
import windowDark from '../../../../assets/tour/window-dark.jpg';
import windowWhite from '../../../../assets/tour/window-white.jpg';

/** One pass across and back, slow enough to read as the slider, not a wipe. */
const SWEEP_SECONDS = 22;
const SWEEP_MIDDLE = 0.5;
const SWEEP_REACH = 0.24;
/** How far the seam may go: a sliver of either window stays in sight. */
const EDGE = 0.03;
/** The seam catches up with the pointer over about this long, not at once. */
const CATCH_MS = 70;
const KEY_STEP = 0.05;
const SETTLED = 0.0005;

const clampSeam = (seam: number) => Math.min(1 - EDGE, Math.max(EDGE, seam));
const sweepAt = (seconds: number) =>
  SWEEP_MIDDLE +
  SWEEP_REACH * Math.sin((seconds / SWEEP_SECONDS) * 2 * Math.PI);
/** Where on the sweep a seam stands, so leaving the window never jumps it. */
const sweepSecondsAt = (seam: number) =>
  (Math.asin(Math.max(-1, Math.min(1, (seam - SWEEP_MIDDLE) / SWEEP_REACH))) /
    (2 * Math.PI)) *
  SWEEP_SECONDS;

/**
 * The opening page's window: the same EQ page as the app draws it in a
 * white window and in a dark one, side by side across one seam.
 *
 * White left of the seam and dark right of it, so moving the pointer right
 * makes the window whiter, as the Brightness slider does (Ivan picked look A
 * on 2026-11-25: "when the user hovers on the window it moves the white and
 * dark by moving the mouse left to right"). Left alone, the seam sweeps
 * slowly back and forth; under the pointer it follows the pointer; from the
 * keyboard the arrows move it, and it stays where they put it until the
 * window loses focus.
 *
 * The seam is written straight into the element's style once per painted
 * frame, never through a React render, and only while the window is in
 * sight: the loop stops when it scrolls away, when the slide changes, and,
 * with Animations off, as soon as the seam has reached the pointer — it
 * never sweeps by itself then.
 *
 * Both pictures are the app's own captures (the tour harness, 2026-11-25),
 * in the window's default colours: a capture cannot take the reader's Tint,
 * and the frame around it does.
 */
export default function TourSplitWindow() {
  const { t } = useTranslation();
  const roomRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const isStill = useRef(prefersReducedMotion());
  const seam = useRef(SWEEP_MIDDLE);
  const pointer = useRef<number | undefined>(undefined);
  const held = useRef<number | undefined>(undefined);
  const sweepSeconds = useRef(0);
  const wake = useRef<() => void>(() => undefined);

  useEffect(() => {
    const room = roomRef.current;
    const frame = windowRef.current;
    if (!room || !frame) {
      return undefined;
    }
    const show = (value: number) => {
      frame.style.setProperty('--seam', `${(value * 100).toFixed(2)}%`);
      frame.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    };
    show(seam.current);

    let isInSight = true;
    let animation = 0;
    let lastAt: number | undefined;
    const step = (now: number) => {
      animation = 0;
      const elapsed = lastAt === undefined ? 0 : now - lastAt;
      lastAt = now;
      const isSweeping =
        !isStill.current &&
        pointer.current === undefined &&
        held.current === undefined;
      if (isSweeping) {
        sweepSeconds.current += elapsed / 1000;
      }
      const target = clampSeam(
        pointer.current ?? held.current ?? sweepAt(sweepSeconds.current),
      );
      const share = isStill.current ? 1 : 1 - Math.exp(-elapsed / CATCH_MS);
      seam.current += (target - seam.current) * share;
      show(seam.current);
      if (
        isInSight &&
        (isSweeping || Math.abs(target - seam.current) > SETTLED)
      ) {
        animation = requestAnimationFrame(step);
      } else {
        lastAt = undefined;
      }
    };
    wake.current = () => {
      if (isInSight && animation === 0) {
        animation = requestAnimationFrame(step);
      }
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              isInSight = entries.some((entry) => entry.isIntersecting);
              if (isInSight) {
                wake.current();
              }
            },
            { root: room.closest('.feature-tour__stage') },
          );
    observer?.observe(room);
    wake.current();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(animation);
      wake.current = () => undefined;
    };
  }, []);

  const followPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width > 0) {
      pointer.current = clampSeam((event.clientX - box.left) / box.width);
      wake.current();
    }
  };

  const leave = () => {
    pointer.current = undefined;
    // The sweep picks up from where the seam was left, so it glides on.
    sweepSeconds.current = sweepSecondsAt(seam.current);
    wake.current();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = held.current ?? seam.current;
    let next: number | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = from - KEY_STEP;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = from + KEY_STEP;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = 1;
    }
    if (next !== undefined) {
      // The tour walks its slides on the same arrows; on the window they
      // are the window's.
      event.preventDefault();
      event.stopPropagation();
      held.current = clampSeam(next);
      wake.current();
    }
  };

  return (
    <div ref={roomRef} className="tour-split">
      <div
        ref={windowRef}
        className="tour-split__window"
        role="slider"
        tabIndex={0}
        aria-label={t('tour.v26.window.seamLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(seam.current * 100)}
        aria-valuetext={t('tour.v26.window.seamValue')}
        onPointerEnter={followPointer}
        onPointerMove={followPointer}
        onPointerLeave={leave}
        onKeyDown={onKeyDown}
        onBlur={() => {
          held.current = undefined;
          sweepSeconds.current = sweepSecondsAt(seam.current);
          wake.current();
        }}
      >
        <img
          className="tour-split__picture"
          src={windowDark}
          alt=""
          width={1920}
          height={1200}
          draggable={false}
        />
        <img
          className="tour-split__picture tour-split__picture--white"
          src={windowWhite}
          alt=""
          width={1920}
          height={1200}
          draggable={false}
        />
        <span className="tour-split__seam" aria-hidden="true">
          <span className="tour-split__grip" />
        </span>
        <span
          className="tour-split__tag tour-split__tag--white"
          aria-hidden="true"
        >
          {t('tour.v26.window.white')}
        </span>
        <span
          className="tour-split__tag tour-split__tag--dark"
          aria-hidden="true"
        >
          {t('tour.v26.window.dark')}
        </span>
      </div>
    </div>
  );
}
