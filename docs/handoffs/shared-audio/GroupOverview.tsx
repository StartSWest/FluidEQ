/* FluidEQ — GPL-3.0-or-later. Design preview only. */

import {
  orderedComputers,
  routeState,
  findRoute,
  type IGroup,
} from './groupModel';

export default function GroupOverview({
  group,
  localId,
}: {
  group: IGroup;
  localId: string;
}) {
  const computers = orderedComputers(group);
  return (
    <aside className="group-overview">
      <section className="group-overview-card">
        <p className="eyebrow">THE WHOLE GROUP</p>
        <h3>Who hears whom</h3>
        <p>
          Rows send. Columns listen.
          <br />
          The same overview on every computer.
        </p>
        <div className="group-matrix-scroll">
          <table className="group-matrix">
            <thead>
              <tr>
                <th scope="col">From ↓ / To →</th>
                {computers.map((pc) => (
                  <th key={pc.id} scope="col" title={pc.name}>
                    {pc.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computers.map((from) => (
                <tr key={from.id}>
                  <th scope="row" title={from.name}>
                    {from.name.split(' ')[0]}
                  </th>
                  {computers.map((to) => {
                    const state = routeState(group, from.id, to.id);
                    const self = from.id === to.id;
                    return (
                      <td key={to.id}>
                        <span
                          className={`group-matrix-dot${state.active ? ' is-on' : ''}${self ? ' is-self' : ''}`}
                          title={
                            self
                              ? 'Local sound is not looped back'
                              : `${from.name} → ${to.name}: ${state.reason}`
                          }
                          aria-label={
                            self
                              ? `${from.name}: no loopback`
                              : `${from.name} to ${to.name}: ${state.reason}`
                          }
                        >
                          {self && '—'}
                          {!self && (state.active ? '✓' : '·')}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="group-matrix-key">
          <span>
            <i />
            Audio flowing
          </span>
          <span>· Off, paused or offline</span>
        </div>
      </section>
      <section className="group-overview-card">
        <p className="eyebrow">YOUR LISTENING MIX</p>
        <h3>Volume on this computer</h3>
        <div className="group-mix">
          {computers
            .filter((pc) => pc.id !== localId)
            .map((pc) => {
              const state = routeState(group, pc.id, localId);
              const route = findRoute(group, pc.id, localId);
              return (
                <div className={state.active ? '' : 'is-quiet'} key={pc.id}>
                  <span>{pc.name}</span>
                  <strong>{Math.round((route?.level ?? 1) * 100)}%</strong>
                  <span className="group-mix-track">
                    <i style={{ width: `${state.gain * 100}%` }} />
                  </span>
                  <small>{state.active ? 'Receiving' : state.reason}</small>
                </div>
              );
            })}
        </div>
        <p>Your mix only changes what you hear here.</p>
      </section>
      <section className="group-overview-card group-preview-note">
        <p className="eyebrow">INTERACTIVE DESIGN PREVIEW</p>
        <p>
          All computers, waveforms and connections are simulated. No audio is
          captured or played.
        </p>
        <p>Switch computers above to see shared settings from both ends.</p>
      </section>
    </aside>
  );
}
