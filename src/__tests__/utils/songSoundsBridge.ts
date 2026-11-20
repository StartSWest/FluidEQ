/* FluidEQ — GPL-3.0-or-later */
import ChannelEnum from '../../common/channels';
import type { ISongSoundIndex } from '../../common/songSoundMemory';
import isRequestId from '../../common/ipcRequestId';

/**
 * Auto EQ's side of main as the Library reads it: the index its sound column
 * and its menus label songs from (`GET_SONG_SOUND_INDEX`), and the word that
 * the index changed (`SONG_SOUNDS_CHANGED`). Nothing saved unless a test says
 * otherwise, as on a first launch.
 *
 * A fixture's own `on` and `sendMessage` refuse every channel they were not
 * written for, loudly, so a component reaching for something unexpected
 * fails; `routeSongSounds` puts these two channels in front of them and hands
 * every other channel to them unchanged.
 */

type TListener = (...args: unknown[]) => void;
type TOn = (channel: string, listener: TListener) => () => void;
type TSendMessage = (
  channel: string,
  args: unknown[],
  requestId?: unknown,
) => void;

export const EMPTY_SONG_SOUND_INDEX: ISongSoundIndex = {
  songs: [],
  albums: [],
  otherCount: 0,
  hasUnnamed: false,
  eqs: [],
};

const SONG_SOUND_CHANNELS: ReadonlySet<string> = new Set([
  ChannelEnum.SONG_SOUNDS_CHANGED,
  ChannelEnum.GET_SONG_SOUND_INDEX,
]);

const refuse = (what: string) => (channel: string) => {
  throw new Error(`Unexpected ${what} in this fixture: ${channel}`);
};

export const routeSongSounds = (
  base: { on?: TOn; sendMessage?: TSendMessage } = {},
  index: ISongSoundIndex = EMPTY_SONG_SOUND_INDEX,
) => {
  const listeners = new Map<string, Set<TListener>>();
  const baseOn: TOn = base.on ?? refuse('subscription');
  const baseSend: TSendMessage = base.sendMessage ?? refuse('request');
  const emit = (channel: string, ...args: unknown[]) =>
    [...(listeners.get(channel) ?? [])].forEach((listener) =>
      listener(...args),
    );
  const on: TOn = (channel, listener) => {
    if (!SONG_SOUND_CHANNELS.has(channel)) {
      return baseOn(channel, listener);
    }
    const subscribed = listeners.get(channel) ?? new Set<TListener>();
    subscribed.add(listener);
    listeners.set(channel, subscribed);
    return () => {
      subscribed.delete(listener);
    };
  };
  const sendMessage: TSendMessage = (channel, args, requestId) => {
    if (channel !== ChannelEnum.GET_SONG_SOUND_INDEX) {
      baseSend(channel, args, requestId);
      return;
    }
    if (!isRequestId(requestId)) {
      throw new Error('Expected a correlated song sound index request');
    }
    // sendRequest subscribes after sending; Electron never replies in the send.
    Promise.resolve().then(() => emit(channel, { result: index }, requestId));
  };
  return {
    on: on as Window['electron']['ipcRenderer']['on'],
    sendMessage:
      sendMessage as Window['electron']['ipcRenderer']['sendMessage'],
    /** Main saying the song sounds changed, as it does after every save. */
    announceSongSounds: () => emit(ChannelEnum.SONG_SOUNDS_CHANGED),
  };
};
