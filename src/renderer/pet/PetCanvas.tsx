/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useEffect, useRef } from 'react';
import { getEaseFactor } from 'common/smoothing';
import {
  displayTickMs,
  isFrameDue,
  WINDOW_DRAWING_PACE_MS,
} from '../utils/framePace';
import observeShown from '../utils/observeShown';
import { readAccentLight, subscribeRoot } from '../utils/theme';
import {
  BOB,
  BREATHE,
  DANCE_SWAYS,
  EYE_SCROLL,
  TWINKLE,
  blink,
  earSway,
  earSwayDelayMs,
  sample,
  sway,
} from './petMotion';
import { type IPetFrame, paintPet } from './petPaint';

/** The square she is drawn in, as `.support-pet__art` sizes it. */
const SIZE = 36;
/**
 * Room around the square for what reaches past it: the sway's shift and
 * lean. She is drawn flat, with no glow (Ivan, 2026-11-17: "remove glow from
 * pet", "all needs to look flat and modern").
 */
const PAD = 46;
/** The steps `--pet-level` was held to (`SupportPet.tsx`), kept here too. */
const LEVEL_STEPS = 12;
/**
 * The 90 ms ease-out transitions the stylesheet gave the squash, the ears'
 * stretch and the press, and the 220 ms of the squint and the grin, as
 * half-lives for `getEaseFactor`: an ease-out covers about 90% of its way in
 * its duration, which an exponential does in a little over three half-lives.
 */
const LEVEL_HALF_LIFE_MS = 28;
const PRESS_HALF_LIFE_MS = 28;
const JOY_HALF_LIFE_MS = 70;
const STAR_HALF_LIFE_MS = 75;

interface IPetCanvasProps {
  /** The element the pointer presses and hovers: the button around her. */
  host: RefObject<HTMLElement | null>;
  /** The music's level as the pump hears it, 0 to 1. */
  level: RefObject<number>;
  isCelebrating: boolean;
  isListening: boolean;
  isDancing: boolean;
  /** Said once the dance's last sway is over. */
  onDanceEnd: () => void;
}

/** A colour custom property resolved to a colour a canvas can read. */
const resolveColour = (probe: HTMLElement, name: string, fallback: string) => {
  probe.style.color = `var(${name}, ${fallback})`;
  return getComputedStyle(probe).color || fallback;
};

/**
 * The titlebar's pet, drawn on one canvas at the window's drawing pace.
 *
 * She was eight layers of page, each animated by the stylesheet, under a
 * drop shadow that swayed with her: measured in the running window at 240 Hz
 * with music (2026-11-16), hiding her took the graphics process from 67% of
 * a core to 49%, and her ears' stretch, a transition on a group inside an SVG,
 * had the whole window repainted with every frame. Drawn here, every one of
 * her motions is one paint of one small canvas, at most every other frame on
 * that display (`WINDOW_DRAWING_PACE_MS`), and nothing else in the window is
 * touched. The motions are the stylesheet's own (`petMotion.ts`); the
 * drawing is `PetArt`'s (`petPaint.ts`), which the support dialog's hero and
 * the EQ bubble still draw as SVG.
 */
