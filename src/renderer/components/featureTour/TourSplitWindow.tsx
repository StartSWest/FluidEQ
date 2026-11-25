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
/**
 * Half the largest grip and a little air (`.tour-split__grip`, at most 36px
 * across, its 2px edge included), so the grip is never cut by the window's
 * edge on a narrow slide, where 3% of the width is less than that.
 */
const GRIP_REACH_PX = 20;
/** The seam catches up with a key's step over about this long, not at once. */
const CATCH_MS = 70;
const KEY_STEP = 0.05;
const PAGE_STEP = 0.2;
const SETTLED = 0.0005;

const sweepAt = (seconds: number) =>
  SWEEP_MIDDLE +
  SWEEP_REACH * Math.sin((seconds / SWEEP_SECONDS) * 2 * Math.PI);

/**
 * The opening page's window: the same EQ page as the app draws it in a
 * white window and in a dark one, side by side across one seam.
 *
 * White left of the seam and dark right of it, so taking the handle right
 * makes the window whiter, as the Brightness slider does. The seam moves only
 * when the reader takes its handle (Ivan, 2026-11-25: "I don't like the mouse
 * moving and turning white or black. Let's make them actually click the
 * handle and drag it if they want"): pressed on the grip or anywhere in the
 * strip around the line, then dragged, with the pointer captured so a drag
 * past either edge keeps going. A press anywhere else on the picture, and a
 * pointer passing over it, do nothing. From the keyboard the handle is a
 * slider: the arrows step it, Page Up and Page Down take larger steps, Home
 * and End take it to either side.
 *
 * Until the reader first takes the handle, the seam sweeps slowly back and
 * forth, to show that it moves; from the first press or key it stays where
 * it was left. The sweep waits while the pointer is over the handle or the
 * handle has focus, so a moving target is never what the reader reaches for.
 * With Animations off it never sweeps and rests in the middle.
 *
 * The seam is written straight into the element's style once per painted
 * frame, never through a React render, and only while the window is in
 * sight: the loop stops when it scrolls away, when the slide changes, and as
 * soon as the seam stands where it was put.
 *
 * Both pictures are the app's own captures (the tour harness, 2026-11-25),
 * in the window's default colours: a capture cannot take the reader's Tint,
 * and the frame around it does.
 */
