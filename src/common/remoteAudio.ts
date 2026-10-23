/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * What the sending computer's transport bar is showing, as sent to the
 * listener.
 *
 * The listener plays sound it did not start and cannot see the source of, so
 * its own bar said "Nothing playing" while a whole song came through the
 * wire. This is the sender's bar description — a library track, a karaoke
 * session, a browser tab Windows reported — reduced to the fields another
 * machine can honestly draw. No artwork: the cover is a file or a blob URL on
 * the sender, and the bar generates a tile from the title anyway.
 */
export interface IRemoteNowPlaying {
  title: string;
  /** The line under the title: the artist, or the app where there is none. */
  subtitle?: string;
  /** The artist alone, for identifying the song. Absent where the subtitle
   * is an app name rather than an artist. */
  artist?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  /** Which of the listener's buttons the sender's source will answer. A
   * button the source cannot answer is not offered — the same rule the bar
   * applies to a web page or a Windows session on this machine. */
  canNext: boolean;
  canPrevious: boolean;
  canStep: boolean;
  canStop: boolean;
}

/**
 * The listener's bar buttons, pressed on the sender's own bar.
 *
 * `pause` is the one-player rule reaching across the wire: never a toggle,
 * because a toggle sent to something already paused would start it. `nudge`
 * is the five-second step, carried as a delta because the listener's copy of
 * the position is a second old — the sender resolves it against the truth.
 * The rest are offered on the listener only where `IRemoteNowPlaying` says
 * the sender's source answers them.
 */
export type TRemoteTransportCommand =
  | { command: 'toggle' | 'pause' | 'stop' | 'next' | 'previous' }
  | { command: 'nudge'; deltaMs: number };

/** The furthest one step may reach: the bar steps five seconds, and a peer
 * holding the key is still not trusted to throw the playhead anywhere. */
export const REMOTE_NUDGE_LIMIT_MS = 60_000;

/**
 * What one computer does with a link, as it tells the other.
 *
 * Share Audio both ways: each linked computer may send its sound and may play
 * the other's, and each says which. `plays: false` asks the other to stop
 * sending — there is nobody to hear it — and `sends: false` tells it that the
 * quiet it hears is a choice. A computer that never says anything is a
 * FluidEQ from before both ways: it plays what it is sent if it made the
 * code, and sends if it joined, and is never sent anything it cannot play.
 */
export interface IRemoteDuplex {
  sends: boolean;
  plays: boolean;
  /**
   * The link is paused over there: nothing either way, and nothing of this
   * computer's players acted on, until it resumes. `sends` and `plays` are
   * false with it, so a FluidEQ that does not know the word still stops.
   * Absent from a FluidEQ without the pause.
   */
  paused?: boolean;
}

/**
 * What the user chose for one linked computer, remembered by its name:
 * "Send my sound", "Play it here", and the link's Pause, which stops both
 * without forgetting either (Ivan, 2026-10-04: "a pause transmission button
 * so I dont have to unlink the pc when I want to not send or receive").
 */
export interface ILinkSwitches {
  send: boolean;
  play: boolean;
  paused: boolean;
  /**
   * How loud its sound plays here, 0 to 1 (Ivan, 2026-10-10: "we should be
   * able to control each stream volume"). At 1 its samples are played as
   * they arrived, bit for bit — the "Lossless" on the card stays true.
   */
  volume: number;
}

export const LINK_SWITCHES_ON: ILinkSwitches = {
  send: true,
  play: true,
  paused: false,
  volume: 1,
};

const isLevel = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

/** What the switches let through now: a paused link neither sends nor plays. */
export const linkSwitchesInEffect = ({
  send,
  play,
  paused,
}: ILinkSwitches): { send: boolean; play: boolean } =>
  paused ? { send: false, play: false } : { send, play };

export const isLinkSwitches = (value: unknown): value is ILinkSwitches =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<ILinkSwitches>).send === 'boolean' &&
  typeof (value as Partial<ILinkSwitches>).play === 'boolean' &&
  typeof (value as Partial<ILinkSwitches>).paused === 'boolean' &&
  isLevel((value as Partial<ILinkSwitches>).volume);

/** Small control messages; the lossless PCM stream travels separately. */
export type TRemoteAudioSignal =
  /**
   * Raised on this computer by the LAN layer when a link authenticates, never
   * accepted from the wire (`remoteAudioTransport.ts`). `deviceName` is the
   * OTHER computer's; `joined` says this computer pasted its code.
   * `computerId` is the other computer's lasting id, absent for a FluidEQ
   * from before all to all that joined this one.
   */
  | {
      kind: 'peer-ready';
      deviceName: string;
      address?: string;
      joined?: boolean;
      computerId?: string;
    }
  /**
   * `duplex` rides here, on a message every version already accepts, because
   * a kind an older peer does not know closes its socket: the validator
   * refuses the whole packet. Extra fields on a known kind are ignored there.
   */
  | {
      kind: 'stream-mode';
      mode: TRemoteAudioStreamMode;
      duplex?: IRemoteDuplex;
    }
  /**
   * Sender → listener. Absent `playing` means the sender's bar is empty.
   *
   * `started` is the one-player rule's only trigger, and it is an EVENT: a
   * player on the sending machine that was not playing a moment ago is
   * playing now. Everything else about this message is a description, and a
   * description that happens to be playing is not somebody pressing play —
   * it is also what a reconnection re-announces, what a sender says when its
   * bar falls through to a player that was already playing, and what
   * Windows' polled session list says when it flaps. The
   * listener used to work the trigger out by diffing those descriptions, so
   * the pause it sent for one of them came back as the next "start" and
   * silenced the music its own user had just started. A pause can never raise
   * it — a pause starts nothing, and the player its sender's bar falls
   * through to was playing already — so a pause cannot travel in a circle.
   */
  | {
      kind: 'now-playing';
      playing?: IRemoteNowPlaying;
      started?: boolean;
      /**
       * The one-player switch, CHANGED on the sending computer — present
       * only on the message that carries the change, never as a statement of
       * where the switch stands (`singlePlayer.ts`). Here rather than a kind
       * of its own for the reason `duplex` rides `stream-mode`: an older
       * FluidEQ ignores a field it does not know and refuses a kind.
       */
      singlePlayer?: boolean;
    }
  /** Listener → sender: a press on the listener's bar, carried out there. */
  | ({ kind: 'transport' } & TRemoteTransportCommand)
  /**
   * The link is over. `forget`: it was unlinked over there, so the computer
   * that pasted the code forgets it rather than coming back. An older
   * FluidEQ reads the kind and ignores the field.
   */
  | { kind: 'stop'; forget?: boolean };

