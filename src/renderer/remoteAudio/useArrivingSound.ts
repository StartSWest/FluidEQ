/* FluidEQ — GPL-3.0-or-later */

import { useMemo } from 'react';
import { playsHere } from './linkRecords';
import type { TRemoteAudioMeterListener } from './meter';
import type { IRemoteAudioLink } from './remoteAudioState';
import type { IIncomingSound } from './remoteAudioValueContext';
import useIncomingDelays from './useIncomingDelays';
import useIncomingSounding from './useIncomingSounding';

/**
 * The other computers' sound arriving and played here: whether any is, how
 * far behind each plays, and the list the rest of the window reads
 * (`IncomingSoundContext`).
 */
const useArrivingSound = (
  links: readonly IRemoteAudioLink[],
  bothWays: boolean,
  subscribeMeter: (listener: TRemoteAudioMeterListener) => () => void,
) => {
  const arriving = links.filter(
    (link) => link.receiving && playsHere(link, bothWays),
  );
  const delays = useIncomingDelays(
    subscribeMeter,
    arriving.map((link) => link.id),
  );
  const sounding = useIncomingSounding(
    subscribeMeter,
    arriving.map((link) => link.id),
  );
  const incomingKey = arriving
    .map(
      (link) =>
        `${link.id}\n${link.name}\n${delays[link.id] ?? ''}\n${sounding[link.id] === true}`,
    )
    .join('\n');
  const incoming = useMemo<IIncomingSound[]>(
    () =>
      arriving.map((link) => ({
        id: link.id,
        name: link.name,
        delayMs: delays[link.id],
        isSounding: sounding[link.id] === true,
      })),
    // The key is the list as far as anyone reading it can tell: a new
    // array each render would redraw every reader for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed exactly when incomingKey changes, see above
    [incomingKey],
  );
  return { receiving: arriving.length > 0, delays, incoming };
};

export default useArrivingSound;
