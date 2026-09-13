/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import { useSelectedLookId } from '../utils/graphStyle';
import {
  subscribeScenePulse,
  type TScenePulseSource,
  type TScenePulseVoice,
} from '../utils/scenePulse';
import {
  useSceneTintMode,
  useStudioTintMode,
  useStudioTintSource,
} from '../utils/sceneTintStore';
import '../styles/ScenePulse.scss';

/**
 * The glow's shape, not a schedule: nothing waits on it. Long and eased at
 * both ends, so it swells and settles like light rather than flashing; a
 * second-long pulse was sent back as too fast.
 */
const GLOW_MS = 3200;
const SWELL = 'cubic-bezier(0.37, 0, 0.63, 1)';

const VOICES: readonly TScenePulseVoice[] = ['bass', 'mid', 'treble'];

/** The corners the hole is cut with: about a card's, and never a sharp one. */
const HOLE_RADIUS = 12;

/**
 * The whole window with the scene's box cut out of it, as a clip path. The
 * light is the room's, not the picture's: lit over, a scene's own dark
 * background turned grey and its space stopped looking deep.
 */
const holeFor = (scene: DOMRect | undefined) => {
  if (!scene) {
    return 'none';
  }
  const { innerWidth: w, innerHeight: h } = window;
  const r = Math.min(HOLE_RADIUS, scene.width / 2, scene.height / 2);
  const { left: x, top: y, width, height } = scene;
  const round = (value: number) => Math.round(value * 10) / 10;
  const hole = [
    `M${round(x + r)} ${round(y)}`,
    `H${round(x + width - r)}`,
    `A${r} ${r} 0 0 1 ${round(x + width)} ${round(y + r)}`,
    `V${round(y + height - r)}`,
    `A${r} ${r} 0 0 1 ${round(x + width - r)} ${round(y + height)}`,
    `H${round(x + r)}`,
    `A${r} ${r} 0 0 1 ${round(x)} ${round(y + height - r)}`,
    `V${round(y + r)}`,
    `A${r} ${r} 0 0 1 ${round(x + r)} ${round(y)}Z`,
  ].join(' ');
  return `path(evenodd, 'M0 0H${w}V${h}H0Z ${hole}')`;
};

/**
 * How far the light reaches, past an ellipse through the window's farthest
 * corner: at 1 that corner was left dark, with the light ending exactly on
 * it, and the far side of the app read as untouched.
 */
const REACH = 1.3;

/**
 * The place and size of one glow from a scene, for its animation: centred on
 * the scene, and wide and tall enough that its light still reaches the
 * window's corners — so the whole app is lit, not just what is beside the
 * scene.
 */
const glowFrom = (scene: DOMRect | undefined, base: number) => {
  const { innerWidth: w, innerHeight: h } = window;
  const x = scene ? scene.left + scene.width / 2 : w / 2;
  const y = scene ? scene.top + scene.height / 2 : h / 2;
  // An ellipse √2 times the farthest edge on each axis passes through the
  // farthest corner.
  const across = 2 * Math.SQRT2 * REACH;
  return {
    at: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
    scaleX: (across * Math.max(x, w - x)) / base,
    scaleY: (across * Math.max(y, h - y)) / base,
  };
};

/**
 * The window glowing with the scene on screen — the third of the three
 * things a scene can do to the window, after nothing and its colours.
 *
 * Ambient light, as if the app were the room the visualizer is playing in.
 * About once a bar (`scenePulse.ts`) the scene's colour swells softly out of
 * it onto the panels around it and settles again — around it only: the
 * scene's own box is cut out of the light, so its background and its space
 * stay exactly as the scene draws them. What the swell looks like comes
 * from the scene, so no two visualizers glow alike: it starts from the
 * scene's own box, its colours are the ones the scene lent the window — its
 * main colour when the bass carries the beat, its "on" colour on the treble,
 * the colour between them on the mids — and it is only as bright as the
 * music is loud.
 *
 * Built to cost nothing between swells and next to nothing on one: three
 * layers, one per colour, invisible at rest and animated by the compositor on
 * transform and opacity alone — no style is written, no layout moves, nothing
 * repaints. A new swell in another colour crossfades with the last as it
 * settles. While the mode is anything else it is not in the page at all.
 *
 * The Studio's mode governs while a project owns the window's colour, the
 * graph's otherwise — the same precedence as the colour itself (`SceneTint`).
 */
export default function ScenePulse() {
  const graphMode = useSceneTintMode();
  const studioMode = useStudioTintMode();
  const studio = useStudioTintSource();
  const lookId = useSelectedLookId();
  const layerRef = useRef<HTMLDivElement>(null);
  const glowsRef = useRef<Partial<Record<TScenePulseVoice, HTMLSpanElement>>>(
    {},
  );

  const isSceneLook = isPremiumLookId(lookId) || isMemberLookId(lookId);
  let source: TScenePulseSource | undefined;
  if (studio) {
    source = studioMode === 'pulse' ? 'studio' : undefined;
  } else if (graphMode === 'pulse' && isSceneLook) {
    source = 'graph';
  }

  // Not stood down for `prefers-reduced-motion`, unlike the app's entrances:
  // the glow is the whole of a mode somebody picked by name, and Windows
  // reports reduced motion for everybody who has switched its animation
  // effects off — which would have made Ambient look exactly like Colours. It
  // moves nothing across the screen either; it brightens and fades.
  useEffect(() => {
    if (!source) {
      return undefined;
    }
    let cut = '';
    return subscribeScenePulse(({ source: from, strength, voice, origin }) => {
      const glow = glowsRef.current[voice];
      const layer = layerRef.current;
      if (from !== source || !glow || !layer || document.hidden) {
        return;
      }
      // Written only when the scene has moved or the window changed size
      // since the last swell: one clip for the layer, never per frame.
      const nextCut = holeFor(origin);
      if (nextCut !== cut) {
        cut = nextCut;
        layer.style.clipPath = nextCut;
      }
      // Placed and sized by the animation's own transform, so a glow around
      // a scene somewhere new writes no style and lays nothing out.
      const { at, scaleX, scaleY } = glowFrom(origin, glow.offsetWidth);
      const scaled = (share: number) =>
        `${at} scale(${scaleX * share}, ${scaleY * share})`;
      // Grows out of the scene as it brightens, so the light travels from the
      // visualizer across the app before it settles.
      glow.animate(
        [
          { transform: scaled(0.45), opacity: 0 },
          { transform: scaled(0.9), opacity: strength, offset: 0.35 },
          { transform: scaled(1.05), opacity: 0 },
        ],
        { duration: GLOW_MS, easing: SWELL },
      );
    });
  }, [source]);

  if (!source) {
    return null;
  }
  return createPortal(
    <div ref={layerRef} className="scene-pulse" aria-hidden="true">
      {VOICES.map((voice) => (
        <span
          key={voice}
          ref={(element) => {
            glowsRef.current[voice] = element ?? undefined;
          }}
          className={`scene-pulse__glow scene-pulse__glow--${voice}`}
        />
      ))}
    </div>,
    document.body,
  );
}
