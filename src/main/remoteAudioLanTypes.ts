/* FluidEQ — GPL-3.0-or-later */

import type {
  ILanHostDetails,
  ILanRemoteComputer,
  TRemoteAudioStreamMode,
} from '../common/remoteAudio';

export interface IRemoteAudioLan {
  startHost(credentials?: ILanHostCredentials): Promise<ILanHostSession>;
  restoreJoin(code: unknown): Promise<ILanRemoteComputer>;
  sendSignal(message: unknown): void;
  sendAudio(chunk: unknown): void;
  setStreamMode(peerId: string, mode: TRemoteAudioStreamMode): void;
  stop(): void;
}

export interface ILanHostCredentials {
  port: number;
  secret: string;
}

export interface ILanHostSession {
  credentials: ILanHostCredentials;
  details: ILanHostDetails;
}
