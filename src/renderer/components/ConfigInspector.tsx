/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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
import { APO_FEATURES } from 'common/constants';
import {
  exportDeviceChain,
  getApoConfigTree,
  getAudioDevices,
  importDeviceChain,
  writeApoConfigFile,
} from '../utils/equalizerApi';
import MenuIcon from '../icons/MenuIcon';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useContinuousEq } from '../utils/continuousEq';
import { useTranslation } from '../utils/I18nContext';
import { LAYER_SWATCH } from '../styles/color';
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

/**
 * Which layer a file holds, read off the name FluidEQ gave it.
 *
 * This is what lets a pill and a file block be shown in the same colour, which
 * is the only thing tying the two halves of this panel together: the pills name
 * layers, the tree names files, and nothing said that `voicing` and
 * `fluideq-4e9fbe8266bb-voicing.txt` were the same thing.
 *
 * Built from `APO_FEATURES` rather than spelled out, so a feature added later
 * cannot end up with a file this panel quietly declines to colour. The device
 * file and the custom file match nothing here on purpose — neither is a layer.
 */
const FEATURE_FILE = new RegExp(`-(${APO_FEATURES.join('|')})\\.txt$`, 'i');

const layerOfFile = (fileName: string) =>
  fileName.match(FEATURE_FILE)?.[1].toLowerCase();

/**
 * The layer's colour as a custom property, or nothing for a layer without one.
 *
 * Returning `undefined` rather than a fallback hex leaves the default in the
 * stylesheet, where it can be written in the same tokens as everything around
 * it instead of being a second hard-coded colour in the TSX.
 */
const layerStyle = (layer: string | undefined) =>
  layer && LAYER_SWATCH[layer]
    ? ({ '--layer-color': LAYER_SWATCH[layer] } as React.CSSProperties)
    : undefined;

/**
 * The `Preamp:` line with its number rounded, for the one-line summary only.
 *
 * The writer works the headroom out in floating point and gives Equalizer APO
 * every digit of it, so the file genuinely says `Preamp: -3.876390213587826
 * dB`. That is right on disk and unreadable in a facts row: the two digits that
 * mean anything are lost among thirteen that never change what you hear, and
 * the string is long enough to wrap the row it sits in.
 *
 * Only the first number is touched, and only for display — the file's own text
 * is shown verbatim in the block below, so nothing is hidden by rounding the
 * summary. A preamp written without decimals is left exactly as it is.
 */
const roundPreAmp = (line: string) =>
  line.replace(/-?\d+\.\d+/, (value) => Number(value).toFixed(2));

