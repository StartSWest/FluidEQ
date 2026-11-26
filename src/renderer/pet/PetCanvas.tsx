/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useEffect, useRef } from 'react';
import { getEaseFactor } from 'common/smoothing';
import { displayTickMs, isFrameDue } from '../utils/framePace';
import observeShown from '../utils/observeShown';
import { readAccentLightChannels, subscribeRoot } from '../utils/theme';
import {
  createPetMotion,
  type IPetMusic,
  type IPetPose,
  SILENT_PET_MUSIC,
  stepPetMotion,
} from './petChoreography';
import { furPalette, type IFurPalette, paintFurPet } from './furPaint';
import type { TRgb } from './furFace';

/**
 * The room around her square for what reaches past it: a hop, the sway, her
 * fur standing up. A share of her size plus a little, so the 22 px bubble
 * still has her ears' tips.
 */
const padFor = (art: number) => Math.round(art * 0.3 + 6);

/**
 * Her size in the titlebar: from ear tips to feet she covers her 40 px
 * button (Ivan, 2026-11-26: "make it bigger inside its button to cover the
 * whole button"), about 38 px tall and 36 wide with her headphones. Her
 * canvas takes no room and no pointer, so the button, the bar and
 * everything beside them keep their sizes.
 */
export const TITLEBAR_PET_ART = 52;
/** The press's ease, the stylesheet's old 90 ms ease-out as a half-life. */
const PRESS_HALF_LIFE_MS = 28;
const STAR_HALF_LIFE_MS = 75;
/**
 * Her pace while she hears nothing: breathing and blinking read the same at
 * thirty frames, and she is in the titlebar for the life of the window.
 */
const RESTING_PACE_MS = 1000 / 30;
/**
 * Her pace while she dances. A frame of her costs 0.1-0.25 ms (measured in
 * the pet harness, 2026-11-26), and at the window's 165 a second that was a
 * few percent of a core for a titlebar creature; sixty is smooth at her size.
 */
const DANCING_PACE_MS = 1000 / 60;

interface IPetCanvasProps {
  /** Her square's side in CSS px: 52 in the titlebar, 126 in the dialog. */
  art: number;
  /** What the pointer presses: the button around her. None in a figure. */
  host?: RefObject<HTMLElement | null>;
  /** The music, read on her clock; absent where she never hears it. */
  readMusic?: (elapsedMs: number) => IPetMusic;
  /** A supporter's pet: the star, and the music. */
  isCelebrating: boolean;
  /** The sound has not let go (`hasLetGo`); a figure is always awake. */
  isListening?: boolean;
  isPaused?: boolean;
  /** The face a tap in the Support dialog earned. */
  mood?: '' | 'perfect' | 'miss';
}

/**
 * Her colour token, as the channels a canvas mixes from. Any colour the page
 * can name - a scene's accent comes as `oklch(from ...)` - said in channels:
 * painted on a one-pixel swatch and read back.
 */
const toneOf = (
  probe: HTMLElement,
  context: CanvasRenderingContext2D | null,
  fallback: TRgb,
): TRgb => {
  probe.style.color = 'var(--pet-tone, #4ad3dc)';
  const css = getComputedStyle(probe).color;
  if (!context || !css) {
    return fallback;
  }
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
};

/**
 * The pet, drawn on one canvas at the window's drawing pace: the titlebar's,
 * the Support dialog's, and the small figures in the Auto EQ bubble and the
 * Help pages. Every motion is the choreography's (`petChoreography.ts`), fed
 * the music on this canvas's own frames; the drawing is `furPaint.ts`.
 *
 * Only shown, she is drawn (`observeShown`); hearing nothing, at thirty
 * frames; for somebody who asked for less motion she holds still and is
 * drawn only while her expression is still easing to where it is told.
 */
