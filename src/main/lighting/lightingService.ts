/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { describeRazer } from '../../common/lighting/razerDevices';
import {
  readLightingFrame,
  readLightingSettings,
  type ILamp,
  type ILightingDevice,
  type ILightingFrame,
  type ILightingSettings,
  type ILightingState,
  type TSynapseState,
} from '../../common/lighting/lightingModel';
import { createChromaClient, type IChromaClient } from './chromaClient';
import { loadChromaKeyboard } from './chromaKeyboard';
import {
  buildDeviceList,
  razerCandidates,
  toWindowsDevice,
  type IWindowsDevice,
} from './lightingDevices';
import { createFrameRouter } from './lightingFrameRouter';
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
import type {
  ILightingSettingsEvent,
  IRazerEvent,
  THelperEvent,
} from './lightingWire';
import {
  describeWindowsHold,
  heldWindowsDevices,
  windowsBackgroundOf,
  type IHeldDevice,
} from './windowsControl';

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
  /**
   * A frame of the page's demo without Plus: on the devices for as long as
   * they keep coming — the page is open — and never with Plus, where the
   * switch decides.
   */
  demoFrame(raw: unknown): void;
  release(): void;
  /** The window reloaded or went away without saying so. */
  windowGone(): void;
  /**
   * The member came back to the window, where whatever they changed outside
   * it — Razer Chroma started, Developer Mode turned on — should show.
   */
  windowFocused(): void;
  helperPid(): number | undefined;
  dispose(): void;
}

/** A helper that dies this often in one session is not restarted again. */
const MAX_HELPER_FAILURES = 3;

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
  /** The page's demo without Plus is what is lighting the devices. */
  let demoLit = false;
  let host: ILightingHost | undefined;
  let hostIdentity = false;
  // What the running helper reported: FluidEQ's package family name while it
  // has identity, and the member's Dynamic Lighting settings.
  let familyName: string | undefined;
  let windowsSettings: ILightingSettingsEvent | undefined;
  let helperFailures = 0;
  let identity: TIdentityOutcome | 'pending' | undefined;
  const windows = new Map<number, IWindowsDevice>();
  const razer = new Map<string, IRazerEvent>();
  const keyboards = new Map<string, readonly ILamp[]>();
  // Kept beside the map rather than counted per frame.
  let hasRazer = false;
  const router = createFrameRouter();
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

  const heldDevices = (): IHeldDevice[] =>
    live
      ? heldWindowsDevices(windows, razer, chroma.state(), settings.muted)
      : [];

  const heldByWindows = (): string[] =>
    heldDevices().map((device) => device.name);

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
      windowsBackground: windowsBackgroundOf(identity),
      windowsHold: describeWindowsHold(
        heldDevices(),
        windowsBackgroundOf(identity),
        windowsSettings,
        familyName,
      ),
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
        familyName = event.familyName;
        break;
      case 'lighting-settings':
        windowsSettings = event;
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
        if (describeRazer(event).kind === 'keyboard') {
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
    heldWindows.forEach(router.forgetWindows);
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
    // Asked again after "Developer Mode is off": the member may have turned
    // it on since, and opening the page or the switch is when they expect it
    // to have worked.
    if (
      !deps.supported ||
      !(settings.enabled || demoLit) ||
      (identity !== undefined && identity !== 'developer-mode-off')
    ) {
      return;
    }
    identity = 'pending';
    const register = async () => {
      try {
        identity = await ensureIdentity(findFolder());
      } catch {
        identity = 'failed';
        publish();
        return;
      }
      // What the page may tell the member about Windows' settings changed.
      publish();
      // A helper started before the registration has no identity; the next
      // one does. Restarting drops nothing but the lamps it held.
      if (identity === 'registered' && host && !hostIdentity) {
        stopHelper();
        startHelper();
      }
    };
    register().catch(() => undefined);
  };

  const release = () => {
    demoLit = false;
    if (!live) {
      return;
    }
    live = false;
    ambient = false;
    chroma.release();
    stopHelper();
    router.clear();
    startHelper();
    publish();
  };

  /** A frame that reaches the devices, the member's or the demo's. */
  const deliver = (frame: ILightingFrame) => {
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
    router.route(frame, {
      settings,
      chroma,
      razer,
      hasRazer,
      keyboards,
      windows,
      heldWindows,
      razerPending: pending.razer,
      host: () => host,
      restartHelper: () => {
        stopHelper();
        startHelper();
      },
    });
    // No publish here: nothing the page lists changes with a frame. What
    // does — a device held back, Razer's answer — arrives as its own event.
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
        checkIdentity();
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
      deliver(frame);
    },
    demoFrame: (raw) => {
      const frame = readLightingFrame(raw);
      // With Plus the switch decides, and a page with Plus sends no demo.
      if (!frame || !deps.supported || deps.entitled()) {
        return;
      }
      if (!demoLit) {
        demoLit = true;
        // Windows lends its lamps to an app it can identify, demo or not.
        checkIdentity();
      }
      deliver(frame);
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
    windowFocused: () => {
      // Back from Windows' developer settings, Developer Mode may be on now;
      // the page is where that shows, and opening it asks again anyway.
      if (watchers > 0) {
        checkIdentity();
      }
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