export default function TourSplitWindow() {
  const { t } = useTranslation();
  const roomRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const isStill = useRef(prefersReducedMotion());
  const seam = useRef(SWEEP_MIDDLE);
  /** Where the reader left the seam; unset until the handle is first taken. */
  const held = useRef<number | undefined>(undefined);
  /** The pointer's distance from the seam when it pressed, while dragging. */
  const grab = useRef<{ pointerId: number; offset: number } | undefined>(
    undefined,
  );
  const isHovered = useRef(false);
  const isFocused = useRef(false);
  const sweepSeconds = useRef(0);
  const wake = useRef<() => void>(() => undefined);
  // The frame loop writes the value's words outside any render, so it reads
  // the language through this rather than the closure it was made in.
  const valueTextOf = useRef<(share: number) => string>(() => '');
  valueTextOf.current = (share: number) =>
    t('tour.v26.window.seamValue', { percent: Math.round(share * 100) });

  /** The seam kept clear of both edges by a share and by the grip's reach. */
  const clampSeam = (value: number) => {
    const width = windowRef.current?.getBoundingClientRect().width ?? 0;
    const edge = width > 0 ? Math.max(EDGE, GRIP_REACH_PX / width) : EDGE;
    return Math.min(1 - edge, Math.max(edge, value));
  };
  const clampRef = useRef(clampSeam);
  clampRef.current = clampSeam;

  useEffect(() => {
    const room = roomRef.current;
    const frame = windowRef.current;
    const handle = handleRef.current;
    if (!room || !frame || !handle) {
      return undefined;
    }
    const show = (value: number) => {
      frame.style.setProperty('--seam', `${(value * 100).toFixed(2)}%`);
      handle.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      handle.setAttribute('aria-valuetext', valueTextOf.current(value));
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
        held.current === undefined &&
        !isHovered.current &&
        !isFocused.current;
      if (isSweeping) {
        sweepSeconds.current += elapsed / 1000;
      }
      const target = clampRef.current(
        held.current ??
          (isStill.current ? SWEEP_MIDDLE : sweepAt(sweepSeconds.current)),
      );
      // A drag is under the reader's hand and goes where the hand is; only
      // a key's step glides.
      const share =
        isStill.current || grab.current !== undefined
          ? 1
          : 1 - Math.exp(-elapsed / CATCH_MS);
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

  /** The pointer's place across the window, 0 at its left edge. */
  const shareOf = (clientX: number) => {
    const box = windowRef.current?.getBoundingClientRect();
    return box && box.width > 0 ? (clientX - box.left) / box.width : undefined;
  };

  const take = (event: PointerEvent<HTMLSpanElement>) => {
    const at = shareOf(event.clientX);
    if (!event.isPrimary || event.button !== 0 || at === undefined) {
      return;
    }
    // Captured, the drag keeps coming here past either edge of the window
    // and outside it, until the button is let go.
    event.currentTarget.setPointerCapture(event.pointerId);
    handleRef.current?.setAttribute('data-dragging', 'true');
    // Measured from the seam, so taking the grip off its centre does not
    // jump the seam to the pointer.
    grab.current = { pointerId: event.pointerId, offset: at - seam.current };
    held.current = clampSeam(seam.current);
    wake.current();
  };

  const drag = (event: PointerEvent<HTMLSpanElement>) => {
    const at = shareOf(event.clientX);
    if (grab.current?.pointerId !== event.pointerId || at === undefined) {
      return;
    }
    held.current = clampSeam(at - grab.current.offset);
    wake.current();
  };

  const letGo = (event: PointerEvent<HTMLSpanElement>) => {
    if (grab.current?.pointerId !== event.pointerId) {
      return;
    }
    grab.current = undefined;
    handleRef.current?.removeAttribute('data-dragging');
    wake.current();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const from = held.current ?? seam.current;
    let next: number | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = from - KEY_STEP;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = from + KEY_STEP;
    } else if (event.key === 'PageDown') {
      next = from - PAGE_STEP;
    } else if (event.key === 'PageUp') {
      next = from + PAGE_STEP;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = 1;
    }
    if (next !== undefined) {
      // The tour walks its slides on the same arrows; on the handle they
      // are the handle's.
      event.preventDefault();
      event.stopPropagation();
      held.current = clampSeam(next);
      wake.current();
    }
  };

  /** The sweep waits on these and goes on from where it stood after. */
  const pauseSweep = (isPaused: boolean, flag: { current: boolean }) => {
    flag.current = isPaused;
    wake.current();
  };

  return (
    <div ref={roomRef} className="tour-split">
      <div ref={windowRef} className="tour-split__window">
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
        <span
          ref={handleRef}
          className="tour-split__seam"
          role="slider"
          tabIndex={0}
          aria-label={t('tour.v26.window.seamLabel')}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(seam.current * 100)}
          aria-valuetext={valueTextOf.current(seam.current)}
          onPointerDown={take}
          onPointerMove={drag}
          onPointerUp={letGo}
          onPointerCancel={letGo}
          onLostPointerCapture={letGo}
          onPointerEnter={() => pauseSweep(true, isHovered)}
          onPointerLeave={() => pauseSweep(false, isHovered)}
          onFocus={() => pauseSweep(true, isFocused)}
          onBlur={() => pauseSweep(false, isFocused)}
          onKeyDown={onKeyDown}
        >
          <span className="tour-split__line" />
          <span className="tour-split__grip">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M7.5 5.5 3 10l4.5 4.5M12.5 5.5 17 10l-4.5 4.5" />
            </svg>
          </span>
        </span>
      </div>
    </div>
  );
}
