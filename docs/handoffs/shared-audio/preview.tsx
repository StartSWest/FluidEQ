/* FluidEQ — GPL-3.0-or-later. English design preview, outside the app bundle. */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/renderer/styles/App.scss';
import '../../../src/renderer/styles/Button.scss';
import '../../../src/renderer/styles/RemoteAudio.scss';
import MenuIcon from '../../../src/renderer/icons/MenuIcon';
import CurrentCards from './CurrentCards';
import { ComputerCard, LocalCard } from './ComputerCard';
import GroupOverview from './GroupOverview';
import {
  addComputer,
  initialGroup,
  orderedComputers,
  removeComputer,
  togglePair,
  updateComputer,
  updateRoute,
  type IRoute,
} from './groupModel';
import './preview.scss';

const ROOT = document.getElementById('root');

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
  const rest = orderedComputers(group, localId).filter(
    (pc) => pc.id !== localId,
  );
  const online = group.computers.filter((pc) => pc.online).length;
  const patchRoute = (
    from: string,
    to: string,
    patch: Partial<Pick<IRoute, 'send' | 'receive' | 'level'>>,
  ) => {
    setGroup((previous) => updateRoute(previous, from, to, patch));
  };
  const reset = () => {
    setGroup(initialGroup());
    setLocalId('win');
    setMessage('Preview reset.');
  };

  return (
    <div className={`group-preview${compact ? ' is-compact' : ''}`}>
      <header className="group-preview-toolbar">
        <span>
          <strong>Share Audio</strong>
          <span className="group-preview-badge">Design preview</span>
        </span>
        <label htmlFor="preview-perspective">
          Viewing as
          <select
            id="preview-perspective"
            aria-label="Viewing as"
            value={localId}
            onChange={(event) => {
              setLocalId(event.target.value);
              setMessage('');
            }}
          >
            {orderedComputers(group).map((pc) => (
              <option key={pc.id} value={pc.id}>
                {pc.name} · {pc.platform}
                {pc.online ? '' : ' · Offline'}
              </option>
            ))}
          </select>
        </label>
        <div className="group-preview-modes">
          <button
            type="button"
            className={current ? 'button small subtle' : 'button small'}
            aria-pressed={!current}
            onClick={() => setCurrent(false)}
          >
            Proposed group
          </button>
          <button
            type="button"
            className={current ? 'button small' : 'button small subtle'}
            aria-pressed={current}
            onClick={() => setCurrent(true)}
          >
            Current app cards
          </button>
        </div>
        <button
          type="button"
          className="button small subtle"
          aria-pressed={compact}
          onClick={() => setCompact(!compact)}
        >
          {compact ? 'Full width' : 'Narrow panel'}
        </button>
        <button type="button" className="button small subtle" onClick={reset}>
          Reset
        </button>
      </header>

      <div className="group-app">
        <div className="group-workspace">
          <div className="group-content">
            <header className="group-page-heading">
              <div>
                <p className="eyebrow">YOUR COMPUTERS. ONE AUDIO SPACE.</p>
                <h1>Share Audio</h1>
                <p>Send your sound. Choose what you hear.</p>
              </div>
              <span className="group-security">
                <MenuIcon name="checkAll" />
                Local network · Encrypted audio
              </span>
            </header>
            <section className="group-summary" aria-label="My computers group">
              <span className="group-summary-icon">
                <MenuIcon name="bothWays" />
              </span>
              <span>
                <strong>My computers</strong>
                <small>
                  {online} online · {group.computers.length} in group
                </small>
              </span>
              <span className="group-summary-copy">
                Join once. Everyone sees everyone.
              </span>
              <button
                type="button"
                className="button small"
                onClick={() => setAdding(!adding)}
                aria-expanded={adding}
              >
                Add computer
              </button>
            </section>
            {adding && (
              <form
                className="group-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newName.trim();
                  if (!name) {
                    return;
                  }
                  const id = crypto.randomUUID();
                  setGroup((previous) =>
                    addComputer(previous, {
                      id,
                      name,
                      platform: 'Linux',
                      online: true,
                      captureReady: true,
                      sharing: true,
                      paused: false,
                      sendLevel: 1,
                      output: 'Speakers',
                      source: 'System audio · Browser & apps',
                    }),
                  );
                  setAdding(false);
                  setMessage(
                    `${name} joined the shared roster on every computer. Receive is off until each listener enables it.`,
                  );
                }}
              >
                <div>
                  <strong>Invite a computer to this group</strong>
                  <p>
                    In the app: enter the group invitation, then approve the new
                    computer. Here: add a simulated member.
                  </p>
                </div>
                <label htmlFor="preview-computer-name">
                  Computer name
                  <input
                    id="preview-computer-name"
                    aria-label="Computer name"
                    value={newName}
                    maxLength={80}
                    required
                    onChange={(event) => setNewName(event.target.value)}
                  />
                </label>
                <button className="button small" type="submit">
                  Add simulated computer
                </button>
                <button
                  className="button small subtle"
                  type="button"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </button>
              </form>
            )}
            <p className="group-live-message" role="status">
              {message}
            </p>
            <div className="group-columns">
              <main className="group-computers">
                {current ? (
                  <CurrentCards key={local.id} group={group} local={local} />
                ) : (
                  <>
                    <LocalCard
                      computer={local}
                      onChange={(patch) =>
                        setGroup((previous) =>
                          updateComputer(previous, local.id, patch),
                        )
                      }
                    />
                    <div className="group-list-heading">
                      <h2>Other computers</h2>
                      <span>
                        Same order everywhere · Offline computers keep their
                        place
                      </span>
                    </div>
                    <div className="group-bulk-controls">
                      <button
                        type="button"
                        className="button small subtle"
                        onClick={() => {
                          setGroup((previous) => ({
                            ...previous,
                            routes: previous.routes.map((route) =>
                              route.from === local.id
                                ? { ...route, send: true }
                                : route,
                            ),
                          }));
                        }}
                      >
                        Send to all
                      </button>
                      <button
                        type="button"
                        className="button small subtle"
                        onClick={() => {
                          setGroup((previous) => ({
                            ...previous,
                            routes: previous.routes.map((route) =>
                              route.to === local.id
                                ? { ...route, receive: true }
                                : route,
                            ),
                          }));
                        }}
                      >
                        Receive from all
                      </button>
                      <span />
                      <button
                        type="button"
                        className={
                          local.paused ? 'button small' : 'button small subtle'
                        }
                        onClick={() =>
                          setGroup((previous) =>
                            updateComputer(previous, local.id, {
                              paused: !local.paused,
                            }),
                          )
                        }
                      >
                        {local.paused
                          ? 'Resume this computer'
                          : 'Pause this computer'}
                      </button>
                    </div>
                    {rest.map((pc) => (
                      <ComputerCard
                        key={pc.id}
                        group={group}
                        local={local}
                        computer={pc}
                        onRoute={patchRoute}
                        onPause={() =>
                          setGroup((previous) =>
                            togglePair(previous, local.id, pc.id),
                          )
                        }
                        onRemove={() => {
                          setGroup((previous) =>
                            removeComputer(previous, pc.id),
                          );
                          setMessage(
                            `${pc.name} removed from the group on every computer.`,
                          );
                        }}
                      />
                    ))}
                  </>
                )}
              </main>
              <GroupOverview group={group} localId={local.id} />
            </div>
            <footer className="group-scenarios" aria-label="Preview scenarios">
              <strong>Try a scenario</strong>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setGroup((previous) =>
                    updateComputer(previous, 'studio', {
                      online: !previous.computers.find(
                        (pc) => pc.id === 'studio',
                      )?.online,
                    }),
                  );
                }}
              >
                Studio PC online / offline
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setGroup((previous) =>
                    updateComputer(previous, local.id, {
                      captureReady: !local.captureReady,
                    }),
                  );
                }}
              >
                Audio access needed / ready
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setGroup((previous) =>
                    updateComputer(previous, 'mac', {
                      name: 'MacBook Pro — Living room music and video workstation',
                    }),
                  );
                }}
              >
                Long computer name
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

if (ROOT) {
  createRoot(ROOT).render(<Preview />);
}
