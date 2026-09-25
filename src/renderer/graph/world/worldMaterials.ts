/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  AddEquation,
  BackSide,
  ClampToEdgeWrapping,
  Color,
  CustomBlending,
  DataTexture,
  DoubleSide,
  FrontSide,
  LinearFilter,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  OneFactor,
  PointsMaterial,
  SRGBColorSpace,
  SrcAlphaFactor,
  ZeroFactor,
  type IUniform,
  type Material,
  type Texture,
} from 'three';
import type {
  IWorldAtlasRegion,
  IWorldMaterial,
  IWorldPointsNode,
} from 'common/sceneWorld';
import {
  createColourFormula,
  createFormula,
  type IWorldColourFormula,
  type IWorldFormula,
} from './worldFormula';
import type { IWorldInputs } from './worldInputs';
import { needsHooks, spliceWorldHooks } from './worldShaderHooks';

/**
 * A world's materials, built from its descriptions: three's physically based
 * surfaces with the music driving their numbers every frame, and the
 * author's GLSL spliced in where there is any.
 */

export interface IWorldMaterialContext {
  inputs: IWorldInputs;
  /** `uniform float uParam_*; uniform float uVar_*;` for the GLSL hooks. */
  declarations: string;
  /** The pack's artwork as a colour picture, for cut-out regions. */
  atlas: Texture | null;
  fogToBackdrop: boolean;
  /** The floor's reflection (`worldMirror.ts`), when a material asks for one. */
  mirror: Record<string, IUniform> | null;
}

export interface IWorldMaterialHandle {
  material: Material;
  update(): void;
  dispose(): void;
  /** Whether it shows the floor's reflection: its mesh is the mirror. */
  reflects?: boolean;
}

export interface IWorldMaterialVariant {
  /** The terrain's own uniforms; the material then builds ground from them. */
  terrain?: Record<string, IUniform>;
  vertexColours?: boolean;
}

const DEFAULT_MATERIAL: IWorldMaterial = {
  kind: 'standard',
  colour: { hex: '#9aa3b5' },
  emissive: { hex: '#000000' },
  emissiveIntensity: 1,
  roughness: 0.55,
  metalness: 0.1,
  opacity: 1,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  transmission: 0,
  thickness: 0.5,
  iridescence: 0,
  sheen: 0,
  ior: 1.5,
  transparent: false,
  wireframe: false,
  flatShading: false,
  side: 'front',
  additive: false,
  fog: true,
  repeat: [1, 1],
  mirror: 0,
  mirrorBlur: 0.3,
};

/** A ribbon with no material of its own glows in its own colours. */
export const GLOW_MATERIAL: IWorldMaterial = {
  ...DEFAULT_MATERIAL,
  kind: 'glow',
  colour: { hex: '#ffffff' },
  emissiveIntensity: 2,
  additive: true,
  side: 'double',
};

export const defaultWorldMaterial = (): IWorldMaterial => DEFAULT_MATERIAL;

/** djb2, enough to tell two hook sources apart in three's program cache. */
const hashText = (text: string): string => {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33 + text.charCodeAt(i)) % 4294967296;
  }
  return hash.toString(36);
};

/**
 * Light added on top of what is behind it, never hiding it: colour adds,
 * coverage stays as it was. Three's own additive mode adds to the alpha too,
 * which would punch a dark hole in the sky behind every glow.
 */
