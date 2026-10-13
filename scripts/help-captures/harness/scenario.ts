/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import ChannelEnum from 'common/channels';
import {
  FilterTypeEnum,
  getDefaultState,
  type IFilter,
  type IFiltersMap,
} from 'common/constants';
import type { IEqualizerSnapshot } from 'common/outputSettings';
import type { IAudioDevice, IDeviceProfileSettings } from 'common/profileTypes';
import type { IAudioEngineStatus } from 'common/audioEngine';
import { DEFAULT_LIGHTING_SETTINGS } from 'common/lighting/lightingModel';
import type { TEmit } from './fakeMain';
import { FORUM_INVOKES } from './forumScenario';

/**
 * The machine the captures show: three outputs, the FluidEQ Engine on all of
 * them, a ten-band EQ with a gentle shape on the headset, and two profiles.
 * Made-up names of real products and nothing of anybody's: no account, no
 * library, no other computer's address.
 */

type TAnswer = (args: unknown[], emit: TEmit) => unknown;

const HEADSET = 'harness-headset';
const SPEAKERS = 'harness-speakers';
const WIRELESS = 'harness-wireless';

export const DEVICES: IAudioDevice[] = [
  {
    id: `{0.0.0.00000000}.{${HEADSET}}`,
    guid: HEADSET,
    name: 'Kraken V4 Pro',
    isDefault: true,
    isActive: true,
    isEqualizerApoAttached: false,
    isFluidEngineAttached: true,
    canHostEffects: true,
    effectsEnabled: true,
    sampleRate: 48000,
    channels: 2,
  },
  {
    id: `{0.0.0.00000000}.{${SPEAKERS}}`,
    guid: SPEAKERS,
    name: 'Speakers (Realtek Audio)',
    isDefault: false,
    isActive: true,
    isEqualizerApoAttached: false,
    isFluidEngineAttached: true,
    canHostEffects: true,
    effectsEnabled: true,
    sampleRate: 48000,
    channels: 2,
  },
  {
    id: `{0.0.0.00000000}.{${WIRELESS}}`,
    guid: WIRELESS,
    name: 'BlackShark V2 Pro',
    isDefault: false,
    isActive: true,
    isEqualizerApoAttached: false,
    isFluidEngineAttached: true,
    canHostEffects: true,
    effectsEnabled: true,
    sampleRate: 48000,
    channels: 2,
    batteryPercent: 80,
  },
];

/** Ten bands with a gentle lift at both ends and a dip where voices crowd. */
const BANDS: readonly [number, number, number][] = [
  [31, 3.5, 1.2],
  [62, 2.5, 1.2],
  [125, 1, 1.2],
  [250, -1, 1.2],
  [500, -2, 1.2],
  [1000, -1, 1.2],
  [2000, 0.5, 1.2],
  [4000, 1.5, 1.2],
  [8000, 2.5, 1.2],
  [16000, 3, 1.2],
];

const filters = (): IFiltersMap =>
  Object.fromEntries(
    BANDS.map(([frequency, gain, quality], at): [string, IFilter] => {
      const id = `band-${at}`;
      return [id, { id, frequency, gain, quality, type: FilterTypeEnum.PK }];
    }),
  );

/**
 * `?scenario=channels`: the same headset with bands kept to one ear, the
 * kind of thing a person tunes per ear — a left driver a little bright in
 * the presence region, a right one recessed there and short of air.
 */
const isChannels =
  new URLSearchParams(window.location.search).get('scenario') === 'channels';

const EAR_BANDS: readonly IFilter[] = [
  {
    id: 'ear-left-1',
    frequency: 5600,
    gain: -2.5,
    quality: 3,
    type: FilterTypeEnum.PK,
    channel: 'left',
  },
  {
    id: 'ear-right-1',
    frequency: 3200,
    gain: 2,
    quality: 2,
    type: FilterTypeEnum.PK,
    channel: 'right',
  },
  {
    id: 'ear-right-2',
    frequency: 11000,
    gain: 2.5,
    quality: 1.4,
    type: FilterTypeEnum.HSC,
    channel: 'right',
  },
];

export const STATE: IEqualizerSnapshot = {
  ...getDefaultState(),
  filters: isChannels
    ? {
        ...filters(),
        ...Object.fromEntries(EAR_BANDS.map((band) => [band.id, band])),
      }
    : filters(),
  preAmp: -3.5,
  curveSmoothing: 'twelfth',
  // The headset is what Windows plays through and what the EQ page edits.
  playbackOutput: DEVICES[0],
  outputEditor: { device: DEVICES[0], generation: 1 },
};

const PROFILES: Record<string, string[]> = {
  [HEADSET]: ['Evening', 'Late night'],
  [SPEAKERS]: ['Desk'],
  [WIRELESS]: ['Travel'],
};

const PROFILE_SETTINGS: IDeviceProfileSettings = {
  version: 1,
  assignments: Object.fromEntries(
    DEVICES.map((device) => [
      device.id,
      {
        deviceId: device.id,
        deviceName: device.name,
        deviceGuid: device.guid,
        presetName: PROFILES[device.guid][0],
      },
    ]),
  ),
};

