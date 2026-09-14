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
import {
  outermostBoxes,
  visualizerBoxes,
  type IVisualizerBox,
} from '../ambient/visualizerSurfaces';
import { useSelectedLookId } from '../utils/graphStyle';
import {
  subscribeSceneLeft,
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

/**
 * How quickly the light goes once its scene has: the page the scene stood on
 * has already been swapped for another, and light settling around a place
 * where nothing is any more is the old page seeming to linger. The app's
 * `$motion-base` and `$ease-out` (`_motion.scss`).
 */
const PUT_OUT_MS = 220;
const PUT_OUT_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

const VOICES: readonly TScenePulseVoice[] = ['bass', 'mid', 'treble'];

type TGlows = Partial<Record<TScenePulseVoice, HTMLSpanElement>>;

/** Whether any swell is still on screen, rising, settling or being put out. */
const isLit = (glows: TGlows) =>
  VOICES.some((voice) => (glows[voice]?.getAnimations?.().length ?? 0) > 0);

/**
 * Puts out the light of a scene that has gone: every swell still settling
 * fades from where it has reached.
 */
const putOut = (glows: TGlows) => {
  VOICES.forEach((voice) => {
    const glow = glows[voice];
    const running = glow?.getAnimations?.() ?? [];
    if (!glow || running.length === 0) {
      return;
    }
    const now = getComputedStyle(glow);
    const opacity = Number(now.opacity);
    running.forEach((animation) => animation.cancel());
    if (!(opacity > 0)) {
      return;
    }
    glow.animate(
      [
        { transform: now.transform, opacity },
        { transform: now.transform, opacity: 0 },
      ],
      { duration: PUT_OUT_MS, easing: PUT_OUT_EASING },
    );
  });
};

/** The corners the hole is cut with: about a card's, and never a sharp one. */
const HOLE_RADIUS = 12;

const round = (value: number) => Math.round(value * 10) / 10;

const holeFor = ({ left: x, top: y, width, height }: IVisualizerBox) => {
  const r = Math.min(HOLE_RADIUS, width / 2, height / 2);
  return [
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
};

/**
 * The whole window with every visualizer on screen cut out of it, as a clip
 * path (`visualizerSurfaces.ts`). The light is the room's, not the pictures':
 * lit over, a scene's own dark background turned grey and its space stopped
 * looking deep, and the same light over the gallery's pictures and the graph
 * greyed them too.
 *
 * One hole per place: a box inside another is dropped, since under `evenodd`
 * the second outline would put the light back inside the first.
 */
const cutFor = (boxes: readonly IVisualizerBox[]) => {
  if (boxes.length === 0) {
    return 'none';
  }
  const { innerWidth: w, innerHeight: h } = window;
  const holes = outermostBoxes(boxes).map(holeFor).join(' ');
  return `path(evenodd, 'M0 0H${w}V${h}H0Z ${holes}')`;
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
 * How far a glow's running transform has grown, as a share of the full swell
 * for the scene at `scaleX` — from the matrix the browser reports for it, whose
 * first entry is the horizontal scale since a glow never rotates. Undefined
 * when there is no matrix to read.
 */
const shareOf = (transform: string, scaleX: number) => {
  const match = /^matrix\(\s*([-+\d.e]+)/.exec(transform);
  return match && scaleX > 0 ? Number(match[1]) / scaleX : undefined;
};

/**
 * The window glowing with the scene on screen — the third of the three
 * things a scene can do to the window, after nothing and its colours.
 *
 * Ambient light, as if the app were the room the visualizer is playing in.
 * About once a bar (`scenePulse.ts`) the scene's colour swells softly out of
 * it onto the panels around it and settles again — around it only: the
 * scene's own box is cut out of the light, so its background and its space
 * stay exactly as the scene draws them, and so is every other visualizer on
 * screen, the graph and the library's pictures. What the swell looks like comes
 * from the scene, so no two visualizers glow alike: it starts from the
 * scene's own box, its colours are the ones the scene lent the window — its
 * main colour when the bass carries the beat, its "on" colour on the treble,
 * the colour between them on the mids — and it is only as bright as the
 * music is loud.
 *
 * Built to cost nothing between swells and next to nothing on one: three
 * layers, one per colour, invisible at rest and animated by the compositor on
 * transform and opacity alone — no layout moves, and the one style written is
 * the clip, only on a frame where a visualizer under the light has moved. A
 * new swell in another colour crossfades with the last as it settles. While
 * the mode is anything else it is not in the page at all.
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
  const glowsRef = useRef<TGlows>({});

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
    let following = 0;
    // The clip, written only when a visualizer has moved, come or gone.
    const recut = () => {
      const layer = layerRef.current;
      const next = cutFor(
        visualizerBoxes(window.innerWidth, window.innerHeight),
      );
      if (layer && next !== cut) {
        cut = next;
        layer.style.clipPath = next;
      }
    };
    // Every frame a swell is on screen, and only then: a gallery scrolled or
    // a page swapped mid-swell moves the pictures out from under holes cut
    // where they were. Between swells the layer is dark and nothing runs.
    const follow = () => {
      following = 0;
      if (!isLit(glowsRef.current)) {
        return;
      }
      recut();
      following = requestAnimationFrame(follow);
    };
    const startFollowing = () => {
      recut();
      if (!following) {
        following = requestAnimationFrame(follow);
      }
    };
    const stopLeft = subscribeSceneLeft((from) => {
      if (from === source) {
        putOut(glowsRef.current);
        startFollowing();
      }
    });
    const stopPulses = subscribeScenePulse((pulse) => {
      const { source: from, strength, voice, origin } = pulse;
      const glow = glowsRef.current[voice];
      const layer = layerRef.current;
      if (from !== source || !glow || !layer || document.hidden) {
        return;
      }
      // Placed and sized by the animation's own transform, so a glow around
      // a scene somewhere new writes no style and lays nothing out.
      const { at, scaleX, scaleY } = glowFrom(origin, glow.offsetWidth);
      const scaled = (share: number) =>
        `${at} scale(${scaleX * share}, ${scaleY * share})`;
      // A swell that arrives while the last one in its colour is still
      // settling carries on from the light that is there. Started from dark,
      // it cut a lit window to black in a single frame and then lit it again:
      // four beats come round in two seconds at 120 BPM and a swell takes 3.2
      // to settle, so that was nearly every swell of a steady song. Read once
      // a swell, from the running animation, before it is replaced.
      let startTransform = scaled(0.45);
      let lit = 0;
      let reach = 0.9;
      const running = glow.getAnimations?.() ?? [];
      if (running.length > 0) {
        const now = getComputedStyle(glow);
        const share = shareOf(now.transform, scaleX);
        if (share !== undefined) {
          startTransform = now.transform;
          // On from wherever it has reached, within the one swell's own
          // size: carried on unbounded, every swell of a song pushed the pool
          // wider than the last until its light was spread thin across
          // nothing.
          reach = Math.min(Math.max(0.9, share + 0.02), 1.0);
        }
        const opacity = Number(now.opacity);
        lit = Number.isFinite(opacity) ? opacity : 0;
        running.forEach((animation) => animation.cancel());
      }
      // Grows out of the scene as it brightens, so the light travels from the
      // visualizer across the app before it settles; never dimmer on its way
      // up than the light it took over.
      glow.animate(
        [
          { transform: startTransform, opacity: lit },
          {
            transform: scaled(reach),
            opacity: Math.max(strength, lit),
            offset: 0.35,
          },
          { transform: scaled(1.05), opacity: 0 },
        ],
        { duration: GLOW_MS, easing: SWELL },
      );
      startFollowing();
    });
    const glows = glowsRef.current;
    return () => {
      stopPulses();
      stopLeft();
      cancelAnimationFrame(following);
      // The window's light changing hands, the Studio closing onto the
      // graph's, keeps this layer in the page: what the Studio lit goes with
      // it rather than settling over the page that replaced it, and the clip
      // is cut around what that page shows.
      putOut(glows);
      recut();
    };
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
