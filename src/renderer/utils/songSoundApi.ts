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
  ISongSoundEntry,
  TSongSoundLanded,
} from 'common/songSound';
import {
  sendRequest,
  setterResponseHandler,
  simpleResponseHandler,
} from './ipcRequest';

// The requests behind the memory of each song's sound (`songSound.ts`) and
// putting one on (`main/songSoundLoan.ts`). A file of their own: the edit
// requests' file is near its line ceiling.

/** What this output remembers of a song's sound, or nothing. */
export const lookupSongSound = (
  deviceId: string,
  identity: ISongIdentity,
): Promise<ISongSoundEntry | undefined> =>
  sendRequest(
    ChannelEnum.LOOKUP_SONG_SOUND,
    [deviceId, identity],
    simpleResponseHandler<ISongSoundEntry | undefined>(),
  );

/** File the sound a song ended with, and count the play. */
export const saveSongSound = (
  deviceId: string,
  identity: ISongIdentity,
  sound: ISongSound,
): Promise<void> =>
  sendRequest(
    ChannelEnum.SAVE_SONG_SOUND,
    [deviceId, identity, sound],
    setterResponseHandler,
  );

/** Forget one song on one output — the entry a lookup would have answered. */
export const forgetSongSound = (
  deviceId: string,
  identity: ISongIdentity,
): Promise<void> =>
  sendRequest(
    ChannelEnum.FORGET_SONG_SOUND,
    [deviceId, identity],
    setterResponseHandler,
  );

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
