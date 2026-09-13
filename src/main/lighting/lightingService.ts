/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { razerKindOf } from '../../common/lighting/razerDevices';
import {
  deviceTuning,
  lightingProfile,
} from '../../common/lighting/lightingProfiles';
import {
  createLampMemory,
  lightLamps,
  measureMood,
  type ILampMemory,
} from '../../common/lighting/lampColour';
import {
  CHROMA_CHANNEL_LAMPS,
  CHROMA_CHANNELS,
  type TChromaChannel,
} from '../../common/lighting/lampLayouts';
import {
  readLightingFrame,
  readLightingSettings,
  type ILamp,
  type ILightingDevice,
  type ILightingSettings,
  type ILightingState,
  type TLightingKind,
  type TSynapseState,
} from '../../common/lighting/lightingModel';
import { createChromaClient, type IChromaClient } from './chromaClient';
import { loadChromaKeyboard } from './chromaKeyboard';
import {
  buildDeviceList,
  lightsThroughWindows,
  razerCandidates,
  rowKeyOfWindowsDevice,
  singleChromaKeyboard,
  toWindowsDevice,
  type IWindowsDevice,
} from './lightingDevices';
import { startLightingHost, type ILightingHost } from './lightingHost';
import {
  ensureLightingIdentity,
  type TIdentityOutcome,
} from './lightingIdentity';
import { findLightingFolder, LIGHTING_EXECUTABLE } from './lightingPath';
import {
  loadLightingSettings,
  saveLightingSettings,
} from './lightingSettingsStore';
import type { IRazerEvent, THelperEvent } from './lightingWire';

/**
 * Dynamic lighting in the main process: the settings, the devices, and every
 * frame mapped onto every lamp and sent.
 *
 * The window decides WHEN — it sends frames only while a Plus scene is on the
 * graph, including its idle movement, and releases when that producer stops.
 * This decides WHERE and WHETHER: the member's entitlement is asked again on
 * every frame, so a lapsed membership or a modified window lights nothing.
 *
 * Giving the lamps back is concrete on both routes. Razer's session is ended.
 * The lighting helper is ended — Windows returns a device to the next app in
 * line only when the process holding it lets go, and a process exit is the one
 * release that is certain. If the page is open, a fresh helper starts at once
 * to keep the device list, holding nothing.
 */

export interface ILightingServiceDeps {
  userDataDir: string;
  appVersion: string;
  supported: boolean;
  entitled: () => boolean;
  push: (state: ILightingState) => void;
  onHelperPid?: (pid: number | undefined) => void;
  canOpenRazerChroma?: () => boolean;
  findFolder?: () => string | undefined;
  startHost?: typeof startLightingHost;
  createChroma?: (onState: (state: TSynapseState) => void) => IChromaClient;
  ensureIdentity?: (folder: string | undefined) => Promise<TIdentityOutcome>;
  loadKeyboard?: typeof loadChromaKeyboard;
}

export interface ILightingService {
  state(): ILightingState;
  setSettings(raw: unknown): ILightingState;
  /** The page opened (true) or closed (false). */
  watch(open: boolean): void;
  frame(raw: unknown): void;
  release(): void;
  /** The window reloaded or went away without saying so. */
  windowGone(): void;
  /** Something that may have started Razer Chroma happened — the window regained focus. */
  recheckSynapse(): void;
  helperPid(): number | undefined;
  dispose(): void;
}

/** Which part of the music each Razer channel follows. */
const CHANNEL_KIND: Record<TChromaChannel, TLightingKind> = {
  keyboard: 'keyboard',
  mouse: 'mouse',
  mousepad: 'mousepad',
  headset: 'headset',
  keypad: 'keypad',
  chromalink: 'accessory',
};

/** A helper that dies this often in one session is not restarted again. */
const MAX_HELPER_FAILURES = 3;

interface IOutput {
  memory: ILampMemory;
  rgb: Uint8Array;
}

