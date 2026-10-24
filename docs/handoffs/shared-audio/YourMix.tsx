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
    <section className="simple-panel simple-mix" aria-label="Your mix">
      <header className="simple-panel-head">
        <h2>Your mix</h2>
        <span>What you hear here</span>
      </header>
      <div className="simple-output">
        <span>Output</span>
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
        className="simple-master"
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
              className={state.active ? '' : 'is-quiet'}
              onChange={(level) => onLevel(pc.id, level)}
            />
          );
        })}
    </section>
  );
}
