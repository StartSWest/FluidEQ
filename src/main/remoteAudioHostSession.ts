/* FluidEQ — GPL-3.0-or-later */

import type { IRemoteAudioCredentialStore } from './remoteAudioCredentials';
import type { ILanHostSession, IRemoteAudioLan } from './remoteAudioLanTypes';

const addressIsInUse = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'EADDRINUSE';

/**
 * A computer's secret is its durable pairing identity. Reusing it makes its
 * one code survive app and PC restarts, so every computer that pasted it
 * finds it again.
 */
const startRemoteAudioHostSession = async (
  lan: IRemoteAudioLan,
  credentials: IRemoteAudioCredentialStore,
): Promise<ILanHostSession> => {
  const listener = credentials.read().identity;
  if (!listener) {
    return lan.start();
  }
  try {
    return await lan.start(listener);
  } catch (error) {
    if (!addressIsInUse(error)) {
      throw error;
    }
    // The old port may be claimed while FluidEQ is closed. Authenticated LAN
    // discovery lets paired senders find the same secret on a replacement.
    return lan.start({ port: 0, secret: listener.secret });
  }
};

export default startRemoteAudioHostSession;
