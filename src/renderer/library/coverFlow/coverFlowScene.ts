/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Cover Flow row in three.js: covers standing on a glossy floor over
 * their own fading reflections, turning through every angle as the row
 * moves, a sheen crossing each one as it turns, the covers further back
 * sinking into shade, and the light behind the row and on the floor taking
 * the colour of the album in front, blending across a turn.
 *
 * Loaded as a chunk of its own (`useCoverFlowScene` imports it), so three.js
 * is parsed only by a window that opens Cover Flow. The React view keeps the
 * listbox, the focus, every input and the caption in the DOM over this
 * canvas; the scene only draws, and answers which cover is under a point.
 *
 * Frames come from `requestAnimationFrame` and only while something moves —
 * the row gliding, a drag, the light blending, a picture arriving. At rest
 * nothing runs. Only the covers within `COVER_FLOW_WINDOW` of where the row
 * stands hold a texture, and each is given back as it leaves; `dispose`
 * gives back everything, the WebGL context included.
 */
import * as THREE from 'three';
import {
  CAMERA_FOV,
  CENTRE_Z,
  COVER_FLOW_WINDOW,
  coverFlowLayout,
  coverPlacement,
  glideToward,
  travelStart,
} from './coverFlowGeometry';
import type { ICoverFlowArtRequest } from './coverFlowArt';
import {
  type IArtEntry,
  artKeyOf,
  createCoverFlowArtCache,
} from './coverFlowArtCache';
import { type ICard, createCoverFlowWorld } from './coverFlowWorld';
import { spinPosition } from '../surpriseDraw/drawTiming';
/** A cover as the scene draws it; `undefined` while its page is out. */
export interface ICoverFlowSlot extends ICoverFlowArtRequest {
  id: string;
}

export interface ICoverFlowSource {
  count: number;
  itemAt: (index: number) => ICoverFlowSlot | undefined;
  /** The cover the music is coming from, wherever it is in the row. */
  playingId: string | undefined;
}

export interface ICoverFlowScene {
  /** What the row holds; read again on every call, cheap to repeat. */
  setSource: (source: ICoverFlowSource) => void;
  /** Where the row comes to rest. */
  setCentre: (index: number) => void;
  /** A drag's own fractional position, or undefined once it lets go. */
  setDrag: (position: number | undefined) => void;
  setHovered: (index: number | undefined) => void;
  /** The songs open under the row: the reflections give way to them. */
  setExpanded: (isExpanded: boolean) => void;
  setReducedMotion: (isReduced: boolean) => void;
  /** Which cover is drawn under a point, or failing that the nearest one
   * across — the whole strip above and below a cover is live. */
  coverAt: (clientX: number, clientY: number) => number | undefined;
  /** Puts the row at `index` at once, with no glide. */
  jumpTo: (index: number) => void;
  /**
   * Surprise me's draw (`drawTiming.ts`): the row runs from where it stands
   * to `to`, fast out and slow into the stop, calls `onLanded` as it stops,
   * holds there for `holdMs` and resolves. An abort, the scene being
   * disposed or the context lost ends it at once, standing on `to`.
   */
  spin: (request: ICoverFlowSpin) => Promise<void>;
  dispose: () => void;
}

export interface ICoverFlowSpin {
  to: number;
  spinMs: number;
  holdMs: number;
  onLanded: () => void;
  signal: AbortSignal;
}

export interface ICoverFlowSceneOptions {
  /** The element the canvas fills; its size is the scene's size. */
  host: HTMLElement;
  /** The first frame is on screen: the still picture can go. */
  onFirstFrame: () => void;
  /** The context was lost; `onRestored` follows when it can come back. */
  onLost: () => void;
  onRestored: () => void;
}

/** New textures shown per frame, nearest first, so a flick through covers
 * nobody has seen yet never puts a whole window of uploads in one frame. */
const UPLOADS_PER_FRAME = 3;
/** Kept a little past the drawn window, so a cover stepping out and back in
 * is not decoded twice. */
const KEEP_MARGIN = 2;

