/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { IDspSettings, IEqSettings, clampDspSettings } from '../dsp/chain';
import {
  IPortableDspChain,
  portableDspChainSettings,
  portableDspCurve,
} from '../dsp/dspChainPresetFile';
import { cleanUserPresetName } from '../userPresetsFile';
import SHARE_BASE_V1 from './presetShareBase1.json';

/**
 * A preset as one line of text that pastes into any forum and comes back
 * whole: `FQP1.` and the preset, compressed (Ivan, 2026-11-20: "export to any
 * forums").
 *
 * The preset file is 9 to 21 KB of JSON, and a Discord message holds 2,000
 * characters. What travels is only what differs from the rack's defaults,
 * deflated and in URL-safe base64: over the 118 factory chains that measured
 * 282 to 1,059 characters, median 831, where the whole file deflated was
 * 2,048 to 2,351.
 *
 * The defaults it differs from are FROZEN per version
 * (`presetShareBase1.json`, written once from the defaults of 2026-11-20).
 * Diffed against whatever the defaults are on the day it is read, a code
 * made today would change its sound the first time a default moved. A field
 * added after version 1 is simply absent from version 1's base, and the
 * rack's clamp gives it its default, as for an old preset file.
 *
 * What is read back is data and nothing else: a name, numbers, switches and
 * the names of shapes, each clamped where it plays (`clampDspSettings`,
 * `clampPresetCurve`). A code is refused before it is unpacked past
 * `SHARE_CODE_MAX` characters, and unpacking stops at `SHARE_JSON_MAX` bytes,
 * so a small code that inflates into gigabytes stops at 64 KB.
 */

export const SHARE_CODE_VERSION = 1;
/** Longest payload read, in characters: four times the largest measured. */
export const SHARE_CODE_MAX = 4000;
/** Unpacking stops here: the largest measured preset was 8.3 KB. */
export const SHARE_JSON_MAX = 64 * 1024;

/** The page on fluideq.com that draws a shared preset and opens FluidEQ. */
export const SHARE_PAGE_URL = 'https://fluideq.com/p';
/** The link a page hands FluidEQ (`main/presetLinks.ts`). */
export const SHARE_APP_LINK_PREFIX = 'fluideq://preset/';

const CODE_PATTERN = /FQP(\d{1,3})\.([A-Za-z0-9_-]+)/;

/** Why a text gave no preset, as the import says it. */
export type TShareCodeProblem = 'missing' | 'newer' | 'damaged';

export type TShareCodeRead =
  | { ok: true; preset: IPortableDspChain }
  | { ok: false; problem: TShareCodeProblem };

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Keys that would reach a prototype if assigned: never copied. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** What of `value` differs from `base`; undefined when nothing does. */
export const diffFromBase = (value: unknown, base: unknown): unknown => {
  if (isRecord(value) && isRecord(base)) {
    const out: TRecord = {};
    Object.entries(value).forEach(([key, inner]) => {
      const changed = diffFromBase(inner, base[key]);
      if (changed !== undefined) {
        out[key] = changed;
      }
    });
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return JSON.stringify(value) === JSON.stringify(base) ? undefined : value;
};

/**
 * `diff` laid over `base`: objects merged key by key, everything else
 * replaced. Rebuilt rather than spread, so a key a hostile code names
 * `__proto__` is dropped at every depth instead of assigned.
 */
export const mergeOntoBase = (
  diff: unknown,
  base: unknown,
  depth = 0,
): unknown => {
  if (diff === undefined) {
    return base;
  }
  if (!isRecord(diff) || depth > 8) {
    return diff;
  }
  const from = isRecord(base) ? base : {};
  const out: TRecord = {};
  Object.entries(from).forEach(([key, inner]) => {
    out[key] = inner;
  });
  Object.entries(diff).forEach(([key, inner]) => {
    if (!UNSAFE_KEYS.has(key)) {
      out[key] = mergeOntoBase(inner, from[key], depth + 1);
    }
  });
  return out;
};

/** A name a profile list has, or a factory's: never somebody's own id. */
const PROFILE_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,63}$/;
const isSharedProfileName = (id: string): boolean =>
  id === '' ||
  (PROFILE_ID.test(id) && !id.startsWith('stage:') && !id.startsWith('user'));

