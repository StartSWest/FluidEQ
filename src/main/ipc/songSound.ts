/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from '../../common/channels';
import { IState } from '../../common/constants';
import type { IOutputEditor } from '../../common/outputSettings';
import { TSongSoundLanded, toSongSound } from '../../common/songSound';
import {
  type ISongSoundMatch,
  canKeepSongSound,
  forgetSongSound,
  libraryTrackIdOf,
  lookupAlbumSound,
  lookupSongSound,
  nameSongSound,
  saveSongSound,
  soundScopeOf,
} from '../../common/songSoundMemory';
import {
  keepSongSound,
  putSongSoundOn,
  returnSongSound,
} from '../songSoundLoan';
import { storedSoundIdentity } from '../songMemoryNames';
import type { ISongSoundHolder } from '../songSoundHolder';
import {
  isIdentity,
  replyInvalidParameter,
  replySuccess,
} from './songSoundCheck';
import onWindowMessage from './windowMessages';

export interface ISongSoundIpcDeps {
  state: IState;
  holder: ISongSoundHolder;
  getOutputEditor: () => IOutputEditor | undefined;
  handleUpdateHelper: <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
}

/**
 * The song that plays and its sound: what is kept for it, filing it, and
 * putting one on.
 *
 * What a lookup answers and what a save changes live in
 * `common/songSoundMemory.ts`; the store is held by `songSoundHolder.ts`.
 *
 * Putting a sound on is one write of the bands, the Tone and the preset's
 * curve together, so the engine hears the song's sound arrive in one piece
 * rather than band by band. Whether it is lent, and what that keeps out of
 * the output's profile, is `songSoundLoan.ts`.
 */
const registerSongSoundIpc = ({
  state,
  holder,
  getOutputEditor,
  handleUpdateHelper,
}: ISongSoundIpcDeps): void => {
  const matchesEditor = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const asked = value as { deviceId?: unknown; generation?: unknown };
    const current = getOutputEditor();
    return (
      !!current &&
      asked.deviceId === current.device.id &&
      Number.isSafeInteger(asked.generation) &&
      asked.generation === current.generation
    );
  };

  onWindowMessage(ChannelEnum.LOOKUP_SONG_SOUND, (event, arg) => {
    const channel = ChannelEnum.LOOKUP_SONG_SOUND;
    const identity = arg?.[0];
    if (!isIdentity(identity)) {
      replyInvalidParameter(event, channel);
      return;
    }
    if (!canKeepSongSound(identity)) {
      replySuccess<ISongSoundMatch>(event, channel, {});
      return;
    }
    const scope = soundScopeOf(identity.source);
    const stored = storedSoundIdentity(identity);
    const trackId = libraryTrackIdOf(identity);
    if (trackId !== undefined) {
      // A song kept before Auto EQ, known from now on by its track id.
      holder.write(nameSongSound(holder.read(), stored.key, trackId));
    }
    const settings = holder.read();
    const entry = lookupSongSound(settings, stored, scope);
    // Albums are the Library's alone.
    const album =
      scope === 'library' && stored.albumKey !== undefined
        ? lookupAlbumSound(settings, stored.albumKey)
        : undefined;
    replySuccess<ISongSoundMatch>(event, channel, {
      ...(entry ? { song: entry.sound } : {}),
      ...(album ? { album: { sound: album.sound, title: album.title } } : {}),
    });
  });

  onWindowMessage(ChannelEnum.SAVE_SONG_SOUND, (event, arg) => {
    const channel = ChannelEnum.SAVE_SONG_SOUND;
    const identity = arg?.[0];
    const sound = toSongSound(arg?.[1]);
    if (!isIdentity(identity) || !sound || !canKeepSongSound(identity)) {
      replyInvalidParameter(event, channel);
      return;
    }
    const trackId = libraryTrackIdOf(identity);
    holder.write(
      saveSongSound(
        holder.read(),
        storedSoundIdentity(identity),
        soundScopeOf(identity.source),
        sound,
        Date.now(),
        trackId === undefined ? {} : { trackId },
      ),
    );
    replySuccess(event, channel, undefined);
  });

  onWindowMessage(ChannelEnum.FORGET_SONG_SOUND, (event, arg) => {
    const channel = ChannelEnum.FORGET_SONG_SOUND;
    const identity = arg?.[0];
    if (!isIdentity(identity)) {
      replyInvalidParameter(event, channel);
      return;
    }
    // The identity, not a key: which entry this removes is
    // `common/songSoundMemory.ts`'s decision, exactly as it is for a lookup.
    holder.write(
      forgetSongSound(
        holder.read(),
        storedSoundIdentity(identity),
        soundScopeOf(identity.source),
      ),
    );
    replySuccess(event, channel, undefined);
  });

  onWindowMessage(ChannelEnum.APPLY_SONG_SOUND, async (event, arg) => {
    const channel = ChannelEnum.APPLY_SONG_SOUND;
    const sound = toSongSound(arg?.[0]);
    const isLent = arg?.[1];
    // The preset's curve as the window's catalogue gives it; none for None,
    // a preset without one, or a hand-back that puts back what a loan took.
    const curve: unknown = arg?.[2];
    if (
      !sound ||
      typeof isLent !== 'boolean' ||
      !matchesEditor(arg?.[3]) ||
      (curve !== undefined &&
        curve !== null &&
        (typeof curve !== 'object' || Array.isArray(curve)))
    ) {
      replyInvalidParameter(event, channel);
      return;
    }
    putSongSoundOn(state, sound, isLent, curve);
    // What landed, so the window can tell an apply that finished from one
    // still on its way without waiting for its own copy of the state.
    const landed: TSongSoundLanded = {
      filters: state.filters,
      tone: state.tone,
      voicing: state.voicing,
      eqFormat: state.eqFormat,
    };
    await handleUpdateHelper(event, channel, landed, false, true);
  });

  onWindowMessage(ChannelEnum.KEEP_SONG_SOUND, async (event, arg) => {
    const channel = ChannelEnum.KEEP_SONG_SOUND;
    if (!matchesEditor(arg?.[0])) {
      replyInvalidParameter(event, channel);
      return;
    }
    if (!state.songSoundLoan) {
      replySuccess(event, channel, undefined);
      return;
    }
    keepSongSound(state);
    // Written out like any edit: what plays is the output's profile now.
    await handleUpdateHelper(event, channel, undefined, false, true);
  });

  onWindowMessage(ChannelEnum.RETURN_SONG_SOUND, async (event, arg) => {
    const channel = ChannelEnum.RETURN_SONG_SOUND;
    if (!matchesEditor(arg?.[0])) {
      replyInvalidParameter(event, channel);
      return;
    }
    if (!returnSongSound(state)) {
      replySuccess(event, channel, undefined);
      return;
    }
    await handleUpdateHelper(event, channel, undefined, false, true);
  });
};

export default registerSongSoundIpc;
