/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef } from 'react';
import type { IAmbientElement, ISceneAmbient } from 'common/sceneAmbient';
import type { ISceneArtwork } from 'common/sceneArtwork';
import {
  MAX_POINTER_PIECES,
  type IScenePointer,
  type IScenePointerEmitter,
} from 'common/scenePointer';
import { ambientSprite } from '../ambient/ambientSprites';
import useAmbientPictures from '../ambient/useAmbientPictures';
import { prefersReducedMotion } from '../utils/bandReveal';
import type { TGestureSource, TSceneGesture } from './sceneInteraction';
import '../styles/ScenePointerLayer.scss';

interface IPiece {
  emitter: IScenePointerEmitter;
  element?: IAmbientElement;
  colour: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  turn: number;
  age: number;
  life: number;
  /** Where in its flutter it started. */
  phase: number;
}

/** Pixels a second a piece leaves the hand at, from none to full speed. */
const SLOWEST = 30;
const FASTEST = 360;
/** Pixels a second a second that full gravity pulls a piece. */
const GRAVITY = 420;
/** How quickly a piece's own speed dies away, per second. */
const DRAG = 1.6;
/** Fading in, in seconds, and the share of its life it fades out over. */
const FADE_IN = 0.06;
const FADE_OUT = 0.4;
/** The shapes that are light, added to the scene rather than laid over it. */
const LIGHTS = new Set(['spark', 'bokeh', 'firefly', 'star']);
/**
 * Device pixels the canvas may hold: across a whole window on the Backdrop
 * at a ratio of 2 it was 15 million, cleared and composited every frame a
 * piece was in the air. The glows lose nothing a little under a ratio of 1.
 */
const PIXEL_BUDGET = 4_000_000;
/** How far past its box a gesture still throws, in CSS pixels. */
const REACH = 8;
/** The shapes that flutter as they fall: flat things in the air. */
const FLAT = new Set(['petal', 'blossom', 'leaf', 'bird', 'path', 'picture']);

const pick = <T,>(list: readonly T[], fallback: T): T =>
  list.length > 0 ? list[Math.floor(Math.random() * list.length)] : fallback;

interface IScenePointerLayerProps {
  /**
   * Where the hand's moves and taps come from, in page coordinates: the
   * scene's own surface (its interaction), or the whole window when the
   * scene is drawn behind the whole window (`windowGestures`).
   */
  gestures: TGestureSource;
  pointer: IScenePointer | undefined;
  /** The scene's elements in the window, which an emitter may throw. */
  ambient: ISceneAmbient | undefined;
  /** Its artwork, which a picture element's poses are cut from. */
  artwork: ISceneArtwork | undefined;
}

/**
 * What a visualizer throws from the viewer's hand (`common/scenePointer.ts`),
 * drawn over the scene on a canvas of its own the size of the scene's box: a
 * trail as the mouse crosses it, a burst where it is tapped. Every piece is
 * one of the window layer's own sprites or poses (`ambientSprites.ts`), so a
 * flower's thrown petals are the petals it floats round the app.
 *
 * Drawn only while something is in the air: the loop is started by a gesture
 * and ends with its last piece, so a still mouse costs nothing; each frame
 * clears only the rectangle the last one drew in, and the canvas is held to
 * a budget of pixels however large the window. Nothing is thrown for someone
 * who asked the app for less motion.
 */
