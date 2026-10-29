/* FluidEQ — GPL-3.0-or-later. Production UI with simulated audio I/O. */
import RemoteAudioGroup from '../../../src/renderer/remoteAudio/RemoteAudioGroup';
import RemoteAudioMix from '../../../src/renderer/remoteAudio/RemoteAudioMix';
import Dropdown from '../../../src/renderer/widgets/Dropdown';
import type { IRemoteAudioValue } from '../../../src/renderer/remoteAudio/remoteAudioState';
import type { TRemoteAudioMeterListener } from '../../../src/renderer/remoteAudio/meter';
import '../../../src/renderer/styles/RemoteAudioGroup.scss';
import {
  findRoute,
  pairKey,
  routeState,
  type IComputer,
  type IGroup,
  type IRoute,
} from './groupModel';

const subscribe = (listener: TRemoteAudioMeterListener) => {
  let frame = 0;
  let count = 0;
  const paint = () => {
    count += 1;
    if (count % 4 === 0) {
      [undefined, 'mac', 'linux', 'win', 'studio'].forEach(
        (sourceId, index) => {
          const peak =
            0.03 +
            Math.abs(Math.sin(count * 0.08 + index) * Math.cos(count * 0.03)) *
              0.4;
          listener({
            sourceId,
            peak,
            rms: peak / 2,
            waveform: new Float32Array(0),
          });
        },
      );
    }
    frame = requestAnimationFrame(paint);
  };
  frame = requestAnimationFrame(paint);
  return () => cancelAnimationFrame(frame);
};

export default function ImplementedGroup({
  group,
  local,
  onComputer,
  onRoute,
  onPause,
}: {
  group: IGroup;
  local: IComputer;
  onComputer(patch: Partial<Omit<IComputer, 'id'>>): void;
  onRoute(
    from: string,
    to: string,
    patch: Partial<
      Pick<IRoute, 'send' | 'receive' | 'level' | 'muted' | 'unlinked'>
    >,
  ): void;
  onPause(id: string): void;
}) {
  const others = group.computers.filter(
    (pc) => pc.id !== local.id && !findRoute(group, local.id, pc.id)?.unlinked,
  );
  const remote: IRemoteAudioValue = {
    bothWays: true,
    deviceName: local.name,
    phase: 'ready',
    sharing: local.sharing,
    sending: local.sharing && local.captureReady,
    sendingFailed: !local.captureReady,
    looking: others
      .filter((pc) => !pc.online)
      .map((pc) => ({ computerId: pc.id, deviceName: pc.name })),
    links: others
      .filter((pc) => pc.online)
      .map((pc) => ({
        id: pc.id,
        computerId: pc.id,
        name: pc.name,
        joined: true,
        receiving: routeState(group, pc.id, local.id).active,
        theirs: {
          sends:
            pc.sharing && findRoute(group, pc.id, local.id)?.send !== false,
          plays: true,
          paused: pc.paused,
        },
        switches: {
          send: findRoute(group, local.id, pc.id)?.send ?? false,
          play: findRoute(group, pc.id, local.id)?.receive ?? false,
          volume: findRoute(group, pc.id, local.id)?.level ?? 1,
          muted: findRoute(group, pc.id, local.id)?.muted,
          paused: group.pausedPairs.includes(pairKey(local.id, pc.id)),
        },
        nowPlaying: {
          title: pc.source,
          isPlaying: true,
          positionMs: 0,
          durationMs: 0,
          canNext: false,
          canPrevious: false,
          canStep: false,
          canStop: false,
        },
      })),
    networkStats: [],
    subscribeMeter: subscribe,
    start: async () => undefined,
    link: async () => false,
    resumePlayback: async () => undefined,
    setSharing: async (sharing) => onComputer({ sharing }),
    unlink: async (target) => {
      const id = target.computerId ?? target.peerId ?? '';
      onRoute(local.id, id, { unlinked: true });
      onRoute(id, local.id, { unlinked: true });
    },
    setSwitches: async (key, switches) => {
      const id = key.replace(/^id:/, '');
      const previous = group.pausedPairs.includes(pairKey(local.id, id));
      if (previous !== switches.paused) {
        onPause(id);
      }
      onRoute(local.id, id, { send: switches.send });
      onRoute(id, local.id, {
        receive: switches.play,
        level: switches.volume,
        muted: switches.muted,
      });
    },
  };
  return (
    <div className="remote-audio__columns">
      <RemoteAudioGroup
        remote={remote}
        localNowPlaying={{
          title: local.source,
          isPlaying: true,
          positionMs: 0,
          durationMs: 0,
          canNext: false,
          canPrevious: false,
          canStep: false,
          canStop: false,
        }}
      />
      <RemoteAudioMix
        remote={remote}
        system={{
          isAvailable: true,
          level: local.systemVolume,
          isMuted: local.isMuted === true,
          setLevel: (systemVolume) => onComputer({ systemVolume }),
          toggleMute: () => onComputer({ isMuted: !local.isMuted }),
        }}
        output={
          <div className="remote-audio__lane remote-audio__mix-output">
            <span className="control-kicker">Output</span>
            <Dropdown
              name="Output"
              value={local.output}
              options={['Headphones', 'Speakers', 'USB audio interface'].map(
                (name) => ({ value: name, label: name, display: name }),
              )}
              isDisabled={false}
              handleChange={(output) => onComputer({ output })}
            />
          </div>
        }
      />
    </div>
  );
}