const ENGINE: IAudioEngineStatus = {
  engine: 'fluid',
  apo: { installed: false },
  fluidSupported: true,
  fluidUpdateReady: false,
  fluid: {
    installed: true,
    dllVersion: '1.20.0.0',
    unsignedAllowed: true,
    runtimeBeside: true,
    everRan: true,
    serviceCanWrite: true,
    endpoints: DEVICES.map((device) => ({
      guid: device.guid,
      attached: true,
      backupExists: true,
      slot: 'efx',
    })),
  },
};

/** Requests sent with `sendMessage`, by channel. */
export const REQUESTS: Record<string, TAnswer> = {
  [ChannelEnum.HEALTH_CHECK]: () => undefined,
  [ChannelEnum.GET_STATE]: () => STATE,
  [ChannelEnum.GET_ENABLE]: () => true,
  [ChannelEnum.GET_PREAMP]: () => STATE.preAmp,
  [ChannelEnum.GET_AUDIO_DEVICES]: () => DEVICES,
  [ChannelEnum.GET_DEVICE_PROFILE_SETTINGS]: () => PROFILE_SETTINGS,
  [ChannelEnum.GET_PRESET_FILE_LIST]: ([asked]) => {
    const { deviceId } = (asked ?? {}) as { deviceId?: string };
    const device = DEVICES.find((each) => each.id === deviceId) ?? DEVICES[0];
    return PROFILES[device.guid];
  },
  [ChannelEnum.GET_AUDIO_ENGINE_STATUS]: () => ENGINE,
  [ChannelEnum.GET_BAND_DESIGNS]: () => [],
  [ChannelEnum.GET_PRESET_BASELINE_NAMES]: () => [],
  [ChannelEnum.GET_CURVE_COMPARISON]: () => ({
    variant: 'B',
    eqVariant: 'B',
    eqSupported: true,
    hasSampledCurves: true,
    supported: true,
    // Under the FluidEQ Engine, which is what shows the phase rows.
    active: true,
    bandPhaseScopes: { eq: true, curves: true },
  }),
  [ChannelEnum.GET_TREBLE_DESIGN]: () => ({ eq: 'precise', curves: 'precise' }),
};

/** Calls made with `invoke`, by channel. */
export const INVOKES: Record<string, TAnswer> = {
  ...FORUM_INVOKES,
  'window-get-state': () => ({ mode: 'normal', isMaximized: true }),
  'window-is-maximized': () => true,
  // Signed out, no Plus: nothing of anybody's account is in a picture.
  'account-state': () => ({ status: 'signed-out' }),
  'entitlement-status': () => ({ state: 'none' }),
  'scene-packs-list': () => ({ entitled: false, packs: [], locked: [] }),
  'member-scenes-list': () => ({ entitled: false, scenes: [], locked: [] }),
  'lighting-state': () => ({
    supported: false,
    searching: false,
    settings: DEFAULT_LIGHTING_SETTINGS,
    devices: [],
    synapse: 'unknown',
    hasRazerDevices: false,
    heldByWindows: [],
    canOpenRazerChroma: false,
  }),
  'output-mirror-profiles': ([deviceId]) => {
    const device = DEVICES.find((each) => each.id === deviceId) ?? DEVICES[0];
    return {
      current: PROFILES[device.guid][0],
      names: PROFILES[device.guid],
    };
  },
  // A second output plays from the FluidEQ Engine, and the engine reports
  // how far behind it plays, as it does about twice a second.
  'output-mirror-start': ([token], emit) => {
    queueMicrotask(() => emit('output-mirror-delay', token, 21.3, 'engine'));
    return true;
  },
  'output-mirror-stop': () => undefined,
  'output-mirror-volume': () => undefined,
  // Share Audio: this computer keeps its code, and the capture script links
  // a computer to it once the page shows the code (`figures.ts`).
  'remote-audio-lan-saved-role': () => 'listener',
  'remote-audio-lan-restore': () => ({
    role: 'listener',
    details: {
      deviceName: 'Desk PC',
      options: [
        {
          address: '192.168.1.20',
          code: 'FLUIDEQ-LAN-2-HARNESS-NOT-A-REAL-CODE',
          deviceName: 'Desk PC',
        },
      ],
    },
  }),
  'remote-audio-lan-switches-for': () => ({
    send: true,
    play: true,
    paused: false,
    volume: 0.8,
  }),
  'remote-audio-lan-switches': () => undefined,
  // A desktop with one graphics card: the choice is not offered.
  'graphics-preference-get': () => ({
    chosen: 'auto',
    atLaunch: 'auto',
    supported: false,
  }),
  // The engine running on every output, as its statuses say once sound has
  // reached it.
  'engine-health': () => ({
    outputs: DEVICES.map((device) => ({
      endpoint: `{${device.guid.toUpperCase()}}`,
      locked: true,
      processing: true,
      owner: true,
      problems: [],
      channels: 2,
    })),
  }),
  'plus-terms-notice': () => null,
  'plus-welcome': () => null,
  'scene-review-notice': () => ({ notice: null }),
  'wallpaper-state': () => ({
    supported: true,
    displays: [],
    screens: [],
    pauseOnBattery: true,
  }),
};
