/* FluidEQ — GPL-3.0-or-later. English design preview, outside the app bundle. */

import MenuIcon from '../../../src/renderer/icons/MenuIcon';
import RemoteAudioLane from '../../../src/renderer/remoteAudio/RemoteAudioLane';
import type { TRemoteAudioMeterListener } from '../../../src/renderer/remoteAudio/meter';
import Switch from '../../../src/renderer/widgets/Switch';
import {
  findRoute,
  pairKey,
  routeState,
  type IComputer,
  type IGroup,
  type IRoute,
} from './groupModel';

// Painted example readings only. No source is captured or played by this preview.
const subscribeExample = (listener: TRemoteAudioMeterListener) => {
  let frame = 0;
  let count = 0;
  const paint = () => {
    count += 1;
    if (count % 4 === 0) {
      ['win', 'mac', 'linux', 'studio', 'kitchen'].forEach((id, index) => {
        const phase = count * 0.08 + index * 3;
        const peak =
          0.035 + Math.abs(Math.sin(phase) * Math.cos(phase * 0.37)) * 0.38;
        listener({
          sourceId: id,
          peak,
          rms: peak / 2,
          waveform: new Float32Array(0),
        });
      });
    }
    frame = requestAnimationFrame(paint);
  };
  frame = requestAnimationFrame(paint);
  return () => cancelAnimationFrame(frame);
};

interface IComputerCardProps {
  group: IGroup;
  local: IComputer;
  computer: IComputer;
  onRoute(
    from: string,
    to: string,
    patch: Partial<Pick<IRoute, 'send' | 'receive' | 'level'>>,
  ): void;
  onPause(): void;
  onRemove(): void;
}

export const ComputerCard = ({
  group,
  local,
  computer,
  onRoute,
  onPause,
  onRemove,
}: IComputerCardProps) => {
  const incoming = findRoute(group, computer.id, local.id);
  const outgoing = findRoute(group, local.id, computer.id);
  if (!incoming || !outgoing) {
    return null;
  }
  const incomingState = routeState(group, computer.id, local.id);
  const outgoingState = routeState(group, local.id, computer.id);
  const paused = group.pausedPairs.includes(pairKey(local.id, computer.id));
  const disabled = !computer.online || !local.online || local.paused || paused;
  const names = { from: computer.name, to: local.name };

  return (
    <article
      className={`remote-audio__link group-computer${computer.online ? '' : ' is-away'}`}
      aria-label={computer.name}
      data-computer-id={computer.id}
    >
      <header className="remote-audio__link-head">
        <span className="remote-audio__link-icon">
          <MenuIcon name="monitor" />
        </span>
        <span className="remote-audio__link-name">
          <strong>{computer.name}</strong>
          <span>
            {computer.platform} ·{' '}
            {computer.online
              ? 'In your group'
              : 'Offline · Settings remembered'}
          </span>
        </span>
        <span className={`group-status${computer.online ? '' : ' is-quiet'}`}>
          <i />
          {computer.online ? 'Connected' : 'Offline'}
        </span>
        <span className="remote-audio__link-spacer" />
        <button
          type="button"
          className={paused ? 'button small' : 'button small subtle'}
          onClick={onPause}
          aria-label={`${paused ? 'Resume' : 'Pause'} ${computer.name}`}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={onRemove}
          aria-label={`Remove ${computer.name} from group`}
        >
          Remove
        </button>
      </header>
      <div className="remote-audio__lanes group-lanes">
        <RemoteAudioLane
          direction="in"
          kicker="RECEIVE"
          title="Hear it here"
          line={incomingState.active ? computer.source : incomingState.reason}
          lineDetail={incomingState.active ? `From ${names.from}` : undefined}
          live={incomingState.active}
          meterKey={computer.id}
          subscribe={subscribeExample}
          figures={[]}
          switchId={`receive-${computer.id}`}
          switchLabel="Receive"
          isOn={incoming.receive}
          isSwitchDisabled={disabled}
          onToggle={() =>
            onRoute(computer.id, local.id, { receive: !incoming.receive })
          }
          level={{
            value: incoming.level,
            label: `Volume from ${computer.name}`,
            isDisabled: disabled || !incoming.receive,
            onChange: (level) => onRoute(computer.id, local.id, { level }),
          }}
        />
        <RemoteAudioLane
          direction="out"
          kicker="SEND"
          title="Send my sound"
          line={outgoingState.active ? local.source : outgoingState.reason}
          lineDetail={outgoingState.active ? `To ${computer.name}` : undefined}
          live={outgoingState.active}
          meterKey={local.id}
          subscribe={subscribeExample}
          figures={[]}
          switchId={`send-${computer.id}`}
          switchLabel="Send"
          isOn={outgoing.send}
          isSwitchDisabled={disabled}
          onToggle={() =>
            onRoute(local.id, computer.id, { send: !outgoing.send })
          }
        />
      </div>
    </article>
  );
};

const localStatus = (computer: IComputer) => {
  if (!computer.online) {
    return 'Offline';
  }
  if (computer.paused) {
    return 'Paused here';
  }
  return computer.captureReady ? 'Ready' : 'Receive only';
};

export const LocalCard = ({
  computer,
  onChange,
}: {
  computer: IComputer;
  onChange(patch: Partial<Omit<IComputer, 'id'>>): void;
}) => (
  <article
    className="remote-audio__link group-local"
    data-computer-id={computer.id}
    aria-label={`${computer.name} — this computer`}
  >
    <header className="remote-audio__link-head">
      <span className="remote-audio__link-icon">
        <MenuIcon name="monitor" />
      </span>
      <span className="remote-audio__link-name">
        <strong>
          {computer.name} <span className="group-local-tag">This computer</span>
        </strong>
        <span>{computer.platform} · Always at the top on this screen</span>
      </span>
      <span className="remote-audio__link-spacer" />
      <span className="group-status">
        <i />
        {localStatus(computer)}
      </span>
    </header>
    {!computer.captureReady && (
      <p className="group-warning" role="status">
        Audio access needed. You can still receive sound from the other
        computers.
      </p>
    )}
    <div className="group-local-controls">
      <label className="group-output" htmlFor="preview-output">
        Play received audio through
        <select
          id="preview-output"
          value={computer.output}
          onChange={(event) => onChange({ output: event.target.value })}
        >
          {[
            ...new Set([
              computer.output,
              'Headphones',
              'Speakers',
              'USB audio interface',
            ]),
          ].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <div className="group-source-control">
        <span>Share my computer’s sound</span>
        <Switch
          id="share-source"
          ariaLabel="Share my computer’s sound"
          isOn={computer.sharing}
          isDisabled={
            computer.paused || !computer.captureReady || !computer.online
          }
          handleToggle={() => onChange({ sharing: !computer.sharing })}
        />
        <label className="group-send-level" htmlFor="preview-send-level">
          Send level
          <input
            id="preview-send-level"
            type="range"
            min="0"
            max="100"
            value={Math.round(computer.sendLevel * 100)}
            aria-label="My send level"
            disabled={!computer.sharing || computer.paused || !computer.online}
            onChange={(event) =>
              onChange({ sendLevel: Number(event.target.value) / 100 })
            }
          />
          <output>{Math.round(computer.sendLevel * 100)}%</output>
        </label>
      </div>
    </div>
    <p className="group-local-foot">
      <MenuIcon name="bothWays" />
      Your sound goes directly to each listener. Received audio stays out of
      your send.
    </p>
  </article>
);
