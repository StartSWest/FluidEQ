/* FluidEQ — GPL-3.0-or-later. Local listening mix for the design preview. */
import Dropdown from '../../../src/renderer/widgets/Dropdown';
import PreviewFader from './PreviewFader';
import {
  findRoute,
  orderedComputers,
  routeState,
  type IComputer,
  type IGroup,
} from './groupModel';

export default function YourMix({
  group,
  local,
  onLevel,
  onComputer,
}: {
  group: IGroup;
  local: IComputer;
  onLevel(from: string, level: number): void;
  onComputer(patch: Partial<Omit<IComputer, 'id'>>): void;
}) {
  const outputs = [
    ...new Set([local.output, 'Headphones', 'Speakers', 'USB audio interface']),
  ];
  return (
    <section className="remote-audio__link" aria-label="Your mix">
      <header className="remote-audio__link-head">
        <span className="remote-audio__link-name">
          <strong>Your mix</strong>
        </span>
      </header>
      <div className="remote-audio__lane preview-output">
        <span className="control-kicker">Output</span>
        <Dropdown
          name="Output"
          options={outputs.map((name) => ({
            value: name,
            label: name,
            display: name,
          }))}
          value={local.output}
          isDisabled={false}
          handleChange={(output) => onComputer({ output })}
        />
      </div>
      <PreviewFader
        id="this-pc-volume"
        label="This PC"
        ariaLabel="This PC system volume"
        value={local.systemVolume}
        caption="This computer’s system volume"
        onChange={(systemVolume) => onComputer({ systemVolume })}
      />
      {orderedComputers(group)
        .filter((pc) => pc.id !== local.id)
        .map((pc) => {
          const route = findRoute(group, pc.id, local.id);
          const state = routeState(group, pc.id, local.id);
          return (
            <PreviewFader
              key={pc.id}
              id={`volume-${pc.id}`}
              label={pc.name}
              ariaLabel={`Volume from ${pc.name}`}
              value={route?.level ?? 1}
              caption={state.active ? 'Receiving' : state.reason}
              disabled={!local.online || !pc.online || local.paused}
              onChange={(level) => onLevel(pc.id, level)}
            />
          );
        })}
    </section>
  );
}