export default function ScenePointerLayer({
  gestures,
  pointer,
  ambient,
  artwork,
}: IScenePointerLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Only the elements an emitter throws: pictures are cut for those alone.
  const thrown = useMemo(
    () =>
      ambient?.elements.filter((element) =>
        pointer?.emitters.some((emitter) => emitter.element === element.id),
      ),
    [ambient, pointer],
  );
  const pictures = useAmbientPictures(thrown, artwork);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !pointer) {
      return undefined;
    }
    const pieces: IPiece[] = [];
    // How far the hand has travelled toward each trail's next piece.
    const carried = new Map<IScenePointerEmitter, number>();
    let frame = 0;
    let last = 0;
    let ratio = 1;

    // What the last frame drew over, in device pixels: all the next clears.
    let dirty: [number, number, number, number] | undefined;

    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ratio = Math.max(
        0.75,
        Math.min(
          2,
          window.devicePixelRatio || 1,
          Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height)),
        ),
      );
      const w = Math.max(1, Math.round(width * ratio));
      const h = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const elementOf = (emitter: IScenePointerEmitter) =>
      emitter.element === undefined
        ? undefined
        : ambient?.elements.find((element) => element.id === emitter.element);

    const throwOne = (
      emitter: IScenePointerEmitter,
      x: number,
      y: number,
      heading: number,
    ) => {
      if (pieces.length >= MAX_POINTER_PIECES) {
        pieces.shift();
      }
      const element = elementOf(emitter);
      const angle =
        heading + (Math.random() - 0.5) * 2 * Math.PI * emitter.spread;
      const speed =
        (SLOWEST + (FASTEST - SLOWEST) * emitter.speed) *
        (0.6 + Math.random() * 0.8);
      const [small, large] = emitter.size;
      pieces.push({
        emitter,
        ...(element ? { element } : {}),
        colour: pick(
          emitter.colours.length > 0
            ? emitter.colours
            : (element?.colours ?? []),
          '#ffffff',
        ),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: small + (large - small) * Math.random(),
        angle: Math.random() * Math.PI * 2,
        turn: (Math.random() - 0.5) * 2 * emitter.spin * 6,
        age: 0,
        life: emitter.life * (0.75 + Math.random() * 0.5),
        phase: Math.random() * Math.PI * 2,
      });
    };

    const draw = () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      if (dirty) {
        const [x0, y0, x1, y1] = dirty;
        context.clearRect(x0, y0, x1 - x0, y1 - y0);
      }
      let drawn: [number, number, number, number] | undefined;
      pieces.forEach((piece) => {
        const shape = piece.element?.shape ?? piece.emitter.shape ?? 'spark';
        const fadeIn = Math.min(1, piece.age / FADE_IN);
        const fadeOut = Math.min(
          1,
          (piece.life - piece.age) / (piece.life * FADE_OUT),
        );
        const alpha = Math.max(0, fadeIn * fadeOut);
        if (alpha <= 0.002) {
          return;
        }
        // Its glow reaches past its size; the rectangle takes the widest.
        const reach = (piece.size * 1.6 * ratio) / 2 + 2;
        const px = piece.x * ratio;
        const py = piece.y * ratio;
        drawn = drawn
          ? [
              Math.min(drawn[0], px - reach),
              Math.min(drawn[1], py - reach),
              Math.max(drawn[2], px + reach),
              Math.max(drawn[3], py + reach),
            ]
          : [px - reach, py - reach, px + reach, py + reach];
        context.globalAlpha = alpha;
        context.globalCompositeOperation = LIGHTS.has(shape)
          ? 'lighter'
          : 'source-over';
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        if (FLAT.has(shape)) {
          // A flat thing in the air shows its edge as it turns over.
          const flutter = Math.cos(piece.age * 7 + piece.phase);
          context.scale(1, 0.35 + 0.65 * Math.abs(flutter));
        }
        if (shape === 'picture' && piece.element) {
          const poses = pictures.get(piece.element.id);
          const pose = poses?.[piece.element.rest ?? 0];
          const cut = piece.element.frames?.[piece.element.rest ?? 0];
          if (pose && cut) {
            const longer = Math.max(cut[2], cut[3]);
            const across = (piece.size * cut[2]) / longer;
            const down = (piece.size * cut[3]) / longer;
            context.drawImage(pose, -across / 2, -down / 2, across, down);
          }
          return;
        }
        const sprite = ambientSprite({
          shape,
          ...(piece.element?.path ? { path: piece.element.path } : {}),
          colour: piece.colour,
          size: piece.size,
          ratio,
        });
        if (sprite) {
          const { image, extent } = sprite;
          context.drawImage(image, -extent / 2, -extent / 2, extent, extent);
        }
      });
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      dirty = drawn && [
        Math.max(0, Math.floor(drawn[0])),
        Math.max(0, Math.floor(drawn[1])),
        Math.min(canvas.width, Math.ceil(drawn[2])),
        Math.min(canvas.height, Math.ceil(drawn[3])),
      ];
    };

    const step = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const slow = Math.exp(-DRAG * dt);
      for (let index = pieces.length - 1; index >= 0; index -= 1) {
        const piece = pieces[index];
        piece.age += dt;
        if (piece.age >= piece.life) {
          pieces.splice(index, 1);
        } else {
          piece.vx *= slow;
          piece.vy = piece.vy * slow + piece.emitter.gravity * GRAVITY * dt;
          piece.x += piece.vx * dt;
          piece.y += piece.vy * dt;
          piece.angle += piece.turn * dt;
        }
      }
      draw();
      frame = pieces.length > 0 ? requestAnimationFrame(step) : 0;
    };

    const onGesture = (gesture: TSceneGesture) => {
      if (prefersReducedMotion()) {
        return;
      }
      // Onto this canvas, and only where it is.
      const box = canvas.getBoundingClientRect();
      const x = gesture.x - box.left;
      const y = gesture.y - box.top;
      if (
        x < -REACH ||
        y < -REACH ||
        x > box.width + REACH ||
        y > box.height + REACH
      ) {
        return;
      }
      pointer.emitters.forEach((emitter) => {
        if (gesture.kind === 'tap' && emitter.on === 'tap') {
          // A burst, thrown upward and out as far round as the spread says.
          for (let count = 0; count < Math.round(emitter.amount); count += 1) {
            throwOne(emitter, x, y, -Math.PI / 2);
          }
        }
        if (gesture.kind === 'move' && emitter.on === 'move') {
          const travelled = Math.hypot(gesture.dx, gesture.dy);
          let owed =
            (carried.get(emitter) ?? 0) + (travelled * emitter.amount) / 100;
          // Left behind the hand, the way it came from.
          const heading = Math.atan2(-gesture.dy, -gesture.dx);
          while (owed >= 1) {
            owed -= 1;
            throwOne(emitter, x, y, heading);
          }
          carried.set(emitter, owed);
        }
      });
      if (pieces.length > 0 && frame === 0) {
        fit();
        dirty = [0, 0, canvas.width, canvas.height];
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };

    // Sized again whenever its box changes, before that frame is painted.
    // It was sized only as a trail began, so a box that changed under pieces
    // still in the air — a pane opening, the window going full screen, the
    // Backdrop's panes moving — kept the canvas at its old size stretched
    // over the new box until the last piece landed (Ivan, 2026-09-29: "the
    // sparks get stretched for a few seconds when the UI updates"). A new
    // size empties the canvas, so the next frame clears it all.
    const resized =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            fit();
            dirty = [0, 0, canvas.width, canvas.height];
          });
    resized?.observe(canvas);

    const stop = gestures(onGesture);
    return () => {
      resized?.disconnect();
      stop();
      cancelAnimationFrame(frame);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [gestures, pointer, ambient, pictures]);

  return pointer ? (
    <canvas ref={canvasRef} className="scene-pointer-layer" aria-hidden />
  ) : null;
}
