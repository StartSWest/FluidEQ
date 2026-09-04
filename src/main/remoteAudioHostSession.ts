/* FluidEQ — GPL-3.0-or-later */

import type { IRemoteAudioCredentialStore } from './remoteAudioCredentials';
import type { ILanHostSession, IRemoteAudioLan } from './remoteAudioLanTypes';

/**
 * A listener's secret is its durable pairing identity. Reusing it makes old
 * codes survive app and PC restarts; only the explicit replacement path is
 * allowed to ask the LAN layer for a new secret.
 */
const startRemoteAudioHostSession = async (
  lan: IRemoteAudioLan,
  credentials: IRemoteAudioCredentialStore,
  replaceCode: boolean,
): Promise<ILanHostSession> => {
  const listener = credentials.readListener();
  if (replaceCode || !listener) {
    return lan.startHost();
  }
  try {
    return await lan.startHost(listener);
  } catch {
    // The old port may be claimed while FluidEQ is closed. Authenticated LAN
    // discovery lets paired senders find the same secret on a replacement.
    return lan.startHost({ port: 0, secret: listener.secret });
  }
};

export default startRemoteAudioHostSession;
