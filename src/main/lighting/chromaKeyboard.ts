/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs/promises';
import path from 'path';
import type { ILamp } from '../../common/lighting/lightingModel';
import { chromaKeyIndex } from './chromaKeyCodes';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const pair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((part) => Number.isInteger(part) && part >= 0 && part < 32);

/** Join spatial positions to key identities for CHROMA_CUSTOM_KEY. */
export const readChromaKeyboard = (raw: unknown): ILamp[] | undefined => {
  const param = object(raw) && raw.param;
  const config = object(param) && param.ledConfig;
  if (!object(param) || param.category !== 'keyboard' || !object(config)) {
    return undefined;
  }
  if (!Array.isArray(config.LedMatrix) || config.LedMatrix.length > 132) {
    return undefined;
  }
  const keys = config.LedMatrix.filter(
    (
      key,
    ): key is { DevicePos: [number, number]; MatrixPos: [number, number] } =>
      object(key) &&
      pair(key.DevicePos) &&
      pair(key.MatrixPos) &&
      key.MatrixPos[0] < 6 &&
      key.MatrixPos[1] < 22,
  );
  if (keys.length < 20 || keys.length !== config.LedMatrix.length) {
    return undefined;
  }
  if (!Array.isArray(config.LedInputMap) || config.LedInputMap.length > 132) {
    return undefined;
  }
  const identities = new Map<string, number>();
  config.LedInputMap.forEach((input: unknown) => {
    if (
      object(input) &&
      input.InputType === 'kbd' &&
      pair(input.MatrixPos) &&
      Array.isArray(input.InputData) &&
      input.InputData.length === 2 &&
      input.InputData.every(
        (value: unknown) =>
          typeof value === 'number' && Number.isInteger(value),
      )
    ) {
      const index = chromaKeyIndex(
        input.InputData[0],
        input.InputData[1],
        input.MatrixPos[0],
      );
      if (index !== undefined) {
        identities.set(input.MatrixPos.join(':'), index);
      }
    }
  });
  // MatrixPos is spatial. DevicePos is an address on the device, not geometry.
  const left = Math.min(...keys.map((key) => key.MatrixPos[1]));
  const top = Math.min(...keys.map((key) => key.MatrixPos[0]));
  const columns = Math.max(...keys.map((key) => key.MatrixPos[1])) - left + 1;
  const rows = Math.max(...keys.map((key) => key.MatrixPos[0])) - top + 1;
  const lamps: ILamp[] = [];
  keys.forEach((key) => {
    const index = identities.get(key.MatrixPos.join(':'));
    if (index !== undefined) {
      lamps.push({
        u: (key.MatrixPos[1] - left + 0.5) / columns,
        v: (key.MatrixPos[0] - top + 0.5) / rows,
        reach: 0.6 / Math.max(columns, rows),
        chromaIndex: index,
      });
    }
  });
  // Private media/Fn inputs have no standard scan code; the spatial canvas
  // still lights them. Unknown keyboard mappings retain that complete canvas.
  return lamps.length >= 20 &&
    new Set(lamps.map((lamp) => lamp.chromaIndex)).size === lamps.length
    ? lamps
    : undefined;
};

export const loadChromaKeyboard = async (
  container: string,
): Promise<ILamp[] | undefined> => {
  const id = container.replace(/[{}]/g, '');
  const folder = process.env['ProgramFiles(x86)'];
  if (!folder || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
    return undefined;
  }
  try {
    const source = await fs.readFile(
      path.join(folder, 'Razer Chroma SDK', 'Devices', `${id}.json`),
      'utf8',
    );
    return readChromaKeyboard(JSON.parse(source));
  } catch {
    // Older SDKs have no physical descriptors. Keep their standard grid.
    return undefined;
  }
};