export default function PetCanvas({
  host,
  level,
  isCelebrating,
  isListening,
  isDancing,
  onDanceEnd,
}: IPetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef({ isCelebrating, isListening, isDancing });
  stateRef.current = { isCelebrating, isListening, isDancing };
  const onDanceEndRef = useRef(onDanceEnd);
  onDanceEndRef.current = onDanceEnd;
  // When each motion started: a CSS animation starts when its rule starts to
  // apply, and restarts from its first keyframe when its name changes.
  const startsRef = useRef({ sway: 0, dance: 0, twinkle: 0 });
  const kickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const now = performance.now();
    startsRef.current.twinkle = now;
  }, [isCelebrating]);
  useEffect(() => {
    startsRef.current.sway = performance.now();
  }, [isListening, isDancing]);
  useEffect(() => {
    if (isDancing) {
      startsRef.current.dance = performance.now();
    }
  }, [isDancing]);
  useEffect(() => {
    kickRef.current();
  }, [isCelebrating, isListening, isDancing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const probe = probeRef.current;
    const context = canvas?.getContext('2d');
    const hostElement = host.current;
    if (!canvas || !probe || !context || !hostElement) {
      return undefined;
    }
    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : undefined;
    const born = performance.now();
    let ratio = 1;
    let tone = '#4ad3dc';
    let joyTarget = 0;
    let isHovered = false;
    let isPressed = false;
    // The eased values the stylesheet's transitions used to carry.
    let shownLevel = 0;
    let shownPress = 0;
    let shownJoy = 0;
    let shownStar = stateRef.current.isCelebrating ? 1 : 0;
    let lastAt: number | undefined;
    let lastTickAt: number | undefined;
    let tickMs = 1000 / 60;
    let frame: number | undefined;
    let isShown = false;
    let danceEnded = false;

    const fit = () => {
      ratio = window.devicePixelRatio || 1;
      const side = Math.round((SIZE + PAD * 2) * ratio);
      if (canvas.width !== side) {
        canvas.width = side;
        canvas.height = side;
      }
    };
    const readRoot = () => {
      tone = resolveColour(probe, '--pet-tone', '#4ad3dc');
      const joy = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--pet-joy',
        ),
      );
      joyTarget = Number.isFinite(joy) ? Math.max(0, Math.min(1, joy)) : 0;
    };

    const build = (now: number, elapsed: number): [IPetFrame, boolean] => {
      const state = stateRef.current;
      const reduced = motionQuery?.matches === true;
      const starts = startsRef.current;
      const listening = state.isCelebrating && state.isListening;
      const dancing = state.isCelebrating && state.isDancing;
      const levelTarget = listening
        ? Math.round((level.current ?? 0) * LEVEL_STEPS) / LEVEL_STEPS
        : 0;
      const pressTarget = isPressed && !reduced ? 1 : 0;
      shownLevel +=
        (levelTarget - shownLevel) * getEaseFactor(elapsed, LEVEL_HALF_LIFE_MS);
      shownPress +=
        (pressTarget - shownPress) * getEaseFactor(elapsed, PRESS_HALF_LIFE_MS);
      shownJoy +=
        (joyTarget - shownJoy) * getEaseFactor(elapsed, JOY_HALF_LIFE_MS);
      shownStar +=
        ((state.isCelebrating ? 1 : 0) - shownStar) *
        getEaseFactor(elapsed, STAR_HALF_LIFE_MS);

      let swayX = 0;
      let swayDeg = 0;
      let earDeg = 0;
      let bob = 0;
      if (!reduced && (listening || dancing)) {
        const since = now - (dancing ? starts.dance : starts.sway);
        const swayMs = sway(dancing).durationMs;
        if (dancing && since >= swayMs * DANCE_SWAYS) {
          // The dance holds its last pose until it is taken off, as
          // `forwards` does; the end is said once.
          [swayX, swayDeg] = sample(sway(true), swayMs * DANCE_SWAYS - 1);
          if (!danceEnded) {
            danceEnded = true;
            onDanceEndRef.current();
          }
        } else {
          [swayX, swayDeg] = sample(sway(dancing), since);
        }
        const earSince = since - earSwayDelayMs(dancing);
        earDeg = earSince > 0 ? sample(earSway(dancing), earSince)[0] : 0;
        bob = dancing ? sample(BOB, now - starts.dance)[0] : 0;
      }
      if (!dancing) {
        danceEnded = false;
      }
      // Breathing at rest, squashed by the music while she listens, and
      // neither for somebody who asked for less motion.
      let bodyScaleX = 1;
      let bodyScaleY = 1;
      if (!reduced && listening) {
        bodyScaleX = 1 - shownLevel * 0.07;
        bodyScaleY = 1 + shownLevel * 0.16;
      } else if (!reduced) {
        [bodyScaleX, bodyScaleY] = sample(BREATHE, now - born);
      }
      const [twinkleOpacity, twinkleScale, twinkleDeg] =
        reduced || !state.isCelebrating
          ? [1, 1, 0]
          : sample(TWINKLE, now - starts.twinkle);
      const joy = reduced ? joyTarget : shownJoy;
      const pet: IPetFrame = {
        size: SIZE,
        pad: PAD,
        swayX,
        swayDeg,
        earDeg,
        earBob: bob,
        earStretch: reduced || !state.isCelebrating ? 1 : 1 + shownLevel * 0.45,
        bodyScaleX,
        bodyScaleY,
        bodyBob: bob,
        press: shownPress,
        blink: reduced ? 1 : sample(blink(isHovered), now - born)[0],
        squint: reduced ? 1 : 1 - joy * 0.3,
        joy,
        waveTravel: reduced ? 0 : sample(EYE_SCROLL, now - born)[0],
        waveInk: readAccentLight(1, '#7ef5e8'),
        star: shownStar,
        starOpacity: twinkleOpacity,
        starScale: (0.4 + 0.6 * shownStar) * twinkleScale,
        starDeg: twinkleDeg,
        starBob: bob,
        tone,
      };
      // Still moving: always, but for somebody who asked for less motion,
      // whose pet only eases to where she is told to be.
      const settling =
        Math.abs(levelTarget - shownLevel) > 0.002 ||
        Math.abs(pressTarget - shownPress) > 0.002 ||
        Math.abs(joyTarget - shownJoy) > 0.002 ||
        Math.abs((state.isCelebrating ? 1 : 0) - shownStar) > 0.002;
      return [pet, !reduced || settling];
    };

    const draw = (now: number) => {
      const elapsed = lastAt === undefined ? 16 : now - lastAt;
      lastAt = now;
      const [pet, moving] = build(now, elapsed);
      paintPet(context, pet, ratio);
      return moving;
    };

    const loop = (now: number) => {
      frame = undefined;
      tickMs = displayTickMs(now, lastTickAt, tickMs);
      lastTickAt = now;
      if (
        lastAt !== undefined &&
        !isFrameDue(now - lastAt, WINDOW_DRAWING_PACE_MS, tickMs)
      ) {
        frame = requestAnimationFrame(loop);
        return;
      }
      if (draw(now)) {
        frame = requestAnimationFrame(loop);
      } else {
        lastAt = undefined;
        lastTickAt = undefined;
      }
    };
    const kick = () => {
      if (isShown && frame === undefined) {
        frame = requestAnimationFrame(loop);
      }
    };
    kickRef.current = kick;

    fit();
    readRoot();
    const stopRoot = subscribeRoot(() => {
      readRoot();
      kick();
    });
    const onEnter = () => {
      isHovered = true;
    };
    const onLeave = () => {
      isHovered = false;
      isPressed = false;
      kick();
    };
    const onDown = () => {
      isPressed = true;
      kick();
    };
    const onUp = () => {
      isPressed = false;
      kick();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        isPressed = event.type === 'keydown';
        kick();
      }
    };
    hostElement.addEventListener('pointerenter', onEnter);
    hostElement.addEventListener('pointerleave', onLeave);
    hostElement.addEventListener('pointerdown', onDown);
    hostElement.addEventListener('pointerup', onUp);
    hostElement.addEventListener('pointercancel', onUp);
    hostElement.addEventListener('keydown', onKey);
    hostElement.addEventListener('keyup', onKey);
    motionQuery?.addEventListener('change', kick);
    window.addEventListener('resize', fit);
    const stopWatching = observeShown(canvas, (shown) => {
      isShown = shown;
      if (shown) {
        lastAt = undefined;
        kick();
      } else if (frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      }
    });
    return () => {
      kickRef.current = () => undefined;
      stopWatching();
      stopRoot();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      hostElement.removeEventListener('pointerenter', onEnter);
      hostElement.removeEventListener('pointerleave', onLeave);
      hostElement.removeEventListener('pointerdown', onDown);
      hostElement.removeEventListener('pointerup', onUp);
      hostElement.removeEventListener('pointercancel', onUp);
      hostElement.removeEventListener('keydown', onKey);
      hostElement.removeEventListener('keyup', onKey);
      motionQuery?.removeEventListener('change', kick);
      window.removeEventListener('resize', fit);
    };
  }, [host, level]);

  return (
    <span className="support-pet__frame">
      <canvas
        ref={canvasRef}
        className="support-pet__canvas"
        aria-hidden="true"
      />
      <span ref={probeRef} className="support-pet__probe" aria-hidden="true" />
    </span>
  );
}
