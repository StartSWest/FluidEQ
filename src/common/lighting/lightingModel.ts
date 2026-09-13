/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  readLightingProfiles,
  type ILightingProfile,
} from './lightingProfiles';

/**
 * Dynamic lighting: a Plus member's keyboard, mouse, mousepad, headset and
 * stand take the colours of the scene on the graph and move with its music.
 *
 * Three processes share this vocabulary. The window renders the scene small
 * and sends the picture; the main process owns the settings, knows the
 * devices and maps the picture onto each one's lamps; the lighting helper (a
 * native exe, `native/lighting-host`) reaches Windows Dynamic Lighting. Razer
 * Synapse is reached from the main process directly, over its local service.
 */

/** Where a device is lit from. */
export type TLightingRoute = 'synapse' | 'windows';

/**
 * What a device is, for its picture on the page and for which part of the
 * music drives it most. Closed on purpose: every kind has a drawing and a name
 * in all ten locales.
 */
export type TLightingKind =
  | 'keyboard'
  | 'mouse'
  | 'mousepad'
  | 'headset'
  | 'keypad'
  | 'stand'
  | 'speaker'
  | 'accessory';

export const LIGHTING_KINDS: readonly TLightingKind[] = [
  'keyboard',
  'mouse',
  'mousepad',
  'headset',
  'keypad',
  'stand',
  'speaker',
  'accessory',
];

/** How strongly the lamps jump on a beat. */
export type TLightingPulse = 'off' | 'gentle' | 'full';

export const LIGHTING_PULSES: readonly TLightingPulse[] = [
  'off',
  'gentle',
  'full',
];

export interface ILightingSettings {
  /** Light the devices while a Plus scene is on the graph. Off until asked. */
  enabled: boolean;
  /** 0.1..1, a multiplier on every lamp. */
  brightness: number;
  pulse: TLightingPulse;
  /** Device keys the member switched off; they keep their own lighting. */
  muted: readonly string[];
  profiles: Readonly<Record<string, ILightingProfile>>;
}

export const MIN_LIGHTING_BRIGHTNESS = 0.1;

export const DEFAULT_LIGHTING_SETTINGS: ILightingSettings = {
  enabled: false,
  brightness: 0.85,
  pulse: 'full',
  muted: [],
  profiles: {},
};

/**
 * One lamp, placed on the scene's picture. `u` runs left to right and `v`
 * top to bottom, both 0..1. `reach` is how much of the picture around that
 * spot the lamp takes its light from, as a fraction of the picture's width: a
 * key is a small window, a headset's single glow is most of the picture.
 */
export interface ILamp {
  u: number;
  v: number;
  reach: number;
}

export interface ILightingDevice {
  /** Stable across launches: which route found it, and its id there. */
  key: string;
  /** As Windows or the maker names it — never translated. */
  name: string;
  kind: TLightingKind;
  /** The route this device is lit through right now, or none reaches it. */
  route: TLightingRoute | 'none';
  lamps: readonly ILamp[];
  /**
   * Devices lit as one by their route. Synapse addresses a kind, not a device:
   * two Razer headsets are one channel, and switching one off switches both.
   */
  channel: string;
  muted: boolean;
}

/**
 * What Razer Synapse's local service answered, last time it was asked.
 * `apps-off` is Razer Chroma's own "Chroma Apps" switch turned off: the
 * service answers and refuses to light anything for an app.
 */
export type TSynapseState = 'unknown' | 'running' | 'not-running' | 'apps-off';

export interface ILightingState {
  /** Only Windows has either route. */
  supported: boolean;
  /** Looking for devices for the first time; nothing is known yet. */
  searching: boolean;
  settings: ILightingSettings;
  devices: readonly ILightingDevice[];
  synapse: TSynapseState;
  /** Whether this machine has Razer devices Synapse would light. */
  hasRazerDevices: boolean;
  /**
   * Names of devices Windows is holding for the app in front: FluidEQ sent
   * them colours and Windows said the lamps are not FluidEQ's right now.
   */
  heldByWindows: readonly string[];
  /** Razer Chroma's launcher is installed, so the page can offer to open it. */
  canOpenRazerChroma: boolean;
  /**
   * The window is sending the scene's frames: lighting is on and a Plus scene
   * is playing. Not by itself proof that anything lights — see
   * `lightsAnyDevice`.
   */
  live: boolean;
  ambient?: boolean;
}

/**
 * Whether some device is taking the scene's colours right now: frames are
 * arriving and at least one device has a route and is not switched off. The
 * page said "Following Neon City" with Razer Chroma closed and nothing on the
 * desk lit, because it asked `live` alone.
 */
export const lightsAnyDevice = (state: ILightingState): boolean =>
  state.live &&
  state.devices.some((device) => device.route !== 'none' && !device.muted);

