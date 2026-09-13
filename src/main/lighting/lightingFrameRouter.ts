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
} from '../../common/lighting/lampColour';
import {
  CHROMA_CHANNEL_KIND,
  CHROMA_CHANNEL_LAMPS,
  CHROMA_CHANNELS,
} from '../../common/lighting/lampLayouts';
import type {
  ILamp,
  ILightingFrame,
  ILightingSettings,
  TLightingKind,
} from '../../common/lighting/lightingModel';
import {
  deviceTuning,
  lightingProfile,
} from '../../common/lighting/lightingProfiles';
import type { IChromaClient } from './chromaClient';
import {
  lightsThroughWindows,
  rowKeyOfWindowsDevice,
  singleChromaKeyboard,
  type IWindowsDevice,
} from './lightingDevices';
import type { ILightingHost } from './lightingHost';
import type { IRazerEvent } from './lightingWire';

/**
 * One frame of the scene, mapped onto every lamp and sent where each device
 * listens: Razer Chroma's channels, and each Windows device the helper holds.
 * Each output keeps its own easing and beat memory between frames.
 */

interface IOutput {
  memory: ILampMemory;
  rgb: Uint8Array;
}

export interface IFrameTargets {
  settings: ILightingSettings;
  chroma: IChromaClient;
  razer: ReadonlyMap<string, IRazerEvent>;
  /** Only on a machine with Razer devices Razer Chroma would light. */
  hasRazer: boolean;
  keyboards: ReadonlyMap<string, readonly ILamp[]>;
  windows: ReadonlyMap<number, IWindowsDevice>;
  /** The Windows devices this helper has sent colours to, and so holds. */
  heldWindows: Set<number>;
  /** Razer's devices are still being listed. */
  razerPending: boolean;
  host: () => ILightingHost | undefined;
  /** Ends the helper and starts a fresh one holding nothing. */
  restartHelper: () => void;
}

export const createFrameRouter = () => {
  const outputs = new Map<string, IOutput>();
  const keyboardKeys = new Uint32Array(6 * 22);

  const outputFor = (key: string, lampCount: number): IOutput => {
    let output = outputs.get(key);
    if (!output || output.rgb.length !== lampCount * 3) {
      output = {
        memory: createLampMemory(lampCount),
        rgb: new Uint8Array(lampCount * 3),
      };
      outputs.set(key, output);
    }
    return output;
  };

  const route = (frame: ILightingFrame, targets: IFrameTargets) => {
    const { settings, chroma, razer, windows, heldWindows } = targets;
    const mood = measureMood(frame);
    const profile = lightingProfile(settings.profiles, frame.sceneId);
    const light = (
      key: string,
      lamps: readonly ILamp[],
      kind: TLightingKind,
      group = key,
    ) => {
      const output = outputFor(key, lamps.length);
      lightLamps(
        frame,
        mood,
        lamps,
        {
          kind,
          brightness: settings.brightness,
          pulse: settings.pulse,
          tuning: deviceTuning(profile, group),
          idle: profile.idle,
          idleBrightness: profile.idleBrightness,
        },
        output.memory,
        output.rgb,
      );
      return output.rgb;
    };

    // Razer's service only on a machine with Razer devices: every session
    // registers an app in Razer Chroma, and a desk without Razer has no
    // reason to have one.
    if (targets.hasRazer) {
      chroma.frame();
      CHROMA_CHANNELS.forEach((channel) => {
        const keyboard =
          channel === 'keyboard'
            ? singleChromaKeyboard(razer, targets.keyboards)
            : undefined;
        if (keyboard) {
          const rgb = light('chroma:keyboard', keyboard, 'keyboard');
          keyboardKeys.fill(0);
          keyboard.forEach((lamp, index) => {
            if (lamp.chromaIndex !== undefined) {
              keyboardKeys[lamp.chromaIndex] =
                0x01000000 +
                rgb[index * 3] +
                rgb[index * 3 + 1] * 256 +
                rgb[index * 3 + 2] * 65536;
            }
          });
          chroma.send(
            channel,
            light(
              'chroma:keyboard:canvas',
              CHROMA_CHANNEL_LAMPS.keyboard,
              'keyboard',
              'chroma:keyboard',
            ),
            keyboardKeys,
          );
          return;
        }
        chroma.send(
          channel,
          light(
            `chroma:${channel}`,
            CHROMA_CHANNEL_LAMPS[channel],
            CHROMA_CHANNEL_KIND[channel],
          ),
        );
      });
    }

    // Stopping sends does not relinquish a LampArray. Close the owning
    // process when a held device moves to Chroma or the member mutes it.
    // A fresh helper enumerates without acquiring any lamps.
    if (
      [...heldWindows].some((index) => {
        const device = windows.get(index);
        return (
          device &&
          (!lightsThroughWindows(device, razer, chroma.state()) ||
            settings.muted.includes(rowKeyOfWindowsDevice(device, razer)))
        );
      })
    ) {
      targets.restartHelper();
    }
    const running = targets.host();
    // Razer and Windows enumerate independently. Wait for classification
    // before acquiring a Windows twin, or each fresh helper can acquire it
    // just before the Razer row arrives and trigger another restart.
    if (running && !targets.razerPending) {
      windows.forEach((device, index) => {
        if (
          !lightsThroughWindows(device, razer, chroma.state()) ||
          settings.muted.includes(rowKeyOfWindowsDevice(device, razer))
        ) {
          return;
        }
        running.send(
          index,
          light(
            `windows:${index}`,
            device.lamps,
            device.kind,
            rowKeyOfWindowsDevice(device, razer),
          ),
        );
        heldWindows.add(index);
      });
    }
  };

  return {
    route,
    /** A Windows device's easing history, dropped with the helper holding it. */
    forgetWindows: (index: number) => outputs.delete(`windows:${index}`),
    /** Faded in again from dark next time, not from where the last song left. */
    clear: () => outputs.clear(),
  };
};
