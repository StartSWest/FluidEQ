/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import type { ISongIdentity, TSongSource } from '../../common/songIdentity';
import { TError, TSuccess } from '../../renderer/utils/equalizerApi';

/**
 * What every Auto EQ sound channel checks before anything the window sent is
 * kept in a file that lives for good (`songSound.ts`, `songSoundLibrary.ts`).
 */

/** Longer than any path, title or artist a player reports; a cap, not a fit. */
export const MAX_TEXT = 2048;

/** More songs than one selection or one album hands over at once. */
export const MAX_SONGS_AT_ONCE = 20000;

const SOURCES: readonly string[] = [
  'library',
  'karaoke',
  'media',
  'system',
  'remote',
] satisfies readonly TSongSource[];

export const isText = (value: unknown, isOptional = false): value is string =>
  (isOptional && value === undefined) ||
  (typeof value === 'string' && value.length <= MAX_TEXT);

/**
 * A song as the window names it, every string bounded and the source one of
 * the five.
 */
export const isIdentity = (value: unknown): value is ISongIdentity => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { key, alias, title, artist, source, albumKey, isVideo } =
    value as Record<string, unknown>;
  return (
    isText(key) &&
    key !== '' &&
    isText(title) &&
    isText(alias, true) &&
    isText(artist, true) &&
    isText(albumKey, true) &&
    (isVideo === undefined || typeof isVideo === 'boolean') &&
    typeof source === 'string' &&
    SOURCES.includes(source)
  );
};

/** Bounded text ids — track ids, mostly — or nothing. */
export const toTextList = (value: unknown): string[] | undefined =>
  Array.isArray(value) &&
  value.length <= MAX_SONGS_AT_ONCE &&
  value.every((one) => isText(one) && one !== '')
    ? (value as string[])
    : undefined;

export const replyInvalidParameter = (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum,
): void => {
  const reply: TError = { errorCode: ErrorCode.INVALID_PARAMETER };
  event.reply(channel, reply);
};

export const replySuccess = <T>(
  event: Electron.IpcMainEvent,
  channel: ChannelEnum,
  result: T,
): void => {
  const reply: TSuccess<T> = { result };
  event.reply(channel, reply);
};