/**
 * The picture the lamps see, and the music it moved with. Sent by the window
 * about thirty times a second while a Plus scene plays, paced by the audio
 * itself rather than by a clock.
 */
export interface ILightingFrame {
  width: number;
  height: number;
  /** `width × height × 3` sRGB bytes, top row first. */
  rgb: Uint8Array;
  level: number;
  beat: number;
  bass: number;
  mid: number;
  treble: number;
  /** Audio time since the previous frame, in milliseconds. */
  deltaMs: number;
  sceneId?: string;
  timeSeconds?: number;
  ambient?: boolean;
  activity?: number;
}

/** The grid a scene is reduced to before it reaches the main process. */
export const LIGHTING_GRID_WIDTH = 48;
export const LIGHTING_GRID_HEIGHT = 27;

/** Main ← window: a frame, fire-and-forget. */
export const LIGHTING_FRAME_CHANNEL = 'lighting-frame';
/** Main ← window: no Plus scene, silence, or switched off — give the lamps back. */
export const LIGHTING_RELEASE_CHANNEL = 'lighting-release';
export const LIGHTING_STATE_CHANNEL = 'lighting-state';
export const LIGHTING_STATE_CHANGED_CHANNEL = 'lighting-state-changed';
export const LIGHTING_SETTINGS_CHANNEL = 'lighting-settings';
/** The page is open: find devices even while lighting is off. */
export const LIGHTING_WATCH_CHANNEL = 'lighting-watch';
export const LIGHTING_OPEN_WINDOWS_SETTINGS_CHANNEL =
  'lighting-open-windows-settings';
/** Answers whether Razer Chroma's launcher was found and started. */
export const LIGHTING_OPEN_RAZER_CHROMA_CHANNEL = 'lighting-open-razer-chroma';

export const LIGHTING_SETTINGS_FILENAME = 'lighting.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPulse = (value: unknown): value is TLightingPulse =>
  typeof value === 'string' &&
  (LIGHTING_PULSES as readonly string[]).includes(value);

const clampBrightness = (value: number): number =>
  Math.min(1, Math.max(MIN_LIGHTING_BRIGHTNESS, value));

/**
 * Whatever arrived — a file, an IPC payload — as settings, field by field.
 * A field that is missing or malformed takes its default rather than
 * discarding the fields around it that were fine.
 */
export const readLightingSettings = (
  raw: unknown,
  base: ILightingSettings = DEFAULT_LIGHTING_SETTINGS,
): ILightingSettings => {
  if (!isRecord(raw)) {
    return base;
  }
  const muted = Array.isArray(raw.muted)
    ? raw.muted.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.length > 0 && entry.length < 512,
      )
    : base.muted;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    brightness:
      typeof raw.brightness === 'number' && Number.isFinite(raw.brightness)
        ? clampBrightness(raw.brightness)
        : base.brightness,
    pulse: isPulse(raw.pulse) ? raw.pulse : base.pulse,
    muted: [...new Set(muted)].slice(0, 64),
    profiles:
      'profiles' in raw ? readLightingProfiles(raw.profiles) : base.profiles,
  };
};

/** A frame from the window, checked before any byte of it is trusted. */
export const readLightingFrame = (raw: unknown): ILightingFrame | undefined => {
  if (!isRecord(raw) || !(raw.rgb instanceof Uint8Array)) {
    return undefined;
  }
  const { width, height } = raw;
  if (
    width !== LIGHTING_GRID_WIDTH ||
    height !== LIGHTING_GRID_HEIGHT ||
    raw.rgb.length !== LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3
  ) {
    return undefined;
  }
  const unit = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(1, Math.max(0, value))
      : undefined;
  const level = unit(raw.level);
  const beat = unit(raw.beat);
  const bass = unit(raw.bass);
  const mid = unit(raw.mid);
  const treble = unit(raw.treble);
  const { deltaMs } = raw;
  if (
    level === undefined ||
    beat === undefined ||
    bass === undefined ||
    mid === undefined ||
    treble === undefined ||
    typeof deltaMs !== 'number' ||
    !Number.isFinite(deltaMs)
  ) {
    return undefined;
  }
  return {
    width: LIGHTING_GRID_WIDTH,
    height: LIGHTING_GRID_HEIGHT,
    rgb: raw.rgb,
    level,
    beat,
    bass,
    mid,
    treble,
    deltaMs: Math.min(250, Math.max(0, deltaMs)),
    sceneId:
      typeof raw.sceneId === 'string' && raw.sceneId.length < 256
        ? raw.sceneId
        : undefined,
    timeSeconds:
      typeof raw.timeSeconds === 'number' && Number.isFinite(raw.timeSeconds)
        ? Math.max(0, raw.timeSeconds)
        : undefined,
    ambient: raw.ambient === true,
    activity: unit(raw.activity),
  };
};
