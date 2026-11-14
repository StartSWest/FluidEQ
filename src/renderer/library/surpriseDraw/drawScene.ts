/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Surprise me's draw, in three.js: a ring of covers in depth that spins,
 * slows and stops with the pick in front, the pick stepping forward under an
 * accent halo while the rest step back, and the pick flying into the
 * player's cover.
 *
 * Loaded as a chunk of its own (`SurpriseDrawLayer` imports it on demand),
 * so three.js is parsed by a window only once somebody asks for a surprise.
 * Two dozen quads and their reflections, one draw call each; the renderer,
 * every texture, material and the WebGL context itself are given back the
 * moment the draw ends, however it ends, so nothing keeps the graphics card
 * busy after it.
 *
 * Every frame comes from `requestAnimationFrame` and is placed by how long
 * the draw has run (`drawTiming.ts`); the flight and the fades are the Web
 * Animations API, whose `finished` is what ends the draw.
 */
import * as THREE from 'three';
import { DRAW_COVER_EDGE, type TDrawCover } from './drawCovers';
import {
  DRAW_FLY_MS,
  cardAngle,
  cardLight,
  drawFrameAt,
  easeOutBack,
  ringRadius,
  stopRotation,
} from './drawTiming';

export interface ISurpriseDrawScene {
  /** The layer the draw is laid in, over the shelf; emptied when it ends. */
  host: HTMLElement;
  covers: readonly TDrawCover[];
  pickIndex: number;
  /** The song and its genre, under the pick as it lands. */
  caption: { title: string; detail: string };
  /** The player's cover, where the pick flies; read when the flight starts.
   * Undefined where no player shows one, and the pick fades where it stands. */
  landing: () => DOMRect | undefined;
  /** Ends the draw at once: a skip, another surprise, the shelf going away. */
  signal: AbortSignal;
}

/** Faded in from the card's foot: a floor, not a second card. */
const reflectionFade = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, '#000');
    gradient.addColorStop(1, '#fff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 64);
  }
  return new THREE.CanvasTexture(canvas);
};

const halo = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
};

/**
 * A cover as a texture. A bitmap is uploaded the way it was decoded — WebGL
 * flips no `ImageBitmap` — so it is turned upright in the texture's own
 * transform instead; a canvas is flipped on upload as three does by default.
 */
const coverTexture = (cover: TDrawCover): THREE.Texture => {
  const texture =
    cover instanceof HTMLCanvasElement
      ? new THREE.CanvasTexture(cover)
      : new THREE.Texture(cover);
  if (!(cover instanceof HTMLCanvasElement)) {
    texture.flipY = false;
    texture.repeat.set(1, -1);
    texture.offset.set(0, 1);
    texture.needsUpdate = true;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/**
 * The accent the halo wears: the app's own, which a scene's tint can move.
 * The layer's `color` is the accent (`_librarySurpriseDraw.scss`), and the
 * computed colour comes back as `rgb()` or, mixed, as `color(srgb …)`,
 * neither of which needs three to understand the theme's own notation.
 */
const accentColour = (host: HTMLElement): THREE.Color => {
  const value = getComputedStyle(host).color;
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value);
  // Channels as the page has them, in sRGB: three takes bare numbers as
  // linear and would wash the accent out.
  if (rgb) {
    return new THREE.Color().setRGB(
      Number(rgb[1]) / 255,
      Number(rgb[2]) / 255,
      Number(rgb[3]) / 255,
      THREE.SRGBColorSpace,
    );
  }
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (srgb) {
    return new THREE.Color().setRGB(
      Number(srgb[1]),
      Number(srgb[2]),
      Number(srgb[3]),
      THREE.SRGBColorSpace,
    );
  }
  return new THREE.Color('#00e5cf');
};

/**
 * Plays the draw to its end, or until `signal` aborts or the window is
 * hidden. Rejects only when the scene cannot be built at all (no WebGL),
 * having given back whatever it had made — the caller shows the plain fade
 * instead.
 */
export const playSurpriseDraw = (scene: ISurpriseDrawScene): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const { host, signal } = scene;
    const cleanups: (() => void)[] = [];
    let isFinished = false;
    const finish = () => {
      if (isFinished) {
        return;
      }
      isFinished = true;
      cleanups
        .splice(0)
        .reverse()
        .forEach((cleanup) => cleanup());
      host.replaceChildren();
      resolve();
    };
    if (signal.aborted) {
      finish();
      return;
    }
    signal.addEventListener('abort', finish, { once: true });
    cleanups.push(() => signal.removeEventListener('abort', finish));
    // Hidden, no frame comes: the draw would wait on a window nobody sees
    // with its context held. It ends instead; the song plays on regardless.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        finish();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() =>
      document.removeEventListener('visibilitychange', onVisibility),
    );
    try {
      build(scene, cleanups, finish, () => isFinished);
    } catch (error: unknown) {
      finish();
      reject(error);
    }
  });

