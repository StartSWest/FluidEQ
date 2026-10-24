/* FluidEQ — GPL-3.0-or-later. Design preview using the real app audio lanes. */
import { useMemo } from 'react';
import RemoteAudioLane from '../../../src/renderer/remoteAudio/RemoteAudioLane';
import type { TRemoteAudioMeterListener } from '../../../src/renderer/remoteAudio/meter';
import Switch from '../../../src/renderer/widgets/Switch';
import PeerMenu from './PeerMenu';
import {
  findRoute,
  orderedComputers,
  pairKey,
  routeState,
  type IComputer,
  type IGroup,
  type IRoute,
} from './groupModel';

type TPatchRoute = (
  from: string,
  to: string,
  patch: Partial<Pick<IRoute, 'send' | 'receive' | 'level'>>,
) => void;

// The actual app lane paints these example readings. There is no audio I/O.
const exampleMeter =
  (sourceId: string) => (listener: TRemoteAudioMeterListener) => {
    let frame = 0;
    let count = 0;
    const paint = () => {
      count += 1;
      if (count % 4 === 0) {
        const seed = [...sourceId].reduce(
          (sum, character) => sum + character.charCodeAt(0),
          0,
        );
        const phase = count * 0.08 + seed;
        const peak =
          0.025 + Math.abs(Math.sin(phase) * Math.cos(phase * 0.37)) * 0.4;
        listener({
          sourceId,
          peak,
          rms: peak / 2,
          waveform: new Float32Array(0),
        });
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  };

function OwnRow({
  computer,
  onChange,
}: {
  computer: IComputer;
  onChange(patch: Partial<Omit<IComputer, 'id'>>): void;
}) {
  const subscribe = useMemo(() => exampleMeter(computer.id), [computer.id]);
  const live =
    computer.online &&
    computer.sharing &&
    computer.captureReady &&
    !computer.paused;
  let line = computer.source;
  if (!computer.captureReady) {
    line = 'Audio access needed · You can still receive';
  }
  if (!computer.sharing) {
    line = 'Sharing switched off';
  }
  if (computer.paused) {
    line = 'Paused here';
  }
  if (!computer.online) {
    line = 'Offline';
  }
  return (
    <article
      className="simple-peer is-local"
      aria-label={`${computer.name} — this computer`}
      data-computer-id={computer.id}
    >
      <div className="simple-lane">
        <RemoteAudioLane
          direction="out"
          kicker="THIS COMPUTER"
          title={computer.name}
          line={line}
          live={live}
          meterKey={computer.id}
          subscribe={subscribe}
          figures={[]}
          switchId="share-source"
          switchLabel="Share"
          isOn={computer.sharing}
          isSwitchDisabled={
            !computer.online || !computer.captureReady || computer.paused
          }
          onToggle={() => onChange({ sharing: !computer.sharing })}
        />
      </div>
    </article>
  );
}

function PeerRow({
  group,
  local,
  computer,
  onRoute,
  onPause,
  onRemove,
}: {
  group: IGroup;
  local: IComputer;
  computer: IComputer;
  onRoute: TPatchRoute;
  onPause(): void;
  onRemove(): void;
}) {
  const subscribe = useMemo(() => exampleMeter(computer.id), [computer.id]);
  const incoming = findRoute(group, computer.id, local.id);
  const outgoing = findRoute(group, local.id, computer.id);
  if (!incoming || !outgoing) {
    return null;
  }
  const state = routeState(group, computer.id, local.id);
  const paused = group.pausedPairs.includes(pairKey(local.id, computer.id));
  const disabled = !computer.online || !local.online || paused || local.paused;
  return (
    <article
      className="simple-peer"
      aria-label={computer.name}
      data-computer-id={computer.id}
    >
      <div className="simple-peer-controls">
        <span>{computer.online ? computer.platform : 'Offline'}</span>
        <PeerMenu
          name={computer.name}
          paused={paused}
          onPause={onPause}
          onUnlink={onRemove}
        />
      </div>
      <div className="simple-peer-line">
        <div className="simple-lane">
          <RemoteAudioLane
            direction="in"
            kicker={computer.online ? 'CONNECTED' : 'OFFLINE'}
            title={computer.name}
            line={state.active ? computer.source : state.reason}
            live={state.active}
            meterKey={computer.id}
            subscribe={subscribe}
            figures={[]}
            switchId={`receive-${computer.id}`}
            switchLabel="Receive"
            isOn={incoming.receive}
            isSwitchDisabled={disabled}
            onToggle={() =>
              onRoute(computer.id, local.id, { receive: !incoming.receive })
            }
          />
        </div>
        <div className="simple-send">
          <span>Send</span>
          <Switch
            id={`send-${computer.id}`}
            ariaLabel={`Send to ${computer.name}`}
            isOn={outgoing.send}
            isDisabled={disabled}
            handleToggle={() =>
              onRoute(local.id, computer.id, { send: !outgoing.send })
            }
          />
        </div>
      </div>
    </article>
  );
}

export default function GroupComputers({
  group,
  local,
  onRoute,
  onComputer,
  onPause,
  onRemove,
}: {
  group: IGroup;
  local: IComputer;
  onRoute: TPatchRoute;
  onComputer(patch: Partial<Omit<IComputer, 'id'>>): void;
  onPause(id: string): void;
  onRemove(id: string): void;
}) {
  return (
    <section className="simple-panel simple-group" aria-label="The whole group">
      <header className="simple-panel-head">
        <h2>The whole group</h2>
        <span>
          {group.computers.filter((pc) => pc.online).length} online ·{' '}
          {group.computers.length} computers
        </span>
      </header>
      <OwnRow computer={local} onChange={onComputer} />
      {orderedComputers(group, local.id)
        .filter((pc) => pc.id !== local.id)
        .map((pc) => (
          <PeerRow
            key={pc.id}
            group={group}
            local={local}
            computer={pc}
            onRoute={onRoute}
            onPause={() => onPause(pc.id)}
            onRemove={() => onRemove(pc.id)}
          />
        ))}
      <footer className="simple-group-foot">
        <span>Your computer first. Everyone else in the same order.</span>
        <button
          type="button"
          className={local.paused ? 'button small' : 'button small subtle'}
          onClick={() => onComputer({ paused: !local.paused })}
        >
          {local.paused ? 'Resume here' : 'Pause here'}
        </button>
      </footer>
    </section>
  );
}
