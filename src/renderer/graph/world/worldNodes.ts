/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  AmbientLight,
  AnimationMixer,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  PointLight,
  SpotLight,
  type Camera,
  type Light,
  type Material,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {
  ISceneWorld,
  IWorldLightNode,
  IWorldModelNode,
  TWorldNode,
} from 'common/sceneWorld';
import { buildInstances, buildPoints } from './worldCopies';
import {
  createColourFormula,
  createFormula,
  createVec3Formula,
} from './worldFormula';
import { buildWorldGeometry } from './worldGeometry';
import type { IWorldInputs } from './worldInputs';
import {
  GLOW_MATERIAL,
  buildWorldMaterial,
  type IWorldMaterialContext,
  type IWorldMaterialHandle,
} from './worldMaterials';
import type { IWorldModelAsset } from './worldModels';
import { buildRibbon } from './worldRibbon';
import { buildTerrain } from './worldTerrain';

/**
 * A world's objects, built into a three.js scene graph, with the list of
 * things that change every frame beside it. Anything whose formulas are all
 * fixed is placed once and never touched again.
 */

export interface IWorldBuild {
  root: Group;
  /** Every frame, after the music and the camera are in. */
  update(dt: number): void;
  dispose(): void;
  /** Whether any light casts a shadow, which the renderer must then draw. */
  shadows: boolean;
  /** The one floor that reflects the world, if a material asked for it. */
  mirror: Mesh | null;
}

interface IBuildState {
  world: ISceneWorld;
  inputs: IWorldInputs;
  context: IWorldMaterialContext;
  models: Readonly<Record<string, IWorldModelAsset>>;
  camera: Camera;
  frame: ((dt: number) => void)[];
  disposers: (() => void)[];
  materials: Map<string, IWorldMaterialHandle>;
  shadows: boolean;
  mirror: Mesh | null;
}

const sharedMaterial = (
  state: IBuildState,
  id: string,
  mirror = false,
): IWorldMaterialHandle => {
  const key = mirror ? `${id}\u0000mirror` : id;
  const known = state.materials.get(key);
  if (known) {
    return known;
  }
  const handle = buildWorldMaterial(state.world.materials[id], state.context, {
    mirror,
  });
  state.materials.set(key, handle);
  return handle;
};

/** A light, pointed where it was told to point, casting shadows if asked. */
const buildLight = (node: IWorldLightNode, state: IBuildState): Object3D => {
  const { light: spec } = node;
  const { runtime, scope } = state.inputs;
  let light: Light;
  switch (spec.kind) {
    case 'ambient':
      light = new AmbientLight();
      break;
    case 'hemisphere':
      light = new HemisphereLight();
      break;
    case 'directional':
      light = new DirectionalLight();
      break;
    case 'spot':
      light = new SpotLight(
        0xffffff,
        1,
        spec.distance,
        spec.angle,
        spec.penumbra,
        spec.decay,
      );
      break;
    default:
      light = new PointLight(0xffffff, 1, spec.distance, spec.decay);
  }
  if (light instanceof DirectionalLight || light instanceof SpotLight) {
    light.target.position.set(...spec.target);
  }
  if (
    spec.shadow &&
    (light instanceof DirectionalLight ||
      light instanceof SpotLight ||
      light instanceof PointLight)
  ) {
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 3;
    if (light instanceof DirectionalLight) {
      const reach = 40;
      Object.assign(light.shadow.camera, {
        left: -reach,
        right: reach,
        top: reach,
        bottom: -reach,
        near: 0.5,
        far: 200,
      });
    }
    state.shadows = true;
  }
  const colour = createColourFormula(spec.colour, runtime, scope);
  const ground = createColourFormula(spec.groundColour, runtime, scope);
  const intensity = createFormula(spec.intensity, runtime, scope);
  // A light is hidden by going dark, never by leaving the scene: three
  // builds every lit material for the number of lights it sees, so a light
  // that came and went rebuilt them all mid-song, synchronously, the first
  // time each count was seen. Its children keep their own visibility.
  const shows = createFormula(node.visible, runtime, scope);
  const apply = () => {
    colour.apply(light.color);
    if (light instanceof HemisphereLight) {
      ground.apply(light.groundColor);
    }
    light.intensity = shows.value() > 0.5 ? Math.max(0, intensity.value()) : 0;
  };
  apply();
  if (
    !colour.constant ||
    !ground.constant ||
    intensity.constant === undefined ||
    shows.constant === undefined
  ) {
    state.frame.push(apply);
  }
  state.disposers.push(() => light.dispose());
  return light;
};