export const createCoverFlowScene = (
  options: ICoverFlowSceneOptions,
): ICoverFlowScene => {
  const { host } = options;
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'library-coverflow__canvas';
  host.appendChild(canvas);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const {
    world,
    glow,
    accent,
    artColours,
    halo,
    reflectionStrength,
    light,
    sleeve,
    makeCard,
    dispose: disposeWorld,
  } = createCoverFlowWorld(host);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 80);
  const glowTarget = accent.clone();

  const cards = new Map<number, ICard>();
  const spare: ICard[] = [];
  let isDisposed = false;
  let isLost = false;

  let source: ICoverFlowSource = {
    count: 0,
    itemAt: () => undefined,
    playingId: undefined,
  };
  let position = 0;
  let target = 0;
  let hasCentre = false;
  let drag: number | undefined;
  let hovered: number | undefined;
  let isExpanded = false;
  let isReduced = false;
  let frame = 0;
  let lastTime = 0;
  /** The last frame's own clock, which a spin's elapsed time is read from. */
  let frameNow = 0;
  let isFirstFrameShown = false;
  /** A Surprise me spin in progress; it owns the row's position. */
  let spinning:
    | {
        from: number;
        to: number;
        spinMs: number;
        holdMs: number;
        startedAt: number | undefined;
        isLanded: boolean;
        onLanded: () => void;
        finish: () => void;
      }
    | undefined;

  const request = () => {
    if (frame === 0 && !isDisposed && !isLost) {
      frame = requestAnimationFrame(step);
    }
  };

  const pictures = createCoverFlowArtCache({
    anisotropy,
    colours: artColours,
    onReady: () => request(),
  });

  const place = () => {
    const centre = Math.round(position);
    const first = Math.max(0, centre - COVER_FLOW_WINDOW);
    const last = Math.min(source.count - 1, centre + COVER_FLOW_WINDOW);
    cards.forEach((card, index) => {
      if (index < first || index > last) {
        card.group.visible = false;
        spare.push(card);
        cards.delete(index);
      }
    });
    const kept = new Set<string>();
    const slots: { index: number; slot: ICoverFlowSlot }[] = [];
    for (
      let index = Math.max(0, first - KEEP_MARGIN);
      index <= Math.min(source.count - 1, last + KEEP_MARGIN);
      index += 1
    ) {
      const slot = source.itemAt(index);
      if (slot) {
        kept.add(artKeyOf(slot));
        slots.push({ index, slot });
      }
    }
    // Nearest first, so the decodes and the uploads reach the centre first.
    slots.sort(
      (a, b) => Math.abs(a.index - position) - Math.abs(b.index - position),
    );
    pictures.beginFrame();
    let uploads = 0;
    const shown = new Map<number, IArtEntry>();
    slots.forEach(({ index, slot }) => {
      const entry = pictures.entryFor(slot, Math.abs(index - target));
      if (entry.ready && uploads < UPLOADS_PER_FRAME) {
        pictures.upload(entry);
        uploads += 1;
      }
      shown.set(index, entry);
    });
    pictures.endFrame(kept);
    for (let index = first; index <= last; index += 1) {
      let card = cards.get(index);
      if (!card) {
        card = spare.pop() ?? makeCard();
        cards.set(index, card);
      }
      const offset = index - position;
      const placed = coverPlacement(offset, index === hovered);
      const { group, cover, reflection, mesh } = card;
      group.visible = true;
      group.position.set(placed.x, 0, placed.z);
      group.rotation.y = placed.rotationY;
      mesh.renderOrder = placed.renderOrder;
      group.children[1].renderOrder = placed.renderOrder - 200;
      cover.uniforms.uShade.value = placed.shade;
      cover.uniforms.uSaturation.value = placed.saturation;
      cover.uniforms.uSheen.value = -placed.side * placed.turn;
      reflection.uniforms.uShade.value = placed.shade;
      const entry = shown.get(index);
      cover.uniforms.uMap.value = entry?.texture ?? sleeve;
      const slot = source.itemAt(index);
      cover.uniforms.uRing.value =
        slot !== undefined && slot.id === source.playingId ? 1 : 0;
    }
    return uploads;
  };

  /** The light leans towards the album in front, blended across a turn. */
  const glowFor = (): THREE.Color => {
    const colourAt = (index: number): THREE.Color => {
      const slot = source.itemAt(index);
      return (slot && pictures.glowOf(slot)) ?? accent;
    };
    const low = Math.max(0, Math.floor(position));
    const high = Math.min(source.count - 1, Math.ceil(position));
    return glowTarget
      .copy(colourAt(low))
      .lerp(colourAt(Math.max(low, high)), position - Math.floor(position));
  };

  const render = (seconds: number): boolean => {
    if (spinning) {
      // Timed from its first drawn frame, so the covers it starts on have had
      // that frame to be asked for.
      spinning.startedAt ??= frameNow;
      const elapsed = frameNow - spinning.startedAt;
      position = spinPosition(
        spinning.from,
        spinning.to,
        elapsed,
        spinning.spinMs,
      );
      target = spinning.to;
      if (!spinning.isLanded && elapsed >= spinning.spinMs) {
        spinning.isLanded = true;
        spinning.onLanded();
      }
      if (elapsed >= spinning.spinMs + spinning.holdMs) {
        spinning.finish();
      }
    } else if (drag !== undefined) {
      position = drag;
    } else if (isReduced) {
      position = target;
    } else {
      position = glideToward(position, target, seconds);
    }
    const strength = isExpanded ? 0 : 1;
    reflectionStrength.value = isReduced
      ? strength
      : glideToward(reflectionStrength.value, strength, seconds);
    const uploads = place();
    const wanted = glowFor();
    if (isReduced) {
      glow.copy(wanted);
    } else {
      glow.lerp(wanted, 1 - Math.exp(-seconds * 6));
    }
    // The window's side, read as it is drawn: a light window pales the row
    // instead of shading it, and lays a grey shadow, not a coloured one.
    light.value =
      document.documentElement.getAttribute('data-window-ink') === 'dark'
        ? 1
        : 0;
    renderer.render(world, camera);
    // Handed over only once the centre cover wears its own picture (or has
    // none to wait for): the still picture under the canvas shows it until
    // then, and an empty sleeve in its place would be a blink.
    if (!isFirstFrameShown) {
      const centreSlot = source.itemAt(Math.round(target));
      if (
        source.count === 0 ||
        centreSlot === undefined ||
        pictures.hasTexture(centreSlot)
      ) {
        isFirstFrameShown = true;
        options.onFirstFrame();
      }
    }
    const glowGap =
      Math.abs(glow.r - wanted.r) +
      Math.abs(glow.g - wanted.g) +
      Math.abs(glow.b - wanted.b);
    const isWaiting = pictures.isWaiting();
    return (
      spinning !== undefined ||
      (drag === undefined && position !== target) ||
      reflectionStrength.value !== strength ||
      glowGap > 0.002 ||
      uploads > 0 ||
      isWaiting
    );
  };

  function step(now: number) {
    frame = 0;
    const seconds =
      lastTime === 0 ? 1 / 60 : Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    frameNow = now;
    if (render(seconds)) {
      request();
    } else {
      lastTime = 0;
    }
  }

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    renderer.setSize(width, height, false);
    const layout = coverFlowLayout(width, height);
    camera.aspect = width / height;
    camera.position.set(0, layout.height, CENTRE_Z + layout.distance);
    camera.lookAt(0, 0, CENTRE_Z);
    camera.setViewOffset(width, height, 0, layout.shiftY, width, height);
    camera.updateProjectionMatrix();
    halo.uniforms.uAspect.value = width / height;
    // Drawn now, before the browser paints the new size: a canvas resized
    // and left for the next frame shows one frame stretched or blank, and
    // during the panel's 340 ms opening that is every frame.
    if (!isDisposed && !isLost) {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (render(lastTime === 0 ? 0 : 1 / 60)) {
        request();
      }
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const onLost = (event: Event) => {
    // Kept restorable: without this the browser never offers it back.
    event.preventDefault();
    isLost = true;
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    // No frame will come to finish a spin on a lost context.
    spinning?.finish();
    options.onLost();
  };
  const onRestored = () => options.onRestored();
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const projected = new THREE.Vector3();

  return {
    setSource: (next) => {
      source = next;
      request();
    },
    setCentre: (index) => {
      if (!hasCentre) {
        hasCentre = true;
        position = index;
      } else if (drag === undefined) {
        position = travelStart(position, index);
      }
      target = index;
      request();
    },
    setDrag: (next) => {
      drag = next;
      request();
    },
    setHovered: (index) => {
      if (hovered !== index) {
        hovered = index;
        request();
      }
    },
    setExpanded: (next) => {
      isExpanded = next;
      request();
    },
    setReducedMotion: (next) => {
      isReduced = next;
      request();
    },
    coverAt: (clientX, clientY) => {
      const box = canvas.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        return undefined;
      }
      pointer.set(
        ((clientX - box.left) / box.width) * 2 - 1,
        -((clientY - box.top) / box.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const drawn = Array.from(cards.entries()).filter(
        ([, card]) => card.group.visible,
      );
      // The cover drawn on top wins where two overlap: three sorts the hits
      // by distance, and the nearer one is the one drawn over the other.
      const hit = raycaster.intersectObjects(
        drawn.map(([, card]) => card.mesh),
        false,
      )[0];
      if (hit) {
        const found = drawn.find(([, card]) => card.mesh === hit.object);
        if (found) {
          return found[0];
        }
      }
      let best: number | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;
      drawn.forEach(([index, card]) => {
        card.group.getWorldPosition(projected).project(camera);
        const x = box.left + ((projected.x + 1) / 2) * box.width;
        const distance = Math.abs(clientX - x);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    },
    jumpTo: (index) => {
      hasCentre = true;
      position = index;
      target = index;
      request();
    },
    spin: ({ to, spinMs, holdMs, onLanded, signal }) =>
      new Promise<void>((resolve) => {
        spinning?.finish();
        if (signal.aborted || isDisposed || isLost) {
          resolve();
          return;
        }
        const finish = () => {
          signal.removeEventListener('abort', finish);
          if (spinning === current) {
            spinning = undefined;
            position = to;
            target = to;
            request();
          }
          resolve();
        };
        const current = {
          from: position,
          to,
          spinMs: isReduced ? 0 : spinMs,
          holdMs,
          startedAt: undefined,
          isLanded: false,
          onLanded,
          finish,
        };
        spinning = current;
        signal.addEventListener('abort', finish, { once: true });
        request();
      }),
    dispose: () => {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      spinning?.finish();
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      pictures.dispose();
      [...cards.values(), ...spare].forEach((card) => {
        card.cover.dispose();
        card.reflection.dispose();
      });
      cards.clear();
      spare.length = 0;
      disposeWorld();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
};
