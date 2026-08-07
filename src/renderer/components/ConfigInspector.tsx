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

import { useCallback, useEffect, useState } from 'react';
import {
  IApoConfigDevice,
  IApoConfigFile,
  IApoConfigTree,
} from 'common/apoConfig';
import { getApoConfigTree } from '../utils/equalizerApi';
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

/** One file and its children, drawn as a disclosure. */
const ConfigFileNode = ({
  file,
  depth,
}: {
  file: IApoConfigFile;
  depth: number;
}) => {
  // Feature files open on arrival, the device file with them. There are never
  // more than a handful and the whole point of coming here is to see them; a
  // tree that must be unfolded before it says anything is a worse answer than
  // the five files it is hiding.
  const [isOpen, setIsOpen] = useState(true);
  const filterCount = file.lines.filter((line) =>
    /^Filter\s+\d+\s*:/i.test(line),
  ).length;

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

  return (
    <li className="config-node" style={{ '--depth': depth } as never}>
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
        {filterCount > 0 && (
          <span className="config-node__badge">
            {filterCount} {filterCount === 1 ? 'filter' : 'filters'}
          </span>
        )}
      </button>
      {isOpen && (
        <>
          {file.lines.length > 0 && (
            <pre className="config-node__lines">{file.lines.join('\n')}</pre>
          )}
          {file.includes.length > 0 && (
            <ul className="config-node__children">
              {file.includes.map((child) => (
                <ConfigFileNode
                  key={child.fileName}
                  file={child}
                  depth={depth + 1}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
};

const ConfigDeviceCard = ({ device }: { device: IApoConfigDevice }) => (
  <section className="config-device">
    <header className="config-device__head">
      <h4>{device.label ?? device.devicePattern}</h4>
      <code className="config-device__pattern">{device.devicePattern}</code>
    </header>
    <div className="config-device__facts">
      <span>
        {device.filterCount} {device.filterCount === 1 ? 'filter' : 'filters'}
      </span>
      {device.preAmp && <span>{device.preAmp}</span>}
      {device.convolution && <span>impulse response</span>}
    </div>
    {device.file ? (
      <ul className="config-device__tree">
        <ConfigFileNode file={device.file} depth={0} />
      </ul>
    ) : (
      // The neutral fallback block FluidEQ writes for every output without a
      // profile. It names no file because it applies nothing, and saying so is
      // better than an empty space somebody has to interpret.
      <p className="config-device__empty">
        Nothing included — this output is left alone.
      </p>
    )}
  </section>
);

const ConfigInspector = () => {
  const [tree, setTree] = useState<IApoConfigTreeState>({ status: 'loading' });

  const load = useCallback(async () => {
    setTree({ status: 'loading' });
    try {
      const result = await getApoConfigTree();
      setTree(
        result ? { status: 'ready', tree: result } : { status: 'absent' },
      );
    } catch (error) {
      setTree({ status: 'failed', message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="config-inspector">
      <div className="config-inspector__bar">
        <div>
          <span className="eyebrow">Equalizer APO config</span>
          <p className="config-inspector__lede">
            What is on disk right now, not what FluidEQ intends.
          </p>
        </div>
        <button type="button" onClick={load}>
          Reload
        </button>
      </div>

      {tree.status === 'loading' && (
        <p className="config-inspector__note">Reading the config…</p>
      )}
      {tree.status === 'absent' && (
        <p className="config-inspector__note">
          FluidEQ has not written to this Equalizer APO installation yet.
        </p>
      )}
      {tree.status === 'failed' && (
        <p className="config-inspector__note config-inspector__note--error">
          {tree.message}
        </p>
      )}
      {tree.status === 'ready' && (
        <>
          <code className="config-inspector__path">
            {tree.tree.configDirPath}
          </code>
          {tree.tree.devices.map((device) => (
            <ConfigDeviceCard
              key={`${device.devicePattern}-${device.label ?? ''}`}
              device={device}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default ConfigInspector;