/**
 * What a directional or spot light aims at stands beside it, in the space
 * the light itself is placed in — the world, for a light at the top — so a
 * target of [0, 0, 0] is the middle of the world. It used to be measured
 * from the light's own place, with the light itself left one metre above
 * that place (three's default position), so a target of [0, 0, 0] shone
 * straight down whatever it was written to face, and a designer who wanted
 * the origin had to write the negative of the light's position.
 */
const withTarget = (light: Object3D): Object3D => {
  if (light instanceof DirectionalLight || light instanceof SpotLight) {
    const beside = new Group();
    beside.add(light, light.target);
    return beside;
  }
  return light;
};

const buildModel = (node: IWorldModelNode, state: IBuildState): Object3D => {
  // Own entries only: a model named `constructor` that failed to load found
  // Object's own constructor here, and the whole world fell to its shader.
  if (!Object.prototype.hasOwnProperty.call(state.models, node.model)) {
    return new Group();
  }
  const asset = state.models[node.model];
  const scene = cloneSkinned(asset.scene);
  scene.traverse((object) => {
    const mesh = object as Partial<Mesh>;
    if (mesh.isMesh) {
      object.castShadow = node.castShadow;
      object.receiveShadow = node.receiveShadow;
      if (state.context.fogToBackdrop && mesh.material) {
        const materials: Material[] = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((material) => {
          material.defines = {
            ...material.defines,
            WORLD_FOG_TO_BACKDROP: '',
          };
        });
      }
    }
  });
  const clip =
    typeof node.clip === 'number'
      ? asset.animations[node.clip]
      : (asset.animations.find((known) => known.name === node.clip) ??
        (node.clip === undefined ? asset.animations[0] : undefined));
  if (clip) {
    const mixer = new AnimationMixer(scene);
    mixer.clipAction(clip).play();
    const speed = createFormula(
      node.speed,
      state.inputs.runtime,
      state.inputs.scope,
    );
    state.frame.push((dt) => mixer.update(dt * speed.value()));
    state.disposers.push(() => mixer.stopAllAction());
  }
  return scene;
};

/**
 * Where a node stands and whether it shows, from its formulas; `hides`
 * false for a light, which goes dark instead (`buildLight`).
 */
const placeNode = (
  object: Object3D,
  node: TWorldNode,
  state: IBuildState,
  hides: boolean,
) => {
  const { runtime, scope } = state.inputs;
  const position = createVec3Formula(node.position, runtime, scope);
  const rotation = createVec3Formula(node.rotation, runtime, scope);
  const scale = createVec3Formula(node.scale, runtime, scope);
  const visible = createFormula(node.visible, runtime, scope);
  const apply = () => {
    object.position.set(
      position.x.value(),
      position.y.value(),
      position.z.value(),
    );
    object.rotation.set(
      rotation.x.value(),
      rotation.y.value(),
      rotation.z.value(),
    );
    object.scale.set(scale.x.value(), scale.y.value(), scale.z.value());
    if (hides) {
      object.visible = visible.value() > 0.5;
    }
  };
  apply();
  if (
    !position.constant ||
    !rotation.constant ||
    !scale.constant ||
    (hides && visible.constant === undefined)
  ) {
    state.frame.push(apply);
  }
};

