/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from 'common/channels';
import type { IEqSettings } from 'common/dsp/chain';
import type { ISongIdentity } from 'common/songIdentity';
import type { IOutputEditor } from 'common/outputSettings';
import type {
  ISongSound,
  TSavedSound,
  TSongSoundLanded,
} from 'common/songSound';
import type { ISongSoundIndex, ISongSoundMatch } from 'common/songSoundMemory';
import {
  sendRequest,
  setterResponseHandler,
  simpleResponseHandler,
} from './ipcRequest';

// The requests behind Auto EQ's song and album sounds (`songSoundMemory.ts`)
// and putting one on (`main/songSoundLoan.ts`). A file of their own: the edit
// requests' file is near its line ceiling.

/** What is kept for a song, for every output: its own sound, and its album's. */
export const lookupSongSound = (
  identity: ISongIdentity,
): Promise<ISongSoundMatch> =>
  sendRequest(
    ChannelEnum.LOOKUP_SONG_SOUND,
    [identity],
    simpleResponseHandler<ISongSoundMatch>(),
  );

/** File what plays as the song's own; `isPlay` counts a play at its end. */
export const saveSongSound = (
  identity: ISongIdentity,
  sound: ISongSound,
  isPlay: boolean,
): Promise<void> =>
  sendRequest(
    ChannelEnum.SAVE_SONG_SOUND,
    [identity, sound, isPlay],
    setterResponseHandler,
  );

/** Forget a song's own sound — the entry a lookup would have answered. */
export const forgetSongSound = (identity: ISongIdentity): Promise<void> =>
  sendRequest(ChannelEnum.FORGET_SONG_SOUND, [identity], setterResponseHandler);

/** Library songs given a sound of their own, or theirs forgotten (`null`). */
export const pickLibrarySongSounds = (
  identities: readonly ISongIdentity[],
  sound: TSavedSound | null,
): Promise<void> =>
  sendRequest(
    ChannelEnum.PICK_LIBRARY_SONG_SOUNDS,
    [identities, sound],
    setterResponseHandler,
  );

/** An album's sound set, or taken away (`null`). */
export const setAlbumSound = (
  albumKey: string,
  title: string,
  artist: string,
  sound: TSavedSound | null,
): Promise<void> =>
  sendRequest(
    ChannelEnum.SET_ALBUM_SOUND,
    [albumKey, title, artist, sound],
    setterResponseHandler,
  );

/** Which Library songs and albums have a sound, and how many other songs do. */
export const getSongSoundIndex = (): Promise<ISongSoundIndex> =>
  sendRequest(
    ChannelEnum.GET_SONG_SOUND_INDEX,
    [],
    simpleResponseHandler<ISongSoundIndex>(),
  );

/** The Library's track ids, for songs kept before Auto EQ to be known by. */
export const nameLibrarySongSounds = (
  trackIds: readonly string[],
): Promise<void> =>
  sendRequest(
    ChannelEnum.NAME_LIBRARY_SONG_SOUNDS,
    [trackIds],
    setterResponseHandler,
  );

/** Manage's "Forget all": the Library's songs, other players', or albums. */
export const forgetSongSoundsOf = (
  what: 'library' | 'other' | 'albums',
): Promise<void> =>
  sendRequest(ChannelEnum.FORGET_SONG_SOUNDS_OF, [what], setterResponseHandler);

/**
 * Put a sound's bands, Tone and preset curve on in one write.
 * @param curve - the preset's curve; `null` takes a preset's curve away,
 *   `undefined` leaves the voicing as it is
 * @returns what landed, for the window to read the sound now playing from
 */
export const applySongSound = (
  sound: ISongSound,
  isLent: boolean,
  curve: IEqSettings | null | undefined,
  target: IOutputEditor,
): Promise<TSongSoundLanded> =>
  sendRequest(
    ChannelEnum.APPLY_SONG_SOUND,
    [
      sound,
      isLent,
      curve,
      { deviceId: target.device.id, generation: target.generation },
    ],
    simpleResponseHandler<TSongSoundLanded>(),
  );

/** End a loan with what plays: it is the listener's own from here. */
export const keepSongSound = (target: IOutputEditor): Promise<void> =>
  sendRequest(
    ChannelEnum.KEEP_SONG_SOUND,
    [{ deviceId: target.device.id, generation: target.generation }],
    setterResponseHandler,
  );

/** Put back what a loan held from before the window started took. */
export const returnSongSound = (target: IOutputEditor): Promise<void> =>
  sendRequest(
    ChannelEnum.RETURN_SONG_SOUND,
    [{ deviceId: target.device.id, generation: target.generation }],
    setterResponseHandler,
  );
