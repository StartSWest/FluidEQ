/* FluidEQ — GPL-3.0-or-later */
import type { TRemoteTransportCommand } from '../../common/remoteAudio';
import type { IRemoteAudioLink } from './remoteAudioState';
import useGroupMediaTransport from './useGroupMediaTransport';

/** A component boundary keeps media subscriptions out of the provider's
 * existing hook sequence, including while development hot reload is active. */
const GroupMediaTransportHost = ({
  links,
  perform,
}: {
  links: readonly IRemoteAudioLink[];
  perform: (command: TRemoteTransportCommand) => void;
}) => {
  useGroupMediaTransport(links, perform);
  return null;
};
export default GroupMediaTransportHost;