const makeAdditive = (material: Material) => {
  Object.assign(material, {
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
};

const regionTexture = (
  atlas: Texture | null,
  region: IWorldAtlasRegion | undefined,
  repeat: readonly [number, number],
): Texture | null => {
  if (!atlas || !region) {
    return null;
  }
  const image = atlas.image as { width: number; height: number };
  const texture = atlas.clone();
  // The artwork is decoded flipped (`sceneArtwork.ts`), so the region's top
  // row is the texture's highest.
  texture.offset.set(
    region.x / image.width,
    1 - (region.y + region.height) / image.height,
  );
  const whole = region.width === image.width && region.height === image.height;
  texture.repeat.set(
    (region.width / image.width) * (whole ? repeat[0] : 1),
    (region.height / image.height) * (whole ? repeat[1] : 1),
  );
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};

const SIDES = { front: FrontSide, back: BackSide, double: DoubleSide } as const;

export const buildWorldMaterial = (
  described: IWorldMaterial | undefined,
  context: IWorldMaterialContext,
  variant: IWorldMaterialVariant = {},
): IWorldMaterialHandle => {
  const def = described ?? DEFAULT_MATERIAL;
  const { inputs } = context;
  const scalar = (source: IWorldMaterial['roughness']) =>
    createFormula(source, inputs.runtime, inputs.scope);
  const colour = createColourFormula(def.colour, inputs.runtime, inputs.scope);
  const emissive = createColourFormula(
    def.emissive,
    inputs.runtime,
    inputs.scope,
  );
  const emissiveIntensity = scalar(def.emissiveIntensity);
  const opacity = scalar(def.opacity);
  const unlit = def.kind === 'basic' || def.kind === 'glow';
  const map = regionTexture(context.atlas, def.map, def.repeat);
  const emissiveMap = regionTexture(context.atlas, def.emissiveMap, def.repeat);

  let material: MeshBasicMaterial | MeshStandardMaterial | MeshPhysicalMaterial;
  if (unlit) {
    material = new MeshBasicMaterial();
  } else if (def.kind === 'physical') {
    material = new MeshPhysicalMaterial();
  } else {
    material = new MeshStandardMaterial();
  }
  const translucent =
    def.transparent || opacity.constant === undefined || opacity.value() < 1;
  Object.assign(material, {
    side: SIDES[def.side],
    wireframe: def.wireframe,
    fog: def.fog,
    transparent: translucent,
    blending: NormalBlending,
    vertexColors: variant.vertexColours === true,
    ...(map ? { map } : {}),
  });
  if (def.additive || def.kind === 'glow') {
    makeAdditive(material);
  }
  if (context.fogToBackdrop) {
    material.defines = { ...material.defines, WORLD_FOG_TO_BACKDROP: '' };
  }

  const scalars: { formula: IWorldFormula; key: string }[] = [];
  if (material instanceof MeshStandardMaterial) {
    Object.assign(material, {
      flatShading: def.flatShading,
      ...(emissiveMap ? { emissiveMap } : {}),
    });
    scalars.push(
      { formula: scalar(def.roughness), key: 'roughness' },
      { formula: scalar(def.metalness), key: 'metalness' },
      { formula: emissiveIntensity, key: 'emissiveIntensity' },
    );
  }
  if (material instanceof MeshPhysicalMaterial) {
    material.ior = def.ior;
    scalars.push(
      { formula: scalar(def.clearcoat), key: 'clearcoat' },
      { formula: scalar(def.clearcoatRoughness), key: 'clearcoatRoughness' },
      { formula: scalar(def.transmission), key: 'transmission' },
      { formula: scalar(def.thickness), key: 'thickness' },
      { formula: scalar(def.iridescence), key: 'iridescence' },
      { formula: scalar(def.sheen), key: 'sheen' },
    );
  }
  scalars.push({ formula: opacity, key: 'opacity' });

  const mirrorStrength = scalar(def.mirror);
  const reflects =
    !unlit &&
    context.mirror !== null &&
    (mirrorStrength.constant === undefined || mirrorStrength.constant > 0);
  const mirrorUniforms: Record<string, IUniform> = reflects
    ? {
        ...context.mirror,
        uMirrorStrength: { value: 0 },
        uMirrorBlur: { value: def.mirrorBlur },
      }
    : {};
  const hooks = {
    ...(def.vertex ? { vertex: def.vertex } : {}),
    ...(def.fragment ? { fragment: def.fragment } : {}),
    terrain: variant.terrain !== undefined,
    unlit,
    mirror: reflects,
  };
  if (needsHooks(hooks)) {
    const uniforms = {
      ...inputs.uniforms,
      ...(variant.terrain ?? {}),
      ...mirrorUniforms,
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      Object.assign(
        shader,
        spliceWorldHooks(shader, hooks, context.declarations),
      );
    };
    const key = `world:${hashText(
      `${hooks.terrain}${unlit}${reflects}${def.vertex ?? ''}\u0000${
        def.fragment ?? ''
      }\u0000${context.declarations}`,
    )}`;
    material.customProgramCacheKey = () => key;
  }

  const glow = def.kind === 'glow';
  const scratch = new Color();
  const writeColour = (formula: IWorldColourFormula) => {
    formula.apply(scratch);
    if (glow) {
      // A glow is its colour times its strength, in light rather than paint:
      // past 1 is exactly what the bloom picks out.
      scratch.multiplyScalar(emissiveIntensity.value());
    }
    material.color.copy(scratch);
  };
  const update = () => {
    writeColour(colour);
    if (material instanceof MeshStandardMaterial) {
      emissive.apply(material.emissive);
    }
    scalars.forEach(({ formula, key }) => {
      Object.assign(material, { [key]: formula.value() });
    });
    if (reflects) {
      mirrorUniforms.uMirrorStrength.value = Math.max(
        0,
        mirrorStrength.value(),
      );
    }
  };
  update();
  return {
    material,
    update,
    reflects,
    dispose: () => {
      material.dispose();
      map?.dispose();
      emissiveMap?.dispose();
    },
  };
};

/** A soft round dot, brightest in the middle: what every point is drawn as. */
const createDotTexture = () => {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      // A bright core with a soft glow round it, gone before the edge.
      const falloff = Math.exp(-r * r * 6) * (1 - r * r) + (1 - r) ** 3 * 0.15;
      const at = (y * size + x) * 4;
      data[at] = 255;
      data[at + 1] = 255;
      data[at + 2] = 255;
      data[at + 3] = Math.round(falloff * 255);
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

export const buildPointsMaterial = (
  node: IWorldPointsNode,
  context: IWorldMaterialContext,
): IWorldMaterialHandle => {
  const { inputs } = context;
  const dot = createDotTexture();
  const size = createFormula(node.size, inputs.runtime, inputs.scope);
  const opacity = createFormula(node.opacity, inputs.runtime, inputs.scope);
  const colour = createColourFormula(node.colour, inputs.runtime, inputs.scope);
  const material = new PointsMaterial({
    map: dot,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
  });
  if (node.additive) {
    makeAdditive(material);
  }
  if (context.fogToBackdrop) {
    material.defines = { ...material.defines, WORLD_FOG_TO_BACKDROP: '' };
  }
  // Three sizes a point from the canvas it was made on, which here is the
  // worker's and never the size being drawn: every point came out a fraction
  // of a pixel. The drawn height is given instead, every frame.
  //
  // And a point is never drawn under three pixels across. Smaller, it falls
  // between pixel centres and samples only the dot's dim rim — a field of
  // two-pixel stars measured as all but invisible — so a point that should
  // be smaller is drawn at three and dimmed by the area it lost, which is
  // what the eye would have received from it.
  const pointScale = inputs.uniforms.uWorldPointScale;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWorldPointScale = pointScale;
    shader.vertexShader = shader.vertexShader
      .replace(
        'uniform float scale;',
        'uniform float scale;\nuniform float uWorldPointScale;\nvarying float vWorldPointShare;',
      )
      .replace(
        '( scale / - mvPosition.z )',
        '( uWorldPointScale / - mvPosition.z )',
      )
      .replace(
        '#include <logdepthbuf_vertex>',
        `float worldWanted = gl_PointSize;
  gl_PointSize = max(worldWanted, 3.0);
  vWorldPointShare = (worldWanted * worldWanted) / (gl_PointSize * gl_PointSize);
  #include <logdepthbuf_vertex>`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'uniform float opacity;',
        'uniform float opacity;\nvarying float vWorldPointShare;',
      )
      .replace(
        '#include <alphatest_fragment>',
        `diffuseColor.a *= vWorldPointShare;
  #include <alphatest_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'world-points';
  const update = () => {
    material.size = Math.max(0, size.value());
    material.opacity = Math.min(1, Math.max(0, opacity.value()));
    colour.apply(material.color);
  };
  update();
  return {
    material,
    update,
    dispose: () => {
      material.dispose();
      dot.dispose();
    },
  };
};