/** One file and its children, drawn as a disclosure and editable in place. */
const ConfigFileNode = ({
  file,
  onSaved,
}: {
  file: IApoConfigFile;
  onSaved: () => void;
}) => {
  const { t } = useTranslation();
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
  const layer = layerOfFile(file.fileName);

  if (file.isMissing) {
    return (
      <li className="config-node config-node--missing">
        <span className="config-node__name">{file.fileName}</span>
        <span className="config-node__badge config-node__badge--missing">
          {t('config.file.missing')}
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
    // The layer's colour, carried down to the head's edge below. A file block
    // and the pill above it are the same layer said twice, and the colour is
    // what says so — see `layerOfFile`.
    <li
      className={`config-node${isCustom ? ' config-node--custom' : ''}${
        layer ? ' config-node--layer' : ''
      }`}
      style={layerStyle(layer)}
    >
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
            {t('config.file.yours')}
          </span>
        )}
        {filterCount > 0 && (
          <span className="config-node__badge">
            {t(
              filterCount === 1 ? 'config.filters.one' : 'config.filters.many',
              { count: filterCount },
            )}
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
                    ? t('config.hint.custom')
                    : t('config.hint.generated')}
                </span>
                <button
                  type="button"
                  className="config-node__edit"
                  onClick={() => setDraft(file.lines.join('\n'))}
                >
                  {t('config.edit')}
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
                  {t('config.hint.saving')}
                </span>
                <button type="button" onClick={() => setDraft(undefined)}>
                  {t('config.cancel')}
                </button>
                <button
                  type="button"
                  className="config-node__edit"
                  onClick={save}
                >
                  {t('config.save')}
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
  const { t } = useTranslation();
  const {
    isEnabled,
    bypassed,
    filters,
    voicing,
    driver,
    smartEq,
    convolution,
    preAmp,
  } = useFluidEqContext();
  const isContinuousOn = useContinuousEq();
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

  // Re-read whenever anything that rewrites the config changes.
  //
  // This panel reports a file, and the file is rewritten by every edit made
  // anywhere else in the app — so a view that only read once was a snapshot
  // pretending to be a window. Switching the engine off rewrites the config to
  // name no output at all, and the panel went on showing the chain that was no
  // longer being applied.
  //
  // Keyed on the state that reaches the writer rather than on a change event,
  // because there is no such event: the flush is a file write, and nothing
  // downstream of it tells the window it happened.
  //
  // Except while Continuous EQ is running, and that exception is why this note
  // is longer than the effect. That mode rewrites the Smart EQ file every few
  // seconds, and each rewrite landed here as a full re-read of every config
  // file, plus a device enumeration, plus a rebuild of the tree — the panel
  // visibly reloading itself over and over for as long as anybody left it open.
  // Watching a file that is being written continuously is not a thing to do
  // continuously.
  //
  // Nothing is lost by leaving it out. That layer's row already carries a pip
  // saying it is being maintained while you read it, which is a truer statement
  // than a number that was right two seconds ago, and Reload is there for
  // anybody who wants the bytes as they stand. Every other change still reloads
  // at once — including switching the mode off, which is what puts the panel
  // back in step.
  /**
   * Whatever the last export or import had to say, or nothing.
   *
   * Both go through a native dialog, so the window has no idea whether anything
   * happened until the reply comes back — and cancelling is an ordinary outcome
   * that replies with an empty string rather than an error. One line for the
   * answer either way, next to the buttons that asked.
   */
  const [transferNote, setTransferNote] = useState('');

  const transferChain = useCallback(
    async (run: () => Promise<string>) => {
      setTransferNote('');
      try {
        const note = await run();
        setTransferNote(note);
        if (note) {
          // Only when something actually changed. A cancelled dialog leaves the
          // files exactly as they were, and re-reading them says nothing.
          await load();
        }
      } catch (error) {
        setTransferNote((error as Error).message);
      }
    },
    [load],
  );

  const exportChain = useCallback(
    (device: IApoConfigDevice) => exportDeviceChain(device.devicePattern),
    [],
  );

  const settledSmartEq = isContinuousOn ? undefined : smartEq;
  useEffect(() => {
    load();
  }, [
    load,
    isEnabled,
    bypassed,
    filters,
    voicing,
    driver,
    settledSmartEq,
    convolution,
    preAmp,
    isContinuousOn,
  ]);

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
          <span className="eyebrow">{t('config.eyebrow')}</span>
          <p className="config-inspector__lede">{t('config.lede')}</p>
        </div>
        {/* Icon and label, sized like the rest of the app's controls. A bare
            <button> inherited the global field styling and came out as a wide
            pale slab that read as a text input somebody had disabled. */}
        <button
          type="button"
          className="config-inspector__reload"
          onClick={load}
          disabled={state.status === 'loading'}
          title={t('config.reloadTitle')}
        >
          <MenuIcon name="restart" />
          <span>
            {state.status === 'loading'
              ? t('config.reading')
              : t('config.reload')}
          </span>
        </button>
      </div>

      {state.status === 'absent' && (
        <p className="config-inspector__note">{t('config.absent')}</p>
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
              {t('config.status.notIncluded')}
            </p>
          )}
          {state.tree.isIncludedByApo && !state.tree.isApplied && (
            <p className="config-status config-status--off">
              {t('config.status.engineOff')}
            </p>
          )}
          {state.tree.isIncludedByApo && state.tree.isApplied && (
            <p className="config-status config-status--on">
              {t('config.status.active')}
            </p>
          )}

          <div
            className="config-inspector__cards"
            role="tablist"
            aria-label={t('config.outputsAria')}
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
                    {t(
                      device.filterCount === 1
                        ? 'config.filters.one'
                        : 'config.filters.many',
                      { count: device.filterCount },
                    )}
                    {device.convolution ? ` · ${t('config.impulse')}` : ''}
                  </span>
                  {isCurrent(device) && (
                    <span className="config-card__badge">
                      {t('config.playingNow')}
                    </span>
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
                  {t(
                    shown.filterCount === 1
                      ? 'config.filters.one'
                      : 'config.filters.many',
                    { count: shown.filterCount },
                  )}
                </span>
                {shown.preAmp && <span>{roundPreAmp(shown.preAmp)}</span>}
              </div>
              {/* A chain, out to a file and back in again.
                  What travels is the profile, not these files: their names
                  carry a hash of the output they belong to, so the files
                  themselves are meaningless anywhere else. The profile
                  regenerates the whole chain correctly named for wherever it
                  lands. The custom file goes along literally, being the one
                  part FluidEQ does not generate.

                  Import is not per-card on purpose. It changes what is heard,
                  and the only output somebody can judge the result on is the
                  one already playing — so it always lands on that, and says
                  so. */}
              {/* Import sits at the far right, with the note between the two.

                  Side by side they were a pair of equals, and they are not:
                  Export writes a file you chose the name of, Import overwrites
                  the chain you are listening to right now. The one you can undo
                  should not be the neighbour of the one you cannot, close
                  enough to hit by accident. The note has to go somewhere and the
                  gap is the one place it is not trailing off the end of a row.

                  The reading order is unchanged, so tabbing still reaches
                  Export before Import. */}
              <div className="config-device__transfer">
                <button
                  type="button"
                  className="config-device__export"
                  onClick={() => transferChain(() => exportChain(shown))}
                >
                  {t('config.export')}
                </button>
                <span className="config-device__transfer-note">
                  {transferNote || t('config.import.hint')}
                </span>
                <button
                  type="button"
                  className="config-device__import"
                  onClick={() => transferChain(importDeviceChain)}
                >
                  {t('config.import')}
                </button>
              </div>
              {/* Every layer this output has, applied or not.
                  A switched-off layer has no file, so without this the panel
                  would simply stop showing it the moment it was bypassed —
                  which is the one thing somebody who just pressed a bypass
                  switch wants to see confirmed. */}
              {shown.layers && shown.layers.length > 0 && (
                <ul className="config-layers">
                  {shown.layers.map((layer) => (
                    <li
                      key={layer.feature}
                      className={`config-layer${
                        layer.isApplied ? '' : ' is-off'
                      }`}
                      style={layerStyle(layer.feature)}
                    >
                      {/* The same bar the chip row draws, in the same colour,
                          because it is the same layer: a pill here, a chip on
                          the EQ page and a curve on the graph now all agree.
                          Every pill used to be the one lime, so the row said
                          which layers existed and nothing about which was
                          which.

                          The name stays the raw feature key rather than the
                          translated one. It reads as a developer token, and
                          that is exactly its value here — `voicing` is
                          literally the suffix of
                          `fluideq-4e9fbe8266bb-voicing.txt` in the tree below,
                          so the word itself is half the answer to "which file
                          is this". A prettier label would break that. */}
                      <span className="config-layer__swatch" aria-hidden />
                      <span className="config-layer__name">
                        {layer.feature}
                      </span>
                      {/* The one layer that can be changing while you read
                          this. Everything else in the panel is a file sitting
                          on disk exactly as somebody left it; Smart EQ under
                          Continuous EQ is being rewritten as the measurement
                          moves, and a panel that showed it as settled would be
                          out of date by the time it was read.

                          Only for the output actually playing: the loop
                          measures what is coming out now, so it can only be
                          keeping one device's file measured. */}
                      {layer.feature === 'smart' &&
                        layer.isApplied &&
                        isContinuousOn &&
                        isCurrent(shown) && (
                          <span
                            className="config-layer__live"
                            title={t('config.liveTitle')}
                          />
                        )}
                      <span className="config-layer__state">
                        {layer.isApplied
                          ? t('config.layer.on')
                          : t('config.layer.off')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {shown.file ? (
                <ul className="config-device__tree">
                  <ConfigFileNode file={shown.file} onSaved={load} />
                </ul>
              ) : (
                // The neutral fallback block FluidEQ writes for every output
                // without a profile. It names no file because it applies
                // nothing, and saying so is better than an empty space
                // somebody has to interpret.
                <p className="config-device__empty">{t('config.empty')}</p>
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
