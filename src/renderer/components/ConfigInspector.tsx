/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IApoConfigDevice,
  IApoConfigFile,
  IApoConfigTree,
} from 'common/apoConfig';
import {
  getApoConfigTree,
  getAudioDevices,
  writeApoConfigFile,
} from '../utils/equalizerApi';
import MenuIcon from '../icons/MenuIcon';
import '../styles/ConfigInspector.scss';

/**
 * Four outcomes, not a tree and a loading flag.
 *
 * "No config yet" and "could not read it" are different answers and want
 * different words: the first is an ordinary state on a fresh install, the
 * second is a fault. Collapsing them into an empty tree would show somebody a
 * blank panel for both.
 */
type IApoConfigTreeState =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; tree: IApoConfigTree };

/**
 * What Equalizer APO has actually got, per output.
 *
 * Every other panel in this app shows what FluidEQ intends. This one shows what
 * is on disk, which is a different thing exactly when it matters: after a hand
 * edit, after another tool, after a write that failed, after a restore from
 * backup. The config is the thing you are hearing; everything else is a belief
 * about it.
 *
 * It also answers a question the split created. A chain used to be one block
 * you could read top to bottom; it is now a root file, a file per device and a
 * file per feature, which is a much better thing to write and a much worse
 * thing to read. This puts the tree back together without flattening it, so
 * both the structure and the contents stay visible.
 */

/** The one file per output that FluidEQ creates and then never writes again. */
const isCustomFile = (fileName: string) => /-custom\.txt$/i.test(fileName);