const buildNode = (node: TWorldNode, state: IBuildState): Object3D => {
  const { inputs, context } = state;
  let object: Object3D;
  /** The material a shadow of this object has to be drawn like. */
  let shaped: IWorldMaterialHandle | undefined;
  switch (node.type) {
    case 'mesh': {
      const geometry = buildWorldGeometry(node.geometry);
      // The reflection is taken about the mesh's own flat face (local +z,
      // `worldMirror.ts`), which only a plane and a ring have: a box floor
      // reflected about a wall.
      const flat =
        node.geometry.kind === 'plane' || node.geometry.kind === 'ring';
      const material = sharedMaterial(
        state,
        node.material,
        flat && state.mirror === null,
      );
      const mesh = new Mesh(geometry, material.material);
      if (material.reflects) {
        state.mirror = mesh;
      }
      object = mesh;
      shaped = material;
      state.disposers.push(() => geometry.dispose());
      break;
    }
    case 'instances': {
      shaped = sharedMaterial(state, node.material);
      const copies = buildInstances(node, inputs, shaped);
      object = copies.object;
      state.frame.push(copies.update);
      state.disposers.push(copies.dispose);
      break;
    }
    case 'points': {
      const points = buildPoints(node, inputs, context);
      object = points.object;
      state.frame.push(points.update);
      state.disposers.push(points.dispose);
      break;
    }
    case 'ribbon': {
      const described = state.world.materials[node.material] ?? GLOW_MATERIAL;
      const material = buildWorldMaterial(described, context, {
        vertexColours: true,
      });
      const ribbon = buildRibbon(node, inputs, material, state.camera);
      object = ribbon.object;
      shaped = material;
      state.frame.push(() => {
        material.update();
        ribbon.update();
      });
      state.disposers.push(ribbon.dispose, material.dispose);
      break;
    }
    case 'terrain': {
      const terrain = buildTerrain(
        node,
        state.world.materials[node.material],
        inputs,
        context,
      );
      object = terrain.object;
      shaped = terrain.material;
      state.frame.push(terrain.update);
      state.disposers.push(terrain.dispose);
      break;
    }
    case 'model':
      object = buildModel(node, state);
      break;
    case 'light':
      object = buildLight(node, state);
      break;
    default:
      object = new Group();
  }
  if (node.type !== 'light' && node.type !== 'model') {
    object.castShadow = node.castShadow;
    object.receiveShadow = node.receiveShadow;
  }
  if (node.castShadow && shaped?.shadow) {
    Object.assign(object, {
      customDepthMaterial: shaped.shadow.depth,
      customDistanceMaterial: shaped.shadow.distance,
    });
  }
  placeNode(object, node, state, node.type !== 'light');
  node.children.forEach((child) => {
    object.add(buildNode(child, state));
  });
  return node.type === 'light' ? withTarget(object) : object;
};

export const buildWorldNodes = (
  world: ISceneWorld,
  inputs: IWorldInputs,
  context: IWorldMaterialContext,
  models: Readonly<Record<string, IWorldModelAsset>>,
  camera: Camera,
): IWorldBuild => {
  const state: IBuildState = {
    world,
    inputs,
    context,
    models,
    camera,
    frame: [],
    disposers: [],
    materials: new Map(),
    shadows: false,
    mirror: null,
  };
  const root = new Group();
  world.nodes.forEach((node) => {
    root.add(buildNode(node, state));
  });
  const shared = [...state.materials.values()];
  return {
    root,
    update: (dt) => {
      shared.forEach((handle) => handle.update());
      state.frame.forEach((step) => step(dt));
    },
    dispose: () => {
      state.disposers.forEach((dispose) => dispose());
      shared.forEach((handle) => handle.dispose());
    },
    shadows: state.shadows,
    mirror: state.mirror,
  };
};
