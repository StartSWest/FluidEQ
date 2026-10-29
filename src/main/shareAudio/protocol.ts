/* FluidEQ — GPL-3.0-or-later */
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioNetworkStats,
  ILanRemoteAudioSignal,
} from '../../common/remoteAudio';
import type { IRemotePlaybackMeter } from '../../common/remoteAudioPlayback';
import type { IAudioGroupLink } from '../../common/remoteAudioGroup';
import type {
  ILanHostCredentials,
  ILanHostSession,
} from '../remoteAudioLanTypes';
import type { IPlaybackReply } from '../nativeRemoteAudioPlaybackProtocol';

export interface IAudioRouting {
  targets: readonly string[];
  receive: readonly { peerId: string; volume: number }[];
}
export interface IAudioBook {
  revoked: readonly string[];
  links: readonly IAudioGroupLink[];
}
export interface IAudioMethods {
  status: { args: []; result: { scheduling: boolean } };
  'lan.start': {
    args: [ILanHostCredentials | undefined, IAudioBook];
    result: ILanHostSession;
  };
  'lan.join': { args: [string, boolean]; result: void };
  'lan.unlink': {
    args: [{ peerId?: string; computerId?: string }];
    result: void;
  };
  'lan.signal': { args: [unknown]; result: void };
  'lan.audio': { args: [unknown]; result: void };
  'lan.retry': { args: []; result: void };
  'lan.stop': { args: []; result: void };
  routing: { args: [IAudioRouting]; result: void };
  'streams.replay': { args: []; result: void };
  'capture.start': { args: []; result: number };
  'capture.close': { args: [number]; result: void };
  'playback.start': { args: []; result: number };
  'playback.push': { args: [number, ILanRemoteAudioChunk]; result: void };
  'playback.remove': { args: [number, string]; result: void };
  'playback.reset': { args: [number]; result: void };
  'playback.volume': { args: [number, number]; result: void };
  'playback.output': { args: [number, string]; result: void };
  'playback.close': { args: [number]; result: void };
  'helper.lease': { args: []; result: { id: number; pid?: number } };
  'helper.request': {
    args: [number, number, number, Uint8Array | undefined];
    result: void;
  };
  'helper.send': { args: [number, Uint8Array]; result: void };
  'helper.release': { args: [number]; result: void };
}
export type TAudioMethod = keyof IAudioMethods;
export type TAudioRequest = {
  [K in TAudioMethod]: {
    type: 'request';
    id: number;
    method: K;
    args: IAudioMethods[K]['args'];
  };
}[TAudioMethod];
export type TAudioEvent =
  | { type: 'helper-pid'; pid?: number }
  | { type: 'signal'; message: ILanRemoteAudioSignal }
  | { type: 'network'; stats: ILanRemoteAudioNetworkStats }
  | { type: 'lan-failed' }
  | { type: 'book'; operation: 'revoke' | 'unrevoke' | 'forget'; value: string }
  | { type: 'book-link'; link: IAudioGroupLink }
  | { type: 'capture'; id: number; chunk: ILanRemoteAudioChunk }
  | { type: 'capture-failed'; id: number }
  | { type: 'meter'; id: number; meter: IRemotePlaybackMeter }
  | { type: 'playback-failed'; id: number }
  | { type: 'streaming'; peerId: string }
  | { type: 'helper-reply'; id: number; reply: IPlaybackReply }
  | { type: 'helper-stopped'; id: number };
export type TAudioResponse =
  | {
      type: 'answer';
      id: number;
      value?: unknown;
      error?: string;
      /** The system's own code for a failure (`failureCode`), never its text. */
      code?: string;
      /** The call that raised it: listen, bind. */
      syscall?: string;
    }
  | { type: 'event'; event: TAudioEvent; credit?: string };
