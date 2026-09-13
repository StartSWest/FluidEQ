/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createLampMemory,
  lightLamps,
  measureMood,
  type ILampMemory,
} from 'common/lighting/lampColour';
import type {
  ILightingDevice,
  ILightingFrame,
  ILightingSettings,
} from 'common/lighting/lightingModel';
import { subscribeLightingPreview } from '../../lighting/lightingPreview';

/**
 * Every device's lamp colours for the page, frame by frame — worked out with
 * the same function, the same settings and the same frame the main process
 * uses for the real devices, so the drawn desk is the real desk.
 *
 * One of these per open page. The desk and each device row subscribe; the
 * colours are computed once per frame for all of them, and nothing here goes
 * through React.
 */

export interface IDeskColours {
  frame: ILightingFrame | undefined;
  colours: ReadonlyMap<string, Uint8Array>;
}

type TListener = (colours: IDeskColours) => void;

export interface IDeskColourFeed {
  /** The devices and settings the colours are for; call when either changes. */
  update(
    devices: readonly ILightingDevice[],
    settings: ILightingSettings,
  ): void;
  subscribe(listener: TListener): () => void;
  close(): void;
}

export const createDeskColourFeed = (): IDeskColourFeed => {
  let devices: readonly ILightingDevice[] = [];
  let settings: ILightingSettings | undefined;
  const memories = new Map<string, { memory: ILampMemory; rgb: Uint8Array }>();
  const listeners = new Set<TListener>();
  let latest: IDeskColours = { frame: undefined, colours: new Map() };

  const compute = (frame: ILightingFrame | undefined) => {
    const colours = new Map<string, Uint8Array>();
    const current = settings;
    if (frame && current) {
      const mood = measureMood(frame);
      devices.forEach((device) => {
        if (device.muted || device.route === 'none') {
          return;
        }
        let entry = memories.get(device.key);
        if (!entry || entry.rgb.length !== device.lamps.length * 3) {
          entry = {
            memory: createLampMemory(device.lamps.length),
            rgb: new Uint8Array(device.lamps.length * 3),
          };
          memories.set(device.key, entry);
        }
        lightLamps(
          frame,
          mood,
          device.lamps,
          {
            kind: device.kind,
            brightness: current.brightness,
            pulse: current.pulse,
          },
          entry.memory,
          entry.rgb,
        );
        colours.set(device.key, entry.rgb);
      });
    } else {
      // Nothing playing: the next song fades in from dark, as the desk does.
      memories.clear();
    }
    latest = { frame, colours };
    listeners.forEach((listener) => listener(latest));
  };

  const stopPreview = subscribeLightingPreview(compute);

  return {
    // Kept for the next frame rather than applied to the last one again: a
    // frame run twice would advance every lamp's beat and easing twice.
    update: (nextDevices, nextSettings) => {
      devices = nextDevices;
      settings = nextSettings;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      listener(latest);
      return () => {
        listeners.delete(listener);
      };
    },
    close: () => {
      stopPreview();
      listeners.clear();
    },
  };
};
