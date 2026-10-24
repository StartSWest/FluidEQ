/* FluidEQ — GPL-3.0-or-later */
import type { ILanSavedJoin } from '../common/remoteAudio';
import type { IRemoteAudioCredentialStore } from './remoteAudioCredentials';
import type { ILanLinkBook } from './remoteAudioLanTypes';
import { computerIdOf, decodePairingCode } from './remoteAudioLanProtocol';

const createRemoteAudioBook = (
  credentials: IRemoteAudioCredentialStore,
  publish: (joins: ILanSavedJoin[]) => void,
) => {
  const computerOfCode = (code: string): string | undefined => {
    try {
      return computerIdOf(decodePairingCode(code).secret);
    } catch {
      return undefined;
    }
  };
  const savedJoins = (): ILanSavedJoin[] => {
    const state = credentials.read();
    const saved = state.joins.flatMap((code) => {
      try {
        const pairing = decodePairingCode(code);
        return [
          {
            computerId: computerIdOf(pairing.secret),
            deviceName: pairing.deviceName,
          },
        ];
      } catch {
        return [];
      }
    });
    return [
      ...saved,
      ...(state.groupLinks ?? [])
        .filter(
          (link) =>
            !state.revoked.includes(link.computerId) &&
            !saved.some((item) => item.computerId === link.computerId),
        )
        .map(({ computerId, deviceName }) => ({ computerId, deviceName })),
    ];
  };
  const publishJoins = () => publish(savedJoins());
  const book: ILanLinkBook = {
    groupLinks: () => credentials.read().groupLinks ?? [],
    saveGroupLink: (link) => {
      credentials.saveGroupLink(link);
      publishJoins();
    },
    isRevoked: (computerId) => credentials.read().revoked.includes(computerId),
    revoke: (computerId) => credentials.revoke(computerId),
    unrevoke: (computerId) => credentials.unrevoke(computerId),
    forgetJoin: (computerId) => {
      credentials.removeJoin((code) => computerOfCode(code) === computerId);
      credentials.removeGroupLink(computerId);
      publishJoins();
    },
  };

  return { book, savedJoins, publishJoins, computerOfCode };
};
export default createRemoteAudioBook;
