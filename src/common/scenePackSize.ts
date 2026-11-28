/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_PACK_BYTES, type IScenePack } from './scenePacks';

/**
 * How much a scene weighs as it is published, and the most a member may
 * publish (Ivan, 2026-11-07: "show the full size of the entire package and
 * we limit to a reasonable size so we make users optimize it").
 *
 * Every listener downloads the whole pack to play it, so its weight is paid
 * by everybody who picks it. FluidEQ's own scenes weigh 1 to 7 MB and the
 * member scenes in the gallery 2.0, 2.6 and 4.8 MB (measured 2026-11-07).
 * It was 5 MB from then until a 3D scene with 2.5 MB of artwork and 3.1 MB
 * of models could not be published (Ivan, 2026-11-28: "time to increase the
 * limit to 10 mb"). The server signs to the same number
 * (`MAX_PACK_JSON_BYTES`), and every FluidEQ up to 2.5 downloads a member's
 * scene to about 9.4 MB, so one between that and 10 MB opens only on a
 * FluidEQ that has this limit.
 */
export const MAX_PUBLISH_BYTES = 10 * 1024 * 1024;

export interface IScenePackSize {
  /** The pack as it travels, whole. */
  total: number;
  /** Its artwork image, as the pack carries it. */
  artwork: number;
  /** A 3D world's models. */
  models: number;
  /** Everything else: the code, the controls, the settings. */
  rest: number;
  limit: number;
}

const bytesOf = (value: unknown) =>
  value === undefined
    ? 0
    : new TextEncoder().encode(JSON.stringify(value)).byteLength;

/** The weight of each part of a pack, measured as it is sent. */
export const scenePackSize = (pack: IScenePack): IScenePackSize => {
  const total = bytesOf(pack);
  const artwork = bytesOf(pack.artwork);
  const models = bytesOf(pack.world?.models);
  return {
    total,
    artwork,
    models,
    rest: Math.max(0, total - artwork - models),
    limit: Math.min(MAX_PUBLISH_BYTES, MAX_PACK_BYTES),
  };
};

const MEBIBYTE = 1024 * 1024;

/**
 * A weight as the member reads it: megabytes to one decimal where it counts
 * ("4.8 MB", "5 MB"), kilobytes under a tenth of one ("12 KB", where "0 MB"
 * said nothing), in the reader's own number format.
 */
export const formatPackBytes = (bytes: number, locale?: string) => {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return bytes < MEBIBYTE / 10
    ? `${number.format(Math.max(1, Math.round(bytes / 1024)))} KB`
    : `${number.format(bytes / MEBIBYTE)} MB`;
};

/** Whether a pack is past what a member may publish. */
export const tooLargeToPublish = (pack: IScenePack) =>
  scenePackSize(pack).total > MAX_PUBLISH_BYTES;