/** The scene and its frames; every resource it makes goes on `cleanups`. */
const build = (
  scene: ISurpriseDrawScene,
  cleanups: (() => void)[],
  finish: () => void,
  hasFinished: () => boolean,
): void => {
  const { host, covers, pickIndex, caption, landing } = scene;
  const box = host.getBoundingClientRect();
  // The layer's own CSS size against its drawn size: any zoom between them.
  const zoom = box.width / Math.max(1, host.offsetWidth);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  cleanups.push(() => {
    renderer.dispose();
    renderer.forceContextLoss();
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(box.width, box.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'library-surprise-draw__canvas';
  host.appendChild(renderer.domElement);

  const count = covers.length;
  const radius = ringRadius(count);
  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    34,
    box.width / Math.max(1, box.height),
    0.1,
    60,
  );
  camera.position.set(0, 0.42, radius + 3.7);
  camera.lookAt(0, -0.12, radius);
  // Projected before the first render (the caption's place), so the
  // camera's matrices are made now rather than by that render.
  camera.updateMatrixWorld();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const fade = reflectionFade();
  const glowMap = halo();
  cleanups.push(() => {
    geometry.dispose();
    fade.dispose();
    glowMap.dispose();
  });

  const ring = new THREE.Group();
  world.add(ring);
  const cards = covers.map((cover, index) => {
    const texture = coverTexture(cover);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
    // three flips the culling of a mirrored object itself, so the
    // reflection keeps the default face.
    const mirrorMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.24,
      alphaMap: fade,
      depthWrite: false,
    });
    const holder = new THREE.Group();
    const angle = cardAngle(index, count);
    holder.rotation.y = angle;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = radius;
    const mirror = new THREE.Mesh(geometry, mirrorMaterial);
    mirror.position.set(0, -1.06, radius);
    mirror.scale.y = -1;
    holder.add(mesh, mirror);
    ring.add(holder);
    cleanups.push(() => {
      texture.dispose();
      material.dispose();
      mirrorMaterial.dispose();
    });
    return { holder, mesh, mirror, material, mirrorMaterial, angle };
  });
  const picked = cards[pickIndex];
  if (!picked) {
    finish();
    return;
  }
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: glowMap,
    color: accentColour(host),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  cleanups.push(() => glowMaterial.dispose());
  const glow = new THREE.Mesh(geometry, glowMaterial);
  glow.scale.setScalar(2.05);
  glow.position.z = radius - 0.05;
  picked.holder.add(glow);

  const stop = stopRotation(picked.angle);
  const label = document.createElement('div');
  label.className = 'library-surprise-draw__caption';
  const title = document.createElement('b');
  title.textContent = caption.title;
  const detail = document.createElement('span');
  detail.textContent = caption.detail;
  label.append(title, detail);
  label.style.opacity = '0';
  host.appendChild(label);

  /** Where a card stands on the layer, in the layer's own pixels. */
  const placeOf = (mesh: THREE.Object3D) => {
    const [topLeft, bottomRight] = [
      [-0.5, 0.5],
      [0.5, -0.5],
    ].map(([x, y]) =>
      new THREE.Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera),
    );
    const width = host.offsetWidth;
    const height = host.offsetHeight;
    const left = ((topLeft.x + 1) / 2) * width;
    const top = ((1 - topLeft.y) / 2) * height;
    return {
      left,
      top,
      width: ((bottomRight.x + 1) / 2) * width - left,
      height: ((1 - bottomRight.y) / 2) * height - top,
    };
  };

  const fly = () => {
    const from = placeOf(picked.mesh);
    const flyer = document.createElement('canvas');
    flyer.className = 'library-surprise-draw__flyer';
    flyer.width = DRAW_COVER_EDGE;
    flyer.height = DRAW_COVER_EDGE;
    flyer
      .getContext('2d')
      ?.drawImage(covers[pickIndex], 0, 0, flyer.width, flyer.height);
    flyer.style.width = `${from.width}px`;
    flyer.style.height = `${from.height}px`;
    host.appendChild(flyer);
    picked.mesh.visible = false;
    glow.visible = false;
    renderer.render(world, camera);
    const layer = host.getBoundingClientRect();
    const end = landing();
    const start = `translate(${from.left}px, ${from.top}px) scale(1)`;
    // Into the player's cover; where no player shows one, the pick lets go
    // where it stands. Flown to the layer instead, it doubled in size on its
    // way to the shelf's corner.
    const arrival = end
      ? {
          transform: `translate(${(end.left - layer.left) / zoom}px, ${
            (end.top - layer.top) / zoom
          }px) scale(${end.width / zoom / Math.max(1, from.width)})`,
          opacity: 0.9,
        }
      : {
          transform: `translate(${from.left + from.width * 0.04}px, ${
            from.top + from.height * 0.04
          }px) scale(0.92)`,
          opacity: 0,
        };
    const flight = flyer.animate([{ transform: start }, arrival], {
      duration: DRAW_FLY_MS,
      easing: 'cubic-bezier(0.5, 0, 0.2, 1)',
      fill: 'forwards',
    });
    [renderer.domElement, label].forEach((element) =>
      element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: DRAW_FLY_MS * 0.6,
        fill: 'forwards',
      }),
    );
    host.classList.add('is-leaving');
    cleanups.push(() => host.classList.remove('is-leaving'));
    flight.finished.then(finish, finish);
  };

  let started: number | undefined;
  let isCaptioned = false;
  const frame = (now: number) => {
    if (hasFinished()) {
      return;
    }
    started ??= now;
    const at = drawFrameAt(now - started, stop);
    ring.rotation.y = at.rotation;
    cards.forEach((card) => {
      const light = cardLight(card.angle, at.rotation);
      card.material.color.setScalar(light);
      card.mirrorMaterial.color.setScalar(light);
      // A stretch that sells the speed and is gone by the stop.
      card.mesh.scale.x = 1 + at.speed * 0.14;
    });
    if (at.landing > 0) {
      const grown = 1 + 0.18 * easeOutBack(at.landing);
      picked.mesh.scale.set(grown, grown, 1);
      picked.mirror.scale.set(grown, -grown, 1);
      glowMaterial.opacity = 0.7 * Math.min(1, at.landing * 2);
      // The rest step back fast: a ghost of the deck behind the pick reads
      // as clutter, not depth.
      const away = Math.min(1, at.landing * 1.6);
      cards.forEach((card) => {
        if (card !== picked) {
          card.material.opacity = 1 - away * 0.94;
          card.mirrorMaterial.opacity = 0.24 * (1 - away);
        }
      });
      if (!isCaptioned) {
        isCaptioned = true;
        ring.updateMatrixWorld(true);
        const place = placeOf(picked.mesh);
        label.style.top = `${place.top + place.height * 1.18 + 10}px`;
        label.animate(
          [
            { opacity: 0, transform: 'translate(-50%, 6px)' },
            { opacity: 1, transform: 'translate(-50%, 0)' },
          ],
          { duration: 240, fill: 'forwards' },
        );
      }
    }
    renderer.render(world, camera);
    if (at.isLanded) {
      fly();
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};
