/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DataTexture,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
  Vector2,
  type IUniform,
} from 'three';
import type { IWorldMaterial, IWorldTerrainNode } from 'common/sceneWorld';
import { SPECTRUM_TEXELS } from 'common/sceneUniformContract';
import { hash01 } from 'common/worldExpression';
import { createFormula } from './worldFormula';
import type { IWorldInputs } from './worldInputs';
import {
  buildWorldMaterial,
  type IWorldMaterialContext,
  type IWorldMaterialHandle,
} from './worldMaterials';

/**
 * Ground raised by the music: the spectrum across it, the recent past along
 * it, the newest row at the far edge rolling toward the viewer.
 *
 * The heights are read on the GPU from a ring of spectra, one texture row per
 * step (`worldShaderHooks.ts`), and the ground glides between rows instead of
 * stepping: the ring's head is fractional, and a vertex reads between the two
 * rows it falls between. A mesh rebuilt on the CPU every frame would cost a
 * quarter of a million height writes at the largest size; this costs one row.
 */

export interface IWorldTerrain {
  object: Mesh;
  material: IWorldMaterialHandle;
  update(dt: number): void;
  dispose(): void;
}

export const buildTerrain = (
  node: IWorldTerrainNode,
  described: IWorldMaterial | undefined,
  inputs: IWorldInputs,
  context: IWorldMaterialContext,
): IWorldTerrain => {
  const { rows } = node;
  const history = new DataTexture(
    new Uint8Array(SPECTRUM_TEXELS * rows),
    SPECTRUM_TEXELS,
    rows,
    RedFormat,
    UnsignedByteType,
  );
  history.minFilter = LinearFilter;
  history.magFilter = LinearFilter;
  history.wrapT = RepeatWrapping;
  history.generateMipmaps = false;
  history.needsUpdate = true;
  const data = history.image.data as Uint8Array;
  const [segmentsAcross, segmentsAlong] = node.segments;
  const uniforms: Record<string, IUniform> = {
    uTerrainHistory: { value: history },
    uTerrainHead: { value: 0 },
    uTerrainRows: { value: rows },
    uTerrainHeight: { value: 0 },
    uTerrainBand: { value: new Vector2(...node.band) },
    uTerrainMirror: { value: node.mirror ? 1 : 0 },
    uTerrainValley: { value: node.valley },
    uTerrainStep: {
      value: new Vector2(1 / segmentsAcross, 1 / segmentsAlong),
    },
    uTerrainSize: { value: new Vector2(...node.size) },
  };
  const material = buildWorldMaterial(described, context, {
    terrain: uniforms,
  });
  const geometry = new PlaneGeometry(
    node.size[0],
    node.size[1],
    segmentsAcross,
    segmentsAlong,
  );
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material.material);
  // Heights are the GPU's: the plane's own bounds say nothing about them.
  mesh.frustumCulled = false;
  const height = createFormula(node.height, inputs.runtime, inputs.scope);

  let head = 0;
  let pending = 0;
  let filled = false;

  const writeRow = (row: number, scale: number) => {
    const offset = row * SPECTRUM_TEXELS;
    const spectrum = inputs.spectrumBytes;
    for (let i = 0; i < SPECTRUM_TEXELS; i += 1) {
      data[offset + i] = Math.round(spectrum[i] * scale);
    }
  };

  /**
   * The first spectrum with sound in it is laid down the whole length, each
   * row at a height of its own, so a picture taken before any history has
   * built up — a gallery cover, the Studio's still — shows ground with
   * relief rather than a flat plate.
   */
  const fillFrom = () => {
    for (let row = 0; row < rows; row += 1) {
      writeRow(row, 0.45 + 0.55 * hash01(row * 3.1));
    }
    filled = true;
  };

  return {
    object: mesh,
    material,
    update: (dt) => {
      if (!filled && inputs.spectrumBytes.some((value) => value > 8)) {
        fillFrom();
        history.needsUpdate = true;
      }
      pending += dt * node.rate;
      // A stall is not history: at most a full ring is written, never more.
      const due = Math.min(rows, Math.floor(pending));
      for (let step = 0; step < due; step += 1) {
        head = (head + 1) % rows;
        writeRow(head, 1);
      }
      if (due > 0) {
        pending -= due;
        history.needsUpdate = true;
      }
      pending = Math.min(pending, 1);
      uniforms.uTerrainHead.value = head + pending - 1;
      uniforms.uTerrainHeight.value = height.value();
      material.update();
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      history.dispose();
    },
  };
};
