/* FluidEQ — GPL-3.0-or-later. Actual production cards with isolated fake links. */
import { useState } from 'react';
import RemoteAudioLinkCard from '../../../src/renderer/remoteAudio/RemoteAudioLinkCard';
import type { IRemoteAudioLink } from '../../../src/renderer/remoteAudio/remoteAudioState';
import {
  findRoute,
  orderedComputers,
  type IComputer,
  type IGroup,
} from './groupModel';

const noMeter = () => () => undefined;

export default function CurrentCards({
  group,
  local,
}: {
  group: IGroup;
  local: IComputer;
}) {
  const [links, setLinks] = useState<IRemoteAudioLink[]>(() =>
    orderedComputers(group)
      .filter((pc) => pc.id !== local.id && pc.online)
      .map((pc) => ({
        id: pc.id,
        computerId: pc.id,
        name: pc.name,
        joined: true,
        theirs: { sends: true, plays: true },
        receiving: true,
        switches: {
          send: true,
          play: true,
          paused: false,
          volume: findRoute(group, pc.id, local.id)?.level ?? 1,
        },
      })),
  );
  return (
    <>
      <p className="group-baseline-note">
        Existing cards from the updated app, with isolated simulated links. This
        compares the current card component; its pairings do not join the
        proposed group.
      </p>
      {links.map((link) => (
        <RemoteAudioLinkCard
          key={link.id}
          link={link}
          bothWays
          sending
          sendingFailed={false}
          networkStats={[]}
          subscribe={noMeter}
          onSwitches={(_name, switches) =>
            setLinks((previous) =>
              previous.map((entry) =>
                entry.id === link.id ? { ...entry, switches } : entry,
              ),
            )
          }
          onUnlink={() =>
            setLinks((previous) =>
              previous.filter((entry) => entry.id !== link.id),
            )
          }
        />
      ))}
    </>
  );
}
