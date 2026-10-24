/* FluidEQ — GPL-3.0-or-later. Standalone English design preview. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/renderer/styles/App.scss';
import '../../../src/renderer/styles/Button.scss';
import '../../../src/renderer/styles/RemoteAudio.scss';
import CurrentCards from './CurrentCards';
import Dropdown from '../../../src/renderer/widgets/Dropdown';
import GroupComputers from './GroupComputers';
import YourMix from './YourMix';
import {
  addComputer,
  initialGroup,
  orderedComputers,
  removeComputer,
  togglePair,
  updateComputer,
  updateRoute,
} from './groupModel';
import './preview.scss';

function Preview() {
  const [group, setGroup] = useState(initialGroup);
  const [localId, setLocalId] = useState('win');
  const [current, setCurrent] = useState(false);
  const [compact, setCompact] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('Kitchen PC');
  const [message, setMessage] = useState('');
  const local = group.computers.find((pc) => pc.id === localId);
  if (!local) {
    return null;
  }
  const changeLocal = (patch: Parameters<typeof updateComputer>[2]) =>
    setGroup((previous) => updateComputer(previous, local.id, patch));

  return (
    <div className={`group-preview${compact ? ' is-compact' : ''}`}>
      <header className="simple-preview-tools">
        <span>Simulated preview</span>
        <div className="simple-perspective">
          <span>Viewing as</span>
          <Dropdown
            name="Viewing as"
            options={orderedComputers(group).map((pc) => ({
              value: pc.id,
              label: `${pc.name} · ${pc.platform}`,
              display: `${pc.name} · ${pc.platform}`,
            }))}
            value={local.id}
            isDisabled={false}
            handleChange={(id) => {
              setLocalId(id);
              setMessage('');
            }}
          />
        </div>
        <details className="simple-design-tools">
          <summary className="button small subtle">Design tools</summary>
          <div>
            <button
              type="button"
              className="button small subtle"
              onClick={() => setCurrent(!current)}
            >
              {current ? 'Proposed group' : 'Current app cards'}
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() => setCompact(!compact)}
            >
              {compact ? 'Full width' : 'Narrow panel'}
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                setGroup(initialGroup());
                setLocalId('win');
                setMessage('');
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() =>
                setGroup((previous) =>
                  updateComputer(previous, 'studio', {
                    online: !previous.computers.find((pc) => pc.id === 'studio')
                      ?.online,
                  }),
                )
              }
            >
              Studio PC online / offline
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() => changeLocal({ captureReady: !local.captureReady })}
            >
              Audio access needed / ready
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() =>
                setGroup((previous) =>
                  updateComputer(previous, 'mac', {
                    name: 'MacBook Pro — Living room music and video workstation',
                  }),
                )
              }
            >
              Long computer name
            </button>
          </div>
        </details>
      </header>
      <main className="simple-content">
        <header className="simple-title">
          <h1>Share Audio</h1>
          <button
            type="button"
            className="button small"
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
          >
            Add computer
          </button>
        </header>
        {adding && (
          <form
            className="simple-add"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newName.trim()) {
                return;
              }
              setGroup((previous) =>
                addComputer(previous, {
                  id: crypto.randomUUID(),
                  name: newName.trim(),
                  platform: 'Linux',
                  online: true,
                  captureReady: true,
                  sharing: true,
                  paused: false,
                  systemVolume: 1,
                  output: 'Speakers',
                  source: 'System audio · Browser & apps',
                }),
              );
              setAdding(false);
              setMessage(
                'Computer added to the whole group. Enable Receive to hear it.',
              );
            }}
          >
            <label htmlFor="preview-computer-name">
              Simulated computer name
              <input
                id="preview-computer-name"
                aria-label="Computer name"
                value={newName}
                maxLength={80}
                required
                onChange={(event) => setNewName(event.target.value)}
              />
            </label>
            <button type="submit" className="button small">
              Add simulated computer
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </form>
        )}
        {message && (
          <p className="simple-message" role="status">
            {message}
          </p>
        )}
        {current ? (
          <CurrentCards key={local.id} group={group} local={local} />
        ) : (
          <div className="simple-columns">
            <GroupComputers
              group={group}
              local={local}
              onComputer={changeLocal}
              onRoute={(from, to, patch) =>
                setGroup((previous) => updateRoute(previous, from, to, patch))
              }
              onPause={(id) =>
                setGroup((previous) => togglePair(previous, local.id, id))
              }
              onRemove={(id) =>
                setGroup((previous) => removeComputer(previous, id))
              }
            />
            <YourMix
              group={group}
              local={local}
              onComputer={changeLocal}
              onLevel={(from, level) =>
                setGroup((previous) =>
                  updateRoute(previous, from, local.id, { level }),
                )
              }
            />
          </div>
        )}
      </main>
      <p className="simple-preview-note">
        Design preview · Waveforms and connections are simulated. No audio is
        captured or played.
      </p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Preview />);
}
