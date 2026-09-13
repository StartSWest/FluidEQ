/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The lighting helper's wire, from this side. `native/lighting-host/src/wire.h`
 * is the other side; `lightingWire.test.ts` and `wire_test.cpp` hold the two
 * to the same layout.
 *
 * To the helper: a binary colour frame per device. From the helper: one line
 * of JSON per event. Every line is checked field by field before any of it is
 * believed — a helper from a different build reading a different layout must
 * come out as "no event", never as a lamp at the wrong place.
 */

import { StringDecoder } from 'string_decoder';

/** "FLH1", little-endian. */
export const LIGHTING_WIRE_MAGIC = 0x31484c46;
export const LIGHTING_PROTOCOL_VERSION = 1;
const COLOURS_FRAME = 1;
const HEADER_BYTES = 12;
export const MAX_WIRE_LAMPS = 4096;

/** One device's colours, three bytes (R, G, B) per lamp, in lamp order. */
export const encodeColoursFrame = (device: number, rgb: Uint8Array): Buffer => {
  const lamps = Math.min(MAX_WIRE_LAMPS, Math.floor(rgb.length / 3));
  const payload = 8 + lamps * 3;
  const frame = Buffer.allocUnsafe(HEADER_BYTES + payload);
  frame.writeUInt32LE(LIGHTING_WIRE_MAGIC, 0);
  frame.writeUInt32LE(COLOURS_FRAME, 4);
  frame.writeUInt32LE(payload, 8);
  frame.writeUInt32LE(device, 12);
  frame.writeUInt32LE(lamps, 16);
  frame.set(rgb.subarray(0, lamps * 3), 20);
  return frame;
};

/** Windows.Devices.Lights.LampArrayKind, as the helper reports it. */
export const LAMP_ARRAY_KIND = {
  undefined: 0,
  keyboard: 1,
  mouse: 2,
  gameController: 3,
  peripheral: 4,
  scene: 5,
  notification: 6,
  chassis: 7,
  wearable: 8,
  furniture: 9,
  art: 10,
  headset: 11,
  microphone: 12,
  speaker: 13,
} as const;

export interface IReadyEvent {
  type: 'ready';
  protocol: number;
  identity: boolean;
  /** The package family name Windows lists under Background light control. */
  familyName?: string;
}

/** One device's own page in Settings > Personalization > Dynamic Lighting. */
export interface IDeviceLightingSettings {
  /** The device interface path without `\\?\`, as Settings keys it. */
  id: string;
  enabled?: boolean;
  foregroundFirst?: boolean;
  /** Background light control order, top first, by package family name. */
  providers?: readonly string[];
}

/**
 * What the member chose on Windows' Dynamic Lighting page (see
 * `native/lighting-host/src/lighting_settings.h`). Absent values were never
 * written — Settings not yet opened — and mean Windows' defaults.
 */
export interface ILightingSettingsEvent {
  type: 'lighting-settings';
  present: boolean;
  enabled?: boolean;
  foregroundFirst?: boolean;
  providers?: readonly string[];
  devices: readonly IDeviceLightingSettings[];
}

export interface ILampArrayEvent {
  type: 'lamparray';
  index: number;
  id: string;
  name: string;
  /** The Windows device container, shared with the same product's Razer entry. */
  container: string;
  kind: number;
  vendorId: number;
  productId: number;
  lampCount: number;
  /** Metres. */
  width: number;
  height: number;
  /** x, y, z per lamp, metres from the bounding box's top-left corner. */
  positions: readonly number[];
  minUpdateMs: number;
}

export interface ILampArrayRemovedEvent {
  type: 'lamparray-removed';
  index: number;
}

export interface IAvailableEvent {
  type: 'available';
  index: number;
  available: boolean;
}

export interface IRazerEvent {
  type: 'razer';
  container: string;
  name: string;
  /** The first product id Windows listed among its interfaces. */
  productId: number;
  /**
   * Every product id among its interfaces: a Base Station V2 Chroma is 0F20
   * for its lights and 48F0 for its media keys.
   */
  productIds?: readonly number[];
}

/** More interfaces than any Razer product has; a longer list is not one. */
const MAX_PRODUCT_IDS = 16;

export interface IRazerRemovedEvent {
  type: 'razer-removed';
  container: string;
}

export interface IEnumeratedEvent {
  type: 'enumerated';
  source: 'lamparray' | 'razer';
}

export interface IHelperErrorEvent {
  type: 'error';
  message: string;
  detail?: string;
}

export type THelperEvent =
  | IReadyEvent
  | ILightingSettingsEvent
  | ILampArrayEvent
  | ILampArrayRemovedEvent
  | IAvailableEvent
  | IRazerEvent
  | IRazerRemovedEvent
  | IEnumeratedEvent
  | IHelperErrorEvent;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const text = (value: unknown, limit = 512): string | undefined =>
  typeof value === 'string' && value.length <= limit ? value : undefined;

