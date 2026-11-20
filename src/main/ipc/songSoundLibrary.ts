/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from '../../common/channels';
import {
  type ISongSoundSettings,
  forgetAlbumSounds,
  forgetSongSound,
  forgetSongSoundsOf,
  isAlbumKey,
  libraryTrackIdOf,
  nameSongSound,
  saveSongSound,
  setAlbumSound,
  songSoundIndex,
} from '../../common/songSoundMemory';
import { libraryTrackKey, storedSoundIdentity } from '../songMemoryNames';
import type { ISongSoundHolder } from '../songSoundHolder';
import {
  MAX_SONGS_AT_ONCE,
  isIdentity,
  isText,
  replyInvalidParameter,
  replySuccess,
  toPickedSound,
  toTextList,
} from './songSoundCheck';
import onWindowMessage from './windowMessages';
import registerSavedEqIpc from './savedEqs';

/**
 * The Library's side of Auto EQ (Ivan, 2026-11-19: "I should be able to pick
 * the sound preset from the lib too"): a sound picked for one song, a
 * selection or an album, the index the Library labels its rows from, and
 * Manage's forgetting.
 *
 * A song picked here is a Library song only; other players' songs are given
 * a sound while they play (`ipc/songSound.ts`).
 */
const registerSongSoundLibraryIpc = (holder: ISongSoundHolder): void => {
  // The saved EQs the Library's menus pick from live in the same store.
  registerSavedEqIpc(holder);
  onWindowMessage(ChannelEnum.PICK_LIBRARY_SONG_SOUNDS, (event, arg) => {
    const channel = ChannelEnum.PICK_LIBRARY_SONG_SOUNDS;
    const identities: unknown = arg?.[0];
    const raw: unknown = arg?.[1];
    // `null` forgets their own sounds; anything else has to be a sound, a
    // preset alone or a saved EQ the store keeps.
    const sound = raw === null ? null : toPickedSound(holder.read(), raw);
    if (
      !Array.isArray(identities) ||
      identities.length > MAX_SONGS_AT_ONCE ||
      !identities.every(
        (one) => isIdentity(one) && libraryTrackIdOf(one) !== undefined,
      ) ||
      sound === undefined
    ) {
      replyInvalidParameter(event, channel);
      return;
    }
    const now = Date.now();
    let next: ISongSoundSettings = holder.read();
    identities.forEach((identity) => {
      if (!isIdentity(identity)) {
        return;
      }
      const stored = storedSoundIdentity(identity);
      const trackId = libraryTrackIdOf(identity);
      next =
        sound === null
          ? forgetSongSound(next, stored, 'library')
          : saveSongSound(
              next,
              stored,
              'library',
              sound,
              now,
              trackId === undefined ? {} : { trackId },
            );
    });
    holder.write(next);
    replySuccess(event, channel, undefined);
  });

  onWindowMessage(ChannelEnum.SET_ALBUM_SOUND, (event, arg) => {
    const channel = ChannelEnum.SET_ALBUM_SOUND;
    const albumKey: unknown = arg?.[0];
    const title: unknown = arg?.[1];
    const artist: unknown = arg?.[2];
    const raw: unknown = arg?.[3];
    const sound = raw === null ? null : toPickedSound(holder.read(), raw);
    if (
      !isText(albumKey) ||
      !isAlbumKey(albumKey) ||
      !isText(title) ||
      !isText(artist) ||
      sound === undefined
    ) {
      replyInvalidParameter(event, channel);
      return;
    }
    holder.write(
      setAlbumSound(
        holder.read(),
        albumKey,
        sound === null
          ? undefined
          : { title, artist, sound, updatedAt: Date.now() },
      ),
    );
    replySuccess(event, channel, undefined);
  });

  onWindowMessage(ChannelEnum.GET_SONG_SOUND_INDEX, (event) => {
    replySuccess(
      event,
      ChannelEnum.GET_SONG_SOUND_INDEX,
      songSoundIndex(holder.read()),
    );
  });

  onWindowMessage(ChannelEnum.NAME_LIBRARY_SONG_SOUNDS, (event, arg) => {
    const channel = ChannelEnum.NAME_LIBRARY_SONG_SOUNDS;
    const trackIds = toTextList(arg?.[0]);
    if (!trackIds) {
      replyInvalidParameter(event, channel);
      return;
    }
    let next = holder.read();
    trackIds.forEach((trackId) => {
      next = nameSongSound(next, libraryTrackKey(trackId), trackId);
    });
    holder.write(next);
    replySuccess(event, channel, undefined);
  });

  onWindowMessage(ChannelEnum.FORGET_SONG_SOUNDS_OF, (event, arg) => {
    const channel = ChannelEnum.FORGET_SONG_SOUNDS_OF;
    const what: unknown = arg?.[0];
    if (what !== 'library' && what !== 'other' && what !== 'albums') {
      replyInvalidParameter(event, channel);
      return;
    }
    const settings = holder.read();
    holder.write(
      what === 'albums'
        ? forgetAlbumSounds(settings)
        : forgetSongSoundsOf(settings, what),
    );
    replySuccess(event, channel, undefined);
  });
};

export default registerSongSoundLibraryIpc;