/**
 * Each stage's `presetId` is a free string through the rack's clamp. On a
 * shared preset only a factory profile's name survives: the sender's own
 * saved profiles mean nothing on this machine, and anything else is text a
 * stranger chose.
 */
const withSharedProfileNames = (settings: IDspSettings): IDspSettings => {
  const out: TRecord = { ...settings };
  Object.entries(settings).forEach(([key, stage]) => {
    if (
      isRecord(stage) &&
      typeof stage.presetId === 'string' &&
      !isSharedProfileName(stage.presetId)
    ) {
      out[key] = { ...stage, presetId: '' };
    }
  });
  return out as unknown as IDspSettings;
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> | undefined => {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
};

/**
 * Bytes through a compression stream, read as they come out and abandoned
 * past `cap`. Undefined for anything the stream refuses.
 */
const through = async (
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
  cap: number,
): Promise<Uint8Array | undefined> => {
  const writer = transform.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());
  // Read below; a refusal surfaces there, and again here once awaited.
  written.catch(() => undefined);
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      // Each chunk depends on the one before; there is nothing to batch.
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > cap) {
        reader.cancel().catch(() => undefined);
        return undefined;
      }
      chunks.push(value);
    }
    await written;
  } catch {
    return undefined;
  }
  const out = new Uint8Array(total);
  let at = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, at);
    at += chunk.byteLength;
  });
  return out;
};

/** The preset as a share code, `FQP1.` and its payload. */
export const encodePresetShareCode = async (
  name: string,
  settings: IDspSettings,
  curve?: IEqSettings,
): Promise<string> => {
  const tone = portableDspCurve(curve);
  const payload = JSON.stringify({
    n: cleanUserPresetName(name),
    d: diffFromBase(portableDspChainSettings(settings), SHARE_BASE_V1) ?? {},
    ...(tone ? { c: tone } : {}),
  });
  const packed = await through(
    new TextEncoder().encode(payload),
    new CompressionStream('deflate-raw'),
    SHARE_JSON_MAX * 4,
  );
  if (!packed) {
    throw new Error('The preset could not be compressed');
  }
  return `FQP${SHARE_CODE_VERSION}.${toBase64Url(packed)}`;
};

/** The link that opens a share code on fluideq.com, readable by FluidEQ. */
export const presetShareLink = (code: string): string =>
  `${SHARE_PAGE_URL}#${code}`;

/** The first share code anywhere in `text`: a post, a link, a message. */
export const findPresetShareCode = (
  text: string,
): { version: number; payload: string } | undefined => {
  const match = CODE_PATTERN.exec(text);
  return match ? { version: Number(match[1]), payload: match[2] } : undefined;
};

/** The preset inside `text`, checked and clamped, or why there is none. */
export const readPresetShareCode = async (
  text: string,
): Promise<TShareCodeRead> => {
  const found = findPresetShareCode(text);
  if (!found) {
    return { ok: false, problem: 'missing' };
  }
  if (found.version !== SHARE_CODE_VERSION) {
    return {
      ok: false,
      problem: found.version > SHARE_CODE_VERSION ? 'newer' : 'damaged',
    };
  }
  const damaged: TShareCodeRead = { ok: false, problem: 'damaged' };
  if (found.payload.length > SHARE_CODE_MAX) {
    return damaged;
  }
  const packed = fromBase64Url(found.payload);
  if (!packed) {
    return damaged;
  }
  const bytes = await through(
    packed,
    new DecompressionStream('deflate-raw'),
    SHARE_JSON_MAX,
  );
  if (!bytes) {
    return damaged;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    );
  } catch {
    return damaged;
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.n !== 'string' ||
    (parsed.d !== undefined && !isRecord(parsed.d))
  ) {
    return damaged;
  }
  const name = cleanUserPresetName(parsed.n);
  if (name === '') {
    return damaged;
  }
  const settings = withSharedProfileNames(
    portableDspChainSettings(
      clampDspSettings(mergeOntoBase(parsed.d ?? {}, SHARE_BASE_V1)),
    ),
  );
  const curve = portableDspCurve(parsed.c);
  return {
    ok: true,
    preset: { name, settings, ...(curve ? { curve } : {}) },
  };
};