const readLampArray = (
  raw: Record<string, unknown>,
): ILampArrayEvent | undefined => {
  const { index, kind, vendorId, productId, lampCount, width, height } = raw;
  const id = text(raw.id, 2048);
  const name = text(raw.name);
  const container = text(raw.container);
  const { positions } = raw;
  if (
    !isIndex(index) ||
    id === undefined ||
    name === undefined ||
    container === undefined ||
    !isCount(kind) ||
    !isCount(vendorId) ||
    !isCount(productId) ||
    !isCount(lampCount) ||
    lampCount > MAX_WIRE_LAMPS ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !Array.isArray(positions) ||
    positions.length !== lampCount * 3 ||
    !positions.every(isFiniteNumber) ||
    !isCount(raw.minUpdateMs)
  ) {
    return undefined;
  }
  return {
    type: 'lamparray',
    index,
    id,
    name,
    container,
    kind,
    vendorId,
    productId,
    lampCount,
    width,
    height,
    positions,
    minUpdateMs: raw.minUpdateMs,
  };
};

const flag = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/** A provider list, or undefined when absent or not a list of names. */
const providerList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || value.length > 64) {
    return undefined;
  }
  const names = value.map((entry) => text(entry, 256));
  return names.every((name): name is string => name !== undefined)
    ? names
    : undefined;
};

const optional = <K extends string, V>(key: K, value: V | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;

const readLightingSettings = (
  raw: Record<string, unknown>,
): ILightingSettingsEvent | undefined => {
  if (typeof raw.present !== 'boolean') {
    return undefined;
  }
  const rawDevices = Array.isArray(raw.devices) ? raw.devices : [];
  // Settings keeps a key per device per USB port ever plugged in; a machine
  // with hundreds is broken, not busy, and the page needs only connected ones.
  const devices = rawDevices.slice(0, 512).flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const id = text(entry.id, 2048);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        ...optional('enabled', flag(entry.enabled)),
        ...optional('foregroundFirst', flag(entry.foregroundFirst)),
        ...optional('providers', providerList(entry.providers)),
      },
    ];
  });
  return {
    type: 'lighting-settings',
    present: raw.present,
    ...optional('enabled', flag(raw.enabled)),
    ...optional('foregroundFirst', flag(raw.foregroundFirst)),
    ...optional('providers', providerList(raw.providers)),
    devices,
  };
};

/** One line from the helper, or undefined for anything that is not an event. */
export const parseHelperEvent = (line: string): THelperEvent | undefined => {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(raw)) {
    return undefined;
  }
  switch (raw.type) {
    case 'ready':
      return isCount(raw.protocol) && typeof raw.identity === 'boolean'
        ? {
            type: 'ready',
            protocol: raw.protocol,
            identity: raw.identity,
            ...optional('familyName', text(raw.familyName, 256)),
          }
        : undefined;
    case 'lighting-settings':
      return readLightingSettings(raw);
    case 'lamparray':
      return readLampArray(raw);
    case 'lamparray-removed':
      return isIndex(raw.index)
        ? { type: 'lamparray-removed', index: raw.index }
        : undefined;
    case 'available':
      return isIndex(raw.index) && typeof raw.available === 'boolean'
        ? { type: 'available', index: raw.index, available: raw.available }
        : undefined;
    case 'razer': {
      const container = text(raw.container);
      const name = text(raw.name);
      if (!container || name === undefined || !isCount(raw.productId)) {
        return undefined;
      }
      // A helper built before it reported every id sends only the first.
      const { productIds } = raw;
      return {
        type: 'razer',
        container,
        name,
        productId: raw.productId,
        ...(Array.isArray(productIds) &&
        productIds.length <= MAX_PRODUCT_IDS &&
        productIds.every(isCount)
          ? { productIds }
          : {}),
      };
    }
    case 'razer-removed': {
      const container = text(raw.container);
      return container ? { type: 'razer-removed', container } : undefined;
    }
    case 'enumerated':
      return raw.source === 'lamparray' || raw.source === 'razer'
        ? { type: 'enumerated', source: raw.source }
        : undefined;
    case 'error': {
      const message = text(raw.message);
      const detail = text(raw.detail, 2048);
      return message === undefined
        ? undefined
        : { type: 'error', message, ...(detail ? { detail } : {}) };
    }
    default:
      return undefined;
  }
};

/**
 * Splits a byte stream into lines. The helper writes whole lines, but a pipe
 * delivers whatever fits in one read — half a line, or three.
 */
export const createLineSplitter = (onLine: (line: string) => void) => {
  // A decoder rather than `toString`: a read can end inside a multi-byte
  // character, and a device name in Japanese would otherwise arrive as two
  // replacement characters.
  const decoder = new StringDecoder('utf8');
  let pending = '';
  return (chunk: Buffer) => {
    pending += decoder.write(chunk);
    let newline = pending.indexOf('\n');
    while (newline >= 0) {
      const line = pending.slice(0, newline).trim();
      pending = pending.slice(newline + 1);
      if (line) {
        onLine(line);
      }
      newline = pending.indexOf('\n');
    }
    // A line longer than any event is a helper that has stopped writing
    // lines; keep the process's memory from following it.
    if (pending.length > 1_048_576) {
      pending = '';
    }
  };
};