/** One file and its children, drawn as a disclosure and editable in place. */
const ConfigFileNode = ({
  file,
  onSaved,
}: {
  file: IApoConfigFile;
  onSaved: () => void;
}) => {
  // Open on arrival. There are never more than a handful and the whole point
  // of coming here is to see them; a tree that must be unfolded before it says
  // anything is a worse answer than the five files it is hiding.
  const [isOpen, setIsOpen] = useState(true);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState('');
  const filterCount = file.lines.filter((line) =>
    /^Filter\s+\d+\s*:/i.test(line),
  ).length;
  const isCustom = isCustomFile(file.fileName);

  if (file.isMissing) {
    return (
      <li className="config-node config-node--missing">
        <span className="config-node__name">{file.fileName}</span>
        <span className="config-node__badge config-node__badge--missing">
          missing
        </span>
      </li>
    );
  }

  const save = async () => {
    setSaveError('');
    try {
      await writeApoConfigFile(file.fileName, draft ?? '');
      setDraft(undefined);
      onSaved();
    } catch (error) {
      setSaveError((error as Error).message);
    }
  };

  return (
    <li className={`config-node${isCustom ? ' config-node--custom' : ''}`}>
      <button
        type="button"
        className="config-node__head"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="config-node__twist" aria-hidden>
          {isOpen ? '▾' : '▸'}
        </span>
        <span className="config-node__name">{file.fileName}</span>
        {isCustom && (
          <span className="config-node__badge config-node__badge--custom">
            yours
          </span>
        )}
        {filterCount > 0 && (
          <span className="config-node__badge">
            {filterCount} {filterCount === 1 ? 'filter' : 'filters'}
          </span>
        )}
      </button>
      {isOpen && (
        <>
          {draft === undefined ? (
            <div className="config-node__body">
              {file.lines.length > 0 && (
                <pre className="config-node__lines">
                  {file.lines.join('\n')}
                </pre>
              )}
              <div className="config-node__actions">
                {/* Said plainly rather than by disabling the button. A
                    generated file can be edited and the edit will take effect
                    — it just will not last, and somebody typing into it
                    deserves to know that before they type rather than after
                    their work disappears. */}
                <span className="config-node__hint">
                  {isCustom
                    ? 'Yours. Never overwritten.'
                    : 'Generated — rewritten on the next change.'}
                </span>
                <button
                  type="button"
                  className="config-node__edit"
                  onClick={() => setDraft(file.lines.join('\n'))}
                >
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <div className="config-node__body">
              <textarea
                className="config-node__editor"
                value={draft}
                spellCheck={false}
                rows={Math.min(18, Math.max(4, draft.split('\n').length + 1))}
                onChange={(event) => setDraft(event.target.value)}
              />
              {saveError && <p className="config-node__error">{saveError}</p>}
              <div className="config-node__actions">
                <span className="config-node__hint">
                  Saving writes the file; Equalizer APO picks it up.
                </span>
                <button type="button" onClick={() => setDraft(undefined)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="config-node__edit"
                  onClick={save}
                >
                  Save
                </button>
              </div>
            </div>
          )}
          {file.includes.length > 0 && (
            <ul className="config-node__children">
              {file.includes.map((child) => (
                <ConfigFileNode
                  key={child.fileName}
                  file={child}
                  onSaved={onSaved}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
};

/**
 * The name a card carries.
 *
 * FluidEQ writes `<output> -> <profile>` above every Device line, so the label
 * already holds both halves. Split so the output can be the title and the
 * profile the subtitle, and fall back to the whole string for a block written
 * by anything else.
 */
const splitLabel = (device: IApoConfigDevice) => {
  const [output, profile] = (device.label ?? '').split(' -> ');
  if (!output) {
    return { output: device.devicePattern, profile: undefined };
  }
  return { output, profile };
};

const ConfigInspector = () => {
  const [state, setState] = useState<IApoConfigTreeState>({
    status: 'loading',
  });
  /** The `Device:` pattern of the output Windows is playing through. */
  const [currentPattern, setCurrentPattern] = useState<string>('');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    // The devices are asked for alongside the config rather than before it, so
    // a machine where enumeration is slow still shows the tree promptly and
    // simply cannot mark which output is current.
    const [tree, devices] = await Promise.all([
      getApoConfigTree().catch((error: Error) => error),
      getAudioDevices().catch(() => []),
    ]);

    const active = devices.find((device) => device.isDefault);
    setCurrentPattern(active?.guid || active?.name || '');

    if (tree instanceof Error) {
      setState({ status: 'failed', message: tree.message });
      return;
    }
    setState(tree ? { status: 'ready', tree } : { status: 'absent' });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The current output first, and everything else in the order the config
   * lists it.
   *
   * The one somebody is listening through is the one they came here about, so
   * it is worth taking out of file order and putting at the front. The rest
   * stay as APO reads them, because that order is a fact about the file rather
   * than a presentation choice.
   */
  const devices = useMemo(() => {
    if (state.status !== 'ready') {
      return [];
    }
    const matches = (device: IApoConfigDevice) =>
      !!currentPattern &&
      device.devicePattern.toLowerCase() === currentPattern.toLowerCase();

    return [
      ...state.tree.devices.filter(matches),
      ...state.tree.devices.filter((device) => !matches(device)),
    ];
  }, [state, currentPattern]);

  const isCurrent = (device: IApoConfigDevice) =>
    !!currentPattern &&
    device.devicePattern.toLowerCase() === currentPattern.toLowerCase();

  const keyOf = (device: IApoConfigDevice) =>
    `${device.devicePattern}|${device.label ?? ''}`;

  // Defaults to the first card, which the sort above has already made the
  // current output wherever there is one.
  const selectedKey = selected ?? (devices[0] ? keyOf(devices[0]) : undefined);
  const shown = devices.find((device) => keyOf(device) === selectedKey);

  return (
    <div className="config-inspector">
      <div className="config-inspector__bar">
        <div className="config-inspector__title">
          <span className="eyebrow">Equalizer APO config</span>
          <p className="config-inspector__lede">
            What is on disk right now, not what FluidEQ intends.
          </p>
        </div>
        {/* Icon and label, sized like the rest of the app's controls. A bare
            <button> inherited the global field styling and came out as a wide
            pale slab that read as a text input somebody had disabled. */}
        <button
          type="button"
          className="config-inspector__reload"
          onClick={load}
          disabled={state.status === 'loading'}
          title="Read the config from disk again"
        >
          <MenuIcon name="restart" />
          <span>{state.status === 'loading' ? 'Reading…' : 'Reload'}</span>
        </button>
      </div>

      {state.status === 'absent' && (
        <p className="config-inspector__note">
          FluidEQ has not written to this Equalizer APO installation yet.
        </p>
      )}
      {state.status === 'failed' && (
        <p className="config-inspector__note config-inspector__note--error">
          {state.message}
        </p>
      )}

      {state.status === 'ready' && (
        <>
          {/* Whether any of this reaches the sound card, said before the tree
              rather than left to be inferred from it.

              There are three ways to be silent and they want different words.
              APO not including fluideq.txt means nothing below is read at all,
              and something outside this app changed that. A config naming no
              output is the engine switch doing exactly its job. Neither looks
              any different from a flat chain when all you can see is files. */}
          {!state.tree.isIncludedByApo && (
            <p className="config-status config-status--off">
              Equalizer APO is not including this config. Nothing below is being
              applied.
            </p>
          )}
          {state.tree.isIncludedByApo && !state.tree.isApplied && (
            <p className="config-status config-status--off">
              The FluidEQ engine is switched off — this config names no output,
              so Equalizer APO is applying none of it.
            </p>
          )}
          {state.tree.isIncludedByApo && state.tree.isApplied && (
            <p className="config-status config-status--on">
              Active — Equalizer APO is applying this config.
            </p>
          )}

          <div
            className="config-inspector__cards"
            role="tablist"
            aria-label="Outputs in the Equalizer APO config"
          >
            {devices.map((device) => {
              const { output, profile } = splitLabel(device);
              const key = keyOf(device);
              return (
                <button
                  type="button"
                  role="tab"
                  key={key}
                  aria-selected={key === selectedKey}
                  className={`config-card${
                    key === selectedKey ? ' is-selected' : ''
                  }${isCurrent(device) ? ' is-current' : ''}`}
                  onClick={() => setSelected(key)}
                >
                  <span className="config-card__name">{output}</span>
                  {profile && (
                    <span className="config-card__profile">{profile}</span>
                  )}
                  <span className="config-card__facts">
                    {device.filterCount}{' '}
                    {device.filterCount === 1 ? 'filter' : 'filters'}
                    {device.convolution ? ' · impulse' : ''}
                  </span>
                  {isCurrent(device) && (
                    <span className="config-card__badge">Playing now</span>
                  )}
                </button>
              );
            })}
          </div>

          {shown && (
            <section className="config-device">
              <header className="config-device__head">
                <h4>{splitLabel(shown).output}</h4>
                <code className="config-device__pattern">
                  {shown.devicePattern}
                </code>
              </header>
              <div className="config-device__facts">
                <span>
                  {shown.filterCount}{' '}
                  {shown.filterCount === 1 ? 'filter' : 'filters'}
                </span>
                {shown.preAmp && <span>{shown.preAmp}</span>}
                {shown.convolution && <span>impulse response</span>}
              </div>
              {shown.file ? (
                <ul className="config-device__tree">
                  <ConfigFileNode file={shown.file} onSaved={load} />
                </ul>
              ) : (
                // The neutral fallback block FluidEQ writes for every output
                // without a profile. It names no file because it applies
                // nothing, and saying so is better than an empty space
                // somebody has to interpret.
                <p className="config-device__empty">
                  Nothing included — this output is left alone.
                </p>
              )}
            </section>
          )}

          <code className="config-inspector__path">
            {state.tree.configDirPath}
          </code>
        </>
      )}
    </div>
  );
};

export default ConfigInspector;
