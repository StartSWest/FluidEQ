/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { CHROMA_CHANNEL_KIND } from './lampLayouts';
import type { ILightingDevice, TLightingKind } from './lightingModel';

export const LIGHTING_EFFECTS = ['scene', 'flow', 'spectrum', 'pulse'] as const;
export type TLightingEffect = (typeof LIGHTING_EFFECTS)[number];
export const LIGHTING_FOCUS = ['balanced', 'bass', 'mid', 'treble'] as const;
export type TLightingFocus = (typeof LIGHTING_FOCUS)[number];
export const LIGHTING_IDLE = ['flow', 'breathe', 'hold'] as const;
export type TLightingIdle = (typeof LIGHTING_IDLE)[number];

export interface IDeviceLightingTuning {
  effect: TLightingEffect;
  brightness: number;
  backgroundBrightness: number;
  foregroundBrightness: number;
  sceneScale: number;
  sceneOffsetX: number;
  sceneOffsetY: number;
  sensitivity: number;
  speed: number;
  saturation: number;
  smoothing: number;
  spread: number;
  reverse: boolean;
  focus: TLightingFocus;
}

export interface ILightingProfile {
  tuning: IDeviceLightingTuning;
  devices: Readonly<Record<string, Partial<IDeviceLightingTuning>>>;
  idle: TLightingIdle;
  idleBrightness: number;
  idleSpeed: number;
}

export const DEFAULT_DEVICE_TUNING: IDeviceLightingTuning = {
  effect: 'scene',
  brightness: 1,
  backgroundBrightness: 1,
  foregroundBrightness: 1,
  sceneScale: 1,
  sceneOffsetX: 0,
  sceneOffsetY: 0,
  sensitivity: 1,
  speed: 0.7,
  saturation: 1,
  smoothing: 0.5,
  spread: 0.75,
  reverse: false,
  focus: 'balanced',
};

export const DEFAULT_LIGHTING_PROFILE: ILightingProfile = {
  tuning: DEFAULT_DEVICE_TUNING,
  devices: {},
  idle: 'flow',
  idleBrightness: 0.38,
  idleSpeed: 0.35,
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const unit = (value: unknown, fallback: number, min = 0, max = 1): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
const choice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T =>
  typeof value === 'string' && choices.includes(value as T)
    ? (value as T)
    : fallback;
const safeKey = (key: string) =>
  key.length > 0 &&
  key.length < 256 &&
  !['__proto__', 'constructor', 'prototype'].includes(key);

export const readDeviceTuning = (
  raw: unknown,
  base = DEFAULT_DEVICE_TUNING,
): IDeviceLightingTuning => {
  if (!record(raw)) {
    return base;
  }
  return {
    effect: choice(raw.effect, LIGHTING_EFFECTS, base.effect),
    brightness: unit(raw.brightness, base.brightness),
    sceneScale: unit(raw.sceneScale, base.sceneScale, 0.5, 2),
    sceneOffsetX: unit(raw.sceneOffsetX, base.sceneOffsetX, -0.5, 0.5),
    sceneOffsetY: unit(raw.sceneOffsetY, base.sceneOffsetY, -0.5, 0.5),
    backgroundBrightness: unit(
      raw.backgroundBrightness,
      base.backgroundBrightness,
      0,
      4,
    ),
    sensitivity: unit(raw.sensitivity, base.sensitivity, 0.25, 2),
    foregroundBrightness: unit(
      raw.foregroundBrightness,
      base.foregroundBrightness,
      0,
      2,
    ),
    speed: unit(raw.speed, base.speed, 0.1, 2),
    saturation: unit(raw.saturation, base.saturation, 0.5, 2),
    smoothing: unit(raw.smoothing, base.smoothing),
    spread: unit(raw.spread, base.spread),
    reverse: typeof raw.reverse === 'boolean' ? raw.reverse : base.reverse,
    focus: choice(raw.focus, LIGHTING_FOCUS, base.focus),
  };
};

const readDeviceOverrides = (raw: unknown): ILightingProfile['devices'] => {
  if (!record(raw)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([key, value]) => safeKey(key) && record(value))
      .slice(0, 64)
      .map(([key, value]) => {
        const tuning = readDeviceTuning(value);
        // Keep inheritance: an override stores only controls explicitly changed.
        return [
          key,
          Object.fromEntries(
            Object.entries(tuning).filter(
              ([field]) => record(value) && field in value,
            ),
          ),
        ];
      }),
  );
};

export const readLightingProfile = (raw: unknown): ILightingProfile => {
  if (!record(raw)) {
    return DEFAULT_LIGHTING_PROFILE;
  }
  return {
    tuning: readDeviceTuning(raw.tuning),
    devices: readDeviceOverrides(raw.devices),
    idle: choice(raw.idle, LIGHTING_IDLE, 'flow'),
    idleBrightness: unit(
      raw.idleBrightness,
      DEFAULT_LIGHTING_PROFILE.idleBrightness,
      0.05,
      0.8,
    ),
    idleSpeed: unit(raw.idleSpeed, DEFAULT_LIGHTING_PROFILE.idleSpeed, 0.1, 1),
  };
};

export const readLightingProfiles = (
  raw: unknown,
): Readonly<Record<string, ILightingProfile>> =>
  record(raw)
    ? Object.fromEntries(
        Object.entries(raw)
          .filter(([key]) => safeKey(key))
          .slice(0, 64)
          .map(([key, value]) => [key, readLightingProfile(value)]),
      )
    : {};

/**
 * The tuning a device shares. Razer Chroma lights a channel, not a device, so
 * every device on one channel shows the same colours and takes one tuning;
 * any other device is tuned on its own.
 */
export const deviceLightingGroup = (device: ILightingDevice): string => {
  if (device.route !== 'synapse') {
    return device.key;
  }
  if (device.chromaChannel) {
    return `chroma:${device.chromaChannel}`;
  }
  // A main process from before `chromaChannel` lists devices without it.
  if (/kraken v4 pro|base station/i.test(device.name)) {
    return 'chroma:mousepad';
  }
  const channel: Partial<Record<TLightingKind, string>> = {
    stand: 'chromalink',
    speaker: 'chromalink',
    accessory: 'chromalink',
  };
  return `chroma:${channel[device.kind] ?? device.kind}`;
};

/**
 * Which part of the music a device's colours follow: its Chroma channel's,
 * where Razer Chroma lights it — a Mouse Dock Pro on the mousepad channel
 * moves like a mousepad — and its own kind everywhere else.
 */
export const deviceLightingKind = (device: ILightingDevice): TLightingKind => {
  if (device.route === 'synapse' && device.chromaChannel) {
    return CHROMA_CHANNEL_KIND[device.chromaChannel];
  }
  return deviceLightingGroup(device) === 'chroma:mousepad'
    ? 'mousepad'
    : device.kind;
};

export const lightingProfile = (
  profiles: Readonly<Record<string, ILightingProfile>> | undefined,
  sceneId?: string,
): ILightingProfile =>
  (sceneId ? profiles?.[sceneId] : undefined) ?? DEFAULT_LIGHTING_PROFILE;

export const deviceTuning = (
  profile: ILightingProfile,
  group: string,
): IDeviceLightingTuning => ({
  ...DEFAULT_DEVICE_TUNING,
  ...profile.tuning,
  ...profile.devices[group],
});