/**
 * This computer on the network: its name and its one code, the same for
 * every computer that links with it. No code while it is on no network.
 */
export interface ILanHostDetails {
  deviceName: string;
  code?: string;
  computerId: string;
}

/** A computer whose code was pasted here: this one keeps going back to it. */
export interface ILanSavedJoin {
  computerId: string;
  deviceName: string;
}

export interface ILanRemoteAudioNetworkStats {
  bytesPerSecond: number;
  direction: 'receive' | 'send';
  peerId: string;
  queuedBytes: number;
  queuedMilliseconds: number;
}

export type TRemoteAudioStreamMode = 'music' | 'video';

/** One sender's control message, routed by the listening computer. */
export interface ILanRemoteAudioSignal {
  peerId: string;
  signal: TRemoteAudioSignal;
}

/**
 * Losslessly compressed samples from one sender.
 *
 * `pcm` contains the restored interleaved IEEE-754 Float32 samples. Music mode
 * uses Zstandard and Video mode bypasses compression; AES-GCM and either wire
 * form preserve every captured bit, with no lossy media codec involved.
 */
export interface ILanRemoteAudioChunk {
  peerId: string;
  sequence: number;
  sampleRate: number;
  channels: number;
  frames: number;
  pcm: ArrayBuffer;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isLanRemoteAudioSignal = (
  value: unknown,
): value is ILanRemoteAudioSignal =>
  isRecord(value) &&
  typeof value.peerId === 'string' &&
  value.peerId.length > 0 &&
  value.peerId.length <= 128 &&
  isRemoteAudioSignal(value.signal);

/** A count of milliseconds a peer could have measured: finite, not negative. */
const isMilliseconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Bounded the way `peer-ready` bounds its name: a peer holds the key, but a
 * peer is not trusted to size the listener's memory or its bar.
 */
export const isRemoteNowPlaying = (
  value: unknown,
): value is IRemoteNowPlaying =>
  isRecord(value) &&
  typeof value.title === 'string' &&
  value.title.trim().length > 0 &&
  value.title.length <= 256 &&
  (value.subtitle === undefined ||
    (typeof value.subtitle === 'string' && value.subtitle.length <= 256)) &&
  (value.artist === undefined ||
    (typeof value.artist === 'string' && value.artist.length <= 256)) &&
  typeof value.isPlaying === 'boolean' &&
  isMilliseconds(value.positionMs) &&
  isMilliseconds(value.durationMs) &&
  typeof value.canNext === 'boolean' &&
  typeof value.canPrevious === 'boolean' &&
  typeof value.canStep === 'boolean' &&
  typeof value.canStop === 'boolean';

const PLAIN_COMMANDS: readonly string[] = [
  'toggle',
  'pause',
  'stop',
  'next',
  'previous',
];

export const isRemoteTransportCommand = (
  value: Record<string, unknown>,
): value is TRemoteTransportCommand =>
  (typeof value.command === 'string' &&
    PLAIN_COMMANDS.includes(value.command)) ||
  (value.command === 'nudge' &&
    typeof value.deltaMs === 'number' &&
    Number.isFinite(value.deltaMs) &&
    Math.abs(value.deltaMs) <= REMOTE_NUDGE_LIMIT_MS);

export const isRemoteDuplex = (value: unknown): value is IRemoteDuplex =>
  isRecord(value) &&
  typeof value.sends === 'boolean' &&
  typeof value.plays === 'boolean' &&
  (value.paused === undefined || typeof value.paused === 'boolean');

export const isRemoteAudioSignal = (
  value: unknown,
): value is TRemoteAudioSignal =>
  isRecord(value) &&
  ((value.kind === 'stop' &&
    (value.forget === undefined || typeof value.forget === 'boolean')) ||
    (value.kind === 'now-playing' &&
      (value.playing === undefined || isRemoteNowPlaying(value.playing)) &&
      (value.started === undefined || typeof value.started === 'boolean') &&
      (value.singlePlayer === undefined ||
        typeof value.singlePlayer === 'boolean')) ||
    (value.kind === 'transport' && isRemoteTransportCommand(value)) ||
    (value.kind === 'stream-mode' &&
      (value.mode === 'music' || value.mode === 'video') &&
      (value.duplex === undefined || isRemoteDuplex(value.duplex))) ||
    (value.kind === 'peer-ready' &&
      (value.computerId === undefined ||
        (typeof value.computerId === 'string' &&
          value.computerId.length <= 64)) &&
      typeof value.deviceName === 'string' &&
      value.deviceName.trim().length > 0 &&
      value.deviceName.length <= 128 &&
      (value.address === undefined ||
        (typeof value.address === 'string' && value.address.length <= 64))));
