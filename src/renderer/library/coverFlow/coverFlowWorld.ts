/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Cover Flow scene stands its covers in: the light behind the row,
 * the glossy floor, and the cover meshes themselves, each a sleeve over its
 * own reflection — wearing the theme's colours, read off the stage once as
 * the scene is built. `coverFlowScene.ts` places and lights them per frame.
 */
import * as THREE from 'three';
import cssColourChannels from '../../utils/cssColour';
import type { ICoverFlowArtColours } from './coverFlowArt';
import { COVER_EDGE, FLOOR_Y } from './coverFlowGeometry';
import {
  COVER_FRAGMENT,
  COVER_VERTEX,
  FLOOR_FRAGMENT,
  FLOOR_VERTEX,
  HALO_FRAGMENT,
  HALO_VERTEX,
  REFLECTION_FRAGMENT,
} from './coverFlowShaders';

/** The sleeve's corner, as a share of its edge (`.library-cover-art--cover`'s
 * 0.035). */
const CORNER = 0.035;

export interface ICard {
  group: THREE.Group;
  mesh: THREE.Mesh;
  cover: THREE.ShaderMaterial;
  reflection: THREE.ShaderMaterial;
}

const themeColour = (
  host: HTMLElement,
  property: string,
  fallback: string,
): string =>
  getComputedStyle(host).getPropertyValue(property).trim() || fallback;

const toColour = (css: string, fallback: string): THREE.Color => {
  const channels = cssColourChannels(css);
  return channels
    ? new THREE.Color().setRGB(...channels, THREE.SRGBColorSpace)
    : new THREE.Color(fallback);
};

/** An empty sleeve, for a cover whose page or picture has not come yet. */
const emptySleeve = (): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.11)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export interface ICoverFlowWorld {
  world: THREE.Scene;
  /** The light the halo and the floor wear; blended by the scene. */
  glow: THREE.Color;
  /** The theme's accent: the light before any cover has lent its own. */
  accent: THREE.Color;
  artColours: ICoverFlowArtColours;
  halo: THREE.ShaderMaterial;
  /** How much of their reflections the covers show; eased by the scene. */
  reflectionStrength: { value: number };
  /** An empty sleeve, for a cover whose picture has not come yet. */
  sleeve: THREE.Texture;
  makeCard: () => ICard;
  dispose: () => void;
}

export const createCoverFlowWorld = (host: HTMLElement): ICoverFlowWorld => {
  const ringColour = toColour(
    themeColour(host, '--cover-flow-ring', ''),
    '#5eead4',
  );
  const accent = toColour(
    themeColour(host, '--cover-flow-glow', ''),
    '#2dd4bf',
  );
  const artColours: ICoverFlowArtColours = {
    folderTop: themeColour(host, '--cover-flow-folder-top', '#2b3a44'),
    folderBottom: themeColour(host, '--cover-flow-folder-bottom', '#141c22'),
  };

  const world = new THREE.Scene();
  const glow = accent.clone();

  const halo = new THREE.ShaderMaterial({
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    uniforms: {
      uGlow: { value: glow },
      uAspect: { value: 1 },
      uAnchor: { value: 0.58 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.PlaneGeometry(2, 2);
  const haloMesh = new THREE.Mesh(quad, halo);
  haloMesh.frustumCulled = false;
  haloMesh.renderOrder = -400;
  world.add(haloMesh);

  const floor = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERTEX,
    fragmentShader: FLOOR_FRAGMENT,
    uniforms: { uGlow: { value: glow } },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  const floorGeometry = new THREE.PlaneGeometry(40, 20);
  const floorMesh = new THREE.Mesh(floorGeometry, floor);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = FLOOR_Y - 0.001;
  floorMesh.renderOrder = -300;
  world.add(floorMesh);

  const sleeve = emptySleeve();
  const geometry = new THREE.PlaneGeometry(COVER_EDGE, COVER_EDGE);
  const reflectionStrength = { value: 1 };

  const makeCard = (): ICard => {
    const cover = new THREE.ShaderMaterial({
      vertexShader: COVER_VERTEX,
      fragmentShader: COVER_FRAGMENT,
      uniforms: {
        uMap: { value: sleeve },
        uShade: { value: 1 },
        uSaturation: { value: 1 },
        uSheen: { value: 0 },
        uRing: { value: 0 },
        uRingColour: { value: ringColour },
        uRadius: { value: CORNER },
      },
      transparent: true,
      premultipliedAlpha: true,
    });
    const reflection = new THREE.ShaderMaterial({
      vertexShader: COVER_VERTEX,
      fragmentShader: REFLECTION_FRAGMENT,
      uniforms: {
        uMap: cover.uniforms.uMap,
        uShade: { value: 1 },
        uRadius: { value: CORNER },
        uStrength: reflectionStrength,
      },
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, cover);
    const mirror = new THREE.Mesh(geometry, reflection);
    // Mirrored about the floor: the cover's foot touches its reflection's.
    mirror.scale.y = -1;
    mirror.position.y = 2 * FLOOR_Y;
    group.add(mesh, mirror);
    world.add(group);
    return { group, mesh, cover, reflection };
  };

  return {
    world,
    glow,
    accent,
    artColours,
    halo,
    reflectionStrength,
    sleeve,
    makeCard,
    dispose: () => {
      geometry.dispose();
      floorGeometry.dispose();
      quad.dispose();
      halo.dispose();
      floor.dispose();
      sleeve.dispose();
    },
  };
};
