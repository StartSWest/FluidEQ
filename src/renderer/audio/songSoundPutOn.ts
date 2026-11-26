/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IOutputEditor } from 'common/outputSettings';
import type { ISongIdentity } from 'common/songIdentity';
import {
  type ISongSound,
  type TSavedSound,
  isWholeSound,
} from 'common/songSound';
import type { ISongSoundMatch } from 'common/songSoundMemory';
import type { TSongSoundEvent } from 'common/songSoundRecorder';
import {
  applyDspSettings,
  endDspLoan,
  isDspLent,
  lendDspSettings,
  persistDspSettings,
  readDspSettings,
} from '../dsp/store';
import {
  resolveDspPreset,
  resolveDspPresetCurve,
} from '../dsp/dspPresetCatalog';
import { type ISongSoundLending, applySongSound } from '../utils/songSoundApi';
import songSoundOf from './songSoundOf';

/**
 * Putting a song's sound on — main's bands, Tone and curve, and the window's
 * rack — and reading a lookup's answer as a sound the window can play, for
 * the session that decides when (`songSoundSession.ts`), which hands in what
 * it owns.
 */
export interface ISongSoundPutOnHost {
  /** The editor a request was made for is still the one being edited. */
  isCurrent: (target: IOutputEditor) => boolean;
  /** Equalizer APO is the engine: the rack is held off under it. */
  isApo: () => boolean;
  /** The window reads main's state again once a sound landed. */
  refresh: () => Promise<void>;
}

/**
 * A saved sound whose preset is gone (a saved chain deleted since): a whole
 * one lends its Tone and bands over this rack, and a preset alone is no sound
 * at all.
 */
const playable = (
  sound: TSavedSound | undefined,
  live: ISongSound | undefined,
): TSavedSound | undefined => {
  if (!sound || resolveDspPreset(sound.presetId, readDspSettings())) {
    return sound;
  }
  if (!isWholeSound(sound) || !live) {
    return undefined;
  }
  return { ...sound, presetId: live.presetId };
};

/** A lookup's answer for the song it was asked about, as the reducer hears it. */
export const matchedEvent = (
  identity: ISongIdentity,
  match: ISongSoundMatch,
  live: ISongSound | undefined,
  isPick = false,
): TSongSoundEvent => {
  const song = playable(match.song, live);
  const albumSound = playable(match.album?.sound, live);
  return {
    kind: 'matched',
    identity,
    ...(song ? { song } : {}),
    ...(albumSound && match.album
      ? { album: { sound: albumSound, title: match.album.title } }
      : {}),
    ...(isPick ? { isPick } : {}),
  };
};

/**
 * A hand-back restores the exact borrowed rack, including manual changes,
 * rather than preset defaults. Main restores the matching curve. Other sounds
 * follow the picker, with the rack held off under Equalizer APO.
 */
export const putSongSoundOn = async (
  sound: ISongSound,
  isLent: boolean,
  target: IOutputEditor,
  { isCurrent, isApo, refresh }: ISongSoundPutOnHost,
  /** Lent as the listener's own (`lendAsOwn`: theirs back exactly as they
   * left it, rack included), or covering a preset alone. */
  lending: ISongSoundLending = {},
): Promise<ISongSound | undefined> => {
  if (lending.asOwn) {
    const landed = await applySongSound(
      sound,
      true,
      undefined,
      target,
      lending,
    );
    if (!isCurrent(target)) {
      return undefined;
    }
    endDspLoan(true);
    lendDspSettings(readDspSettings());
    await refresh();
    return isCurrent(target)
      ? songSoundOf(landed, readDspSettings())
      : undefined;
  }
  const isRestoring = !isLent && isDspLent();
  const rack = isRestoring
    ? undefined
    : resolveDspPreset(sound.presetId, readDspSettings());
  // None, or a preset with no curve, takes a preset's curve away (`null`); a
  // hand-back main puts back from its loan, or a preset nobody can name,
  // leaves the voicing alone (`undefined`).
  const curve = rack
    ? (resolveDspPresetCurve(sound.presetId) ?? null)
    : undefined;
  const landed = await applySongSound(
    sound,
    isLent,
    curve,
    target,
    isLent && lending.presetOnly ? { presetOnly: true } : {},
  );
  if (!isCurrent(target)) {
    return undefined;
  }
  if (isRestoring) {
    endDspLoan(true);
  } else if (rack) {
    const next =
      isApo() && sound.presetId !== 'none'
        ? { ...rack, enabled: false, gameMode: false }
        : rack;
    if (isLent) {
      lendDspSettings(next);
    } else {
      applyDspSettings(next);
      persistDspSettings();
    }
  }
  await refresh();
  return isCurrent(target) ? songSoundOf(landed, readDspSettings()) : undefined;
};
