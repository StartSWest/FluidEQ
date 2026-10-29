/* FluidEQ — GPL-3.0-or-later */

import type {
  ILanHostDetails,
  ILanSavedJoin,
  TRemoteAudioStreamMode,
} from '../common/remoteAudio';
import type { IAudioGroupLink } from '../common/remoteAudioGroup';

export interface IRemoteAudioLan {
  /** Listens on this computer's code; the same session if it already is. */
  start(credentials?: ILanHostCredentials): Promise<ILanHostSession>;
  /**
   * Keeps a link to the computer whose code this is, for good, alongside
   * every other. `fresh` is a paste by hand. Throws on a code that is not
   * one, or is this computer's own.
   */
  join(code: unknown, fresh: boolean): ILanSavedJoin;
  /** Ends the link with one computer, and only that one. */
  unlink(target: { peerId?: string; computerId?: string }): void;
  /** The network is back: every computer still away is looked for now. */
  retry(): void;
  sendSignal(message: unknown): void;
  sendAudio(chunk: unknown): void;
  setStreamMode(peerId: string, mode: TRemoteAudioStreamMode): void;
  stop(): void;
}

/**
 * What the LAN layer asks of storage about other computers: which ones were
 * unlinked here (refused unless they paste the code again), and which saved
 * codes to drop when the other computer says so.
 */
export interface ILanLinkBook {
  snapshot?(): {
    revoked: readonly string[];
    links: readonly IAudioGroupLink[];
  };
  groupLinks?(): readonly IAudioGroupLink[];
  saveGroupLink?(link: IAudioGroupLink): void;
  isRevoked(computerId: string): boolean;
  revoke(computerId: string): void;
  unrevoke(computerId: string): void;
  forgetJoin(computerId: string): void;
}

export interface ILanHostCredentials {
  port: number;
  secret: string;
}

export interface ILanHostSession {
  credentials: ILanHostCredentials;
  details: ILanHostDetails;
}