export default function PetCanvas({
  art,
  host,
  readMusic,
  isCelebrating,
  isListening = true,
  isPaused = false,
  mood = '',
}: IPetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef({
    readMusic,
    isCelebrating,
    isListening,
    isPaused,
    mood,
  });
  propsRef.current = { readMusic, isCelebrating, isListening, isPaused, mood };
  const kickRef = useRef<() => void>(() => undefined);
  const pad = padFor(art);
  const side = art + pad * 2;

  useEffect(() => {
    kickRef.current();
  }, [isCelebrating, isListening, isPaused, mood, readMusic]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const probe = probeRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !probe || !context) {
      return undefined;
    }
    const hostElement = host?.current ?? undefined;
    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : undefined;
    const born = performance.now();
    const motion = createPetMotion();
    const swatch = document.createElement('canvas');
    swatch.width = 1;
    swatch.height = 1;
    const swatchContext = swatch.getContext('2d', { willReadFrequently: true });
    let ratio = 1;
    let palette: IFurPalette = furPalette([74, 211, 220], [126, 245, 232]);
    let isPressed = false;
    let shownPress = 0;
    let shownStar = propsRef.current.isCelebrating ? 1 : 0;
    let lastAt: number | undefined;
    let lastTickAt: number | undefined;
    let tickMs = 1000 / 60;
    let frame: number | undefined;
    let isShown = false;
    let lastPose: IPetPose | undefined;

    const fit = () => {
      ratio = window.devicePixelRatio || 1;
      const px = Math.round(side * ratio);
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
    };
    const readRoot = () => {
      palette = furPalette(
        toneOf(probe, swatchContext, palette.tone),
        readAccentLightChannels([126, 245, 232]),
      );
    };

    // Whether anything she shows is still on its way somewhere, for somebody
    // who asked for less motion and so is drawn only while it is.
    const settling = (pose: IPetPose, before: IPetPose | undefined) =>
      before === undefined ||
      Math.abs(pose.lid - before.lid) > 0.002 ||
      Math.abs(pose.smile - before.smile) > 0.002 ||
      Math.abs(pose.pupil - before.pupil) > 0.002 ||
      Math.abs(pose.eyeWide - before.eyeWide) > 0.002 ||
      Math.abs(pose.joy - before.joy) > 0.002;

    const draw = (now: number) => {
      const elapsed = lastAt === undefined ? 16 : now - lastAt;
      lastAt = now;
      const state = propsRef.current;
      const reduced = motionQuery?.matches === true;
      const hearsMusic = Boolean(state.readMusic) && state.isCelebrating;
      const music =
        hearsMusic && state.readMusic && state.isListening
          ? state.readMusic(elapsed)
          : SILENT_PET_MUSIC;
      const pose = stepPetMotion(
        motion,
        music,
        {
          hearsMusic,
          isListening: state.isListening,
          isPaused: state.isPaused,
          isReducedMotion: reduced,
        },
        elapsed,
      );
      const pressTarget = isPressed && !reduced ? 1 : 0;
      shownPress +=
        (pressTarget - shownPress) * getEaseFactor(elapsed, PRESS_HALF_LIFE_MS);
      shownStar +=
        ((state.isCelebrating ? 1 : 0) - shownStar) *
        getEaseFactor(elapsed, STAR_HALF_LIFE_MS);
      const sinceBirth = (now - born) / 1000;
      paintFurPet(context, {
        art,
        pad,
        ratio,
        palette,
        pose,
        joy: pose.joy,
        waveTravel: reduced ? 0 : (sinceBirth / 0.9) % 1,
        star: shownStar,
        starScale: reduced ? 1 : 1 + 0.07 * Math.sin(sinceBirth * 2.4),
        starTurn: reduced ? 0 : Math.sin(sinceBirth * 1.2) * 0.2,
        press: shownPress,
        mood: state.mood,
      });
      const easing =
        Math.abs(pressTarget - shownPress) > 0.002 ||
        Math.abs((state.isCelebrating ? 1 : 0) - shownStar) > 0.002;
      const keepGoing = !reduced || easing || settling(pose, lastPose);
      lastPose = pose;
      return keepGoing;
    };

    const loop = (now: number) => {
      frame = undefined;
      tickMs = displayTickMs(now, lastTickAt, tickMs);
      lastTickAt = now;
      const resting =
        !propsRef.current.isListening ||
        !propsRef.current.readMusic ||
        !propsRef.current.isCelebrating;
      const pace =
        resting && shownPress < 0.002 ? RESTING_PACE_MS : DANCING_PACE_MS;
      if (lastAt !== undefined && !isFrameDue(now - lastAt, pace, tickMs)) {
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
    // Her token changed, however it changed: the probe's colour finished
    // moving to the new one (`.support-pet__probe`).
    const onToneChanged = () => {
      readRoot();
      kick();
    };
    probe.addEventListener('transitionend', onToneChanged);
    const onLeave = () => {
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
    hostElement?.addEventListener('pointerleave', onLeave);
    hostElement?.addEventListener('pointerdown', onDown);
    hostElement?.addEventListener('pointerup', onUp);
    hostElement?.addEventListener('pointercancel', onUp);
    hostElement?.addEventListener('keydown', onKey);
    hostElement?.addEventListener('keyup', onKey);
    motionQuery?.addEventListener('change', kick);
    window.addEventListener('resize', fit);
    const stopWatching = observeShown(canvas, (shown) => {
      isShown = shown;
      if (shown) {
        lastAt = undefined;
        lastPose = undefined;
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
      probe.removeEventListener('transitionend', onToneChanged);
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      hostElement?.removeEventListener('pointerleave', onLeave);
      hostElement?.removeEventListener('pointerdown', onDown);
      hostElement?.removeEventListener('pointerup', onUp);
      hostElement?.removeEventListener('pointercancel', onUp);
      hostElement?.removeEventListener('keydown', onKey);
      hostElement?.removeEventListener('keyup', onKey);
      motionQuery?.removeEventListener('change', kick);
      window.removeEventListener('resize', fit);
    };
  }, [art, host, pad, side]);

  return (
    <span className="support-pet__frame" style={{ width: art, height: art }}>
      <canvas
        ref={canvasRef}
        className="support-pet__canvas"
        style={{ width: side, height: side }}
        aria-hidden="true"
      />
      <span ref={probeRef} className="support-pet__probe" aria-hidden="true" />
    </span>
  );
}
