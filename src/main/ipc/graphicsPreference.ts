/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { ipcMain } from 'electron';
import {
  gpuPreferenceSupported,
  isGpuPreference,
  type IGraphicsPreferenceState,
  type TGpuPreference,
} from '../../common/graphicsPreference';
import { readGpuPreference, writeGpuPreference } from '../graphicsPreference';

export type { IGraphicsPreferenceState } from '../../common/graphicsPreference';

const CHANNELS = [
  'graphics-preference-get',
  'graphics-preference-set',
] as const;

export const registerGraphicsPreferenceIpc = ({
  userDataDir,
  atLaunch,
  platform,
  logger,
}: {
  userDataDir: string;
  atLaunch: TGpuPreference;
  platform: string;
  logger?: { error(message: string, ...details: unknown[]): void };
}) => {
  const state = (): IGraphicsPreferenceState => ({
    chosen: readGpuPreference(userDataDir),
    atLaunch,
    supported: gpuPreferenceSupported(platform),
  });

  ipcMain.handle('graphics-preference-get', state);

  ipcMain.handle(
    'graphics-preference-set',
    (_event, gpu: unknown): IGraphicsPreferenceState => {
      if (isGpuPreference(gpu)) {
        try {
          writeGpuPreference(userDataDir, gpu);
        } catch (error) {
          logger?.error('Could not save the graphics card preference', error);
        }
      }
      return state();
    },
  );

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