export const createLightingService = (
  deps: ILightingServiceDeps,
): ILightingService => {
  const findFolder = deps.findFolder ?? findLightingFolder;
  const startHost = deps.startHost ?? startLightingHost;
  const ensureIdentity =
    deps.ensureIdentity ??
    ((folder: string | undefined) =>
      ensureLightingIdentity(folder, deps.appVersion));

  let settings: ILightingSettings = loadLightingSettings(deps.userDataDir);
  let watchers = 0;
  let live = false;
  let ambient = false;
  let host: ILightingHost | undefined;
  let hostIdentity = false;
  let helperFailures = 0;
  let identity: TIdentityOutcome | 'pending' | undefined;
  const windows = new Map<number, IWindowsDevice>();
  const razer = new Map<string, IRazerEvent>();
  const keyboards = new Map<string, readonly ILamp[]>();
  const keyboardKeys = new Uint32Array(6 * 22);
  // Kept beside the map rather than counted per frame.
  let hasRazer = false;
  const outputs = new Map<string, IOutput>();
  const heldWindows = new Set<number>();
  let lastPushed = '';
  // A helper just started has not listed anything yet. Until both of its
  // watchers finish their first pass, the page keeps the list the previous
  // helper had — an ownership handoff can restart the helper, and a list
  // that emptied and refilled each time would blink under the member's eyes.
  const pending = { lamparray: false, razer: false };
  let snapshot: ILightingDevice[] | undefined;

  const chroma: IChromaClient = (deps.createChroma ?? createChromaClient)(() =>
    publish(),
  );

  const heldByWindows = (): string[] =>
    live
      ? [...windows.values()]
          .filter(
            (device) =>
              device.available === false &&
              lightsThroughWindows(device, razer, chroma.state()) &&
              !settings.muted.includes(rowKeyOfWindowsDevice(device, razer)),
          )
          .map((device) => {
            const rowKey = rowKeyOfWindowsDevice(device, razer);
            return rowKey.startsWith('razer:')
              ? (razer.get(rowKey.slice('razer:'.length))?.name ??
                  device.event.name)
              : device.event.name;
          })
      : [];

  const state = (): ILightingState => {
    const listing = pending.lamparray || pending.razer;
    const devices =
      listing && snapshot
        ? snapshot.map((device) => ({
            ...device,
            muted:
              device.route !== 'synapse' && settings.muted.includes(device.key),
          }))
        : buildDeviceList(windows, razer, settings, chroma.state(), keyboards);
    return {
      supported: deps.supported,
      searching: listing && !snapshot,
      settings,
      devices,
      synapse: chroma.state(),
      hasRazerDevices: devices.some((device) =>
        device.key.startsWith('razer:'),
      ),
      heldByWindows: heldByWindows(),
      canOpenRazerChroma: deps.canOpenRazerChroma?.() ?? false,
      live,
      ambient,
    };
  };

  function publish() {
    const next = state();
    // Pushed on change only: frames arrive thirty times a second and almost
    // none of them changes what the page lists.
    const text = JSON.stringify(next);
    if (text !== lastPushed) {
      lastPushed = text;
      deps.push(next);
    }
  }

  const wantsHelper = () =>
    deps.supported &&
    helperFailures < MAX_HELPER_FAILURES &&
    (watchers > 0 || live);

  const onHelperEvent = (source: ILightingHost) => (event: THelperEvent) => {
    if (source !== host) {
      return;
    }
    switch (event.type) {
      case 'ready':
        hostIdentity = event.identity;
        break;
      case 'lamparray':
        windows.set(event.index, toWindowsDevice(event));
        break;
      case 'lamparray-removed':
        windows.delete(event.index);
        break;
      case 'available': {
        const device = windows.get(event.index);
        if (device) {
          device.available = event.available;
        }
        break;
      }
      case 'razer': {
        const first = !hasRazer;
        razer.set(event.container, event);
        if (razerKindOf(event.name) === 'keyboard') {
          (deps.loadKeyboard ?? loadChromaKeyboard)(event.container)
            .then((lamps) => {
              if (lamps && razer.get(event.container) === event) {
                keyboards.set(event.container, lamps);
                publish();
              }
              return undefined;
            })
            .catch(() => undefined);
        }
        hasRazer = razerCandidates(razer).length > 0;
        if (first && hasRazer) {
          chroma.probe();
        }
        break;
      }
      case 'razer-removed':
        razer.delete(event.container);
        keyboards.delete(event.container);
        hasRazer = razerCandidates(razer).length > 0;
        break;
      case 'enumerated':
        pending[event.source] = false;
        if (!pending.lamparray && !pending.razer) {
          snapshot = undefined;
        }
        break;
      case 'error':
        console.error(
          `Dynamic lighting helper: ${event.message}${event.detail ? ` (${event.detail})` : ''}`,
        );
        break;
      default:
        break;
    }
    publish();
  };

  const forgetDevices = () => {
    heldWindows.forEach((index) => outputs.delete(`windows:${index}`));
    heldWindows.clear();
    if (windows.size > 0 || razer.size > 0) {
      snapshot = buildDeviceList(
        windows,
        razer,
        settings,
        chroma.state(),
        keyboards,
      );
    }
    pending.lamparray = false;
    pending.razer = false;
    windows.clear();
    razer.clear();
    keyboards.clear();
    hasRazer = false;
  };

  const stopHelper = () => {
    const running = host;
    host = undefined;
    hostIdentity = false;
    forgetDevices();
    running?.close();
    deps.onHelperPid?.(undefined);
  };

  const startHelper = () => {
    if (host || !wantsHelper() || !LIGHTING_EXECUTABLE) {
      return;
    }
    const folder = findFolder();
    if (!folder) {
      return;
    }
    const started: ILightingHost = startHost(
      path.join(folder, LIGHTING_EXECUTABLE),
      (event) => onHelperEvent(started)(event),
      (detail) => {
        if (host !== started) {
          return;
        }
        console.error(`Dynamic lighting helper stopped: ${detail}`);
        helperFailures += 1;
        host = undefined;
        forgetDevices();
        // Nothing is coming to replace the list if no helper follows.
        snapshot = wantsHelper() ? snapshot : undefined;
        deps.onHelperPid?.(undefined);
        publish();
      },
    );
    host = started;
    pending.lamparray = true;
    pending.razer = true;
    deps.onHelperPid?.(started.pid);
  };

  /** Once per launch, the first time lighting is on. */
  const checkIdentity = () => {
    if (!deps.supported || !settings.enabled || identity !== undefined) {
      return;
    }
    identity = 'pending';
    const register = async () => {
      try {
        identity = await ensureIdentity(findFolder());
      } catch {
        identity = 'failed';
        return;
      }
      // A helper started before the registration has no identity; the next
      // one does. Restarting drops nothing but the lamps it held.
      if (identity === 'registered' && host && !hostIdentity) {
        stopHelper();
        startHelper();
      }
    };
    register().catch(() => undefined);
  };

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

  const release = () => {
    if (!live) {
      return;
    }
    live = false;
    ambient = false;
    chroma.release();
    stopHelper();
    // Faded in again from dark next time, not from where the last song left.
    outputs.clear();
    startHelper();
    publish();
  };

  checkIdentity();

  return {
    state,
    setSettings: (raw) => {
      settings = readLightingSettings(raw, settings);
      try {
        saveLightingSettings(deps.userDataDir, settings);
      } catch (error) {
        console.error('Dynamic lighting settings could not be saved:', error);
      }
      if (!settings.enabled) {
        release();
      }
      checkIdentity();
      publish();
      return state();
    },
    watch: (open) => {
      watchers = Math.max(0, watchers + (open ? 1 : -1));
      if (open) {
        startHelper();
        chroma.probe();
      } else if (!wantsHelper()) {
        stopHelper();
      }
      publish();
    },
    frame: (raw) => {
      const frame = readLightingFrame(raw);
      if (!frame || !deps.supported || !settings.enabled || !deps.entitled()) {
        release();
        return;
      }
      if (!live) {
        live = true;
        startHelper();
        publish();
      } else if (!host) {
        // Ended by itself mid-song; within its failure budget it comes back.
        startHelper();
      }
      if (ambient !== (frame.ambient ?? false)) {
        ambient = frame.ambient ?? false;
        publish();
      }
      const mood = measureMood(frame);
      const profile = lightingProfile(settings.profiles, frame.sceneId);
      const shaping = (kind: TLightingKind, group: string) => ({
        kind,
        brightness: settings.brightness,
        pulse: settings.pulse,
        tuning: deviceTuning(profile, group),
        idle: profile.idle,
        idleBrightness: profile.idleBrightness,
      });
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
          shaping(kind, group),
          output.memory,
          output.rgb,
        );
        return output.rgb;
      };

      // Razer's service only on a machine with Razer devices: every session
      // registers an app in Razer Chroma, and a desk without Razer has no
      // reason to have one.
      if (hasRazer) {
        chroma.frame();
        CHROMA_CHANNELS.forEach((channel) => {
          const keyboard =
            channel === 'keyboard'
              ? singleChromaKeyboard(razer, keyboards)
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
              CHANNEL_KIND[channel],
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
        stopHelper();
        startHelper();
      }
      const running = host;
      // Razer and Windows enumerate independently. Wait for classification
      // before acquiring a Windows twin, or each fresh helper can acquire it
      // just before the Razer row arrives and trigger another restart.
      if (running && !pending.razer) {
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
      // No publish here: nothing the page lists changes with a frame. What
      // does — a device held back, Razer's answer — arrives as its own event.
    },
    release,
    windowGone: () => {
      watchers = 0;
      release();
      if (!wantsHelper()) {
        stopHelper();
      }
      publish();
    },
    recheckSynapse: () => {
      if (watchers > 0 || razerCandidates(razer).length > 0) {
        chroma.probe();
      }
    },
    helperPid: () => host?.pid,
    dispose: () => {
      live = false;
      chroma.release();
      stopHelper();
    },
  };
};
