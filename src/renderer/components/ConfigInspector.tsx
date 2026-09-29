/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IApoConfigDevice,
  IApoConfigFile,
  IApoConfigLayer,
  IApoConfigTree,
} from 'common/apoConfig';
import { APO_FEATURES } from 'common/constants';
import {
  exportDeviceChain,
  getApoConfigTree,
  getAudioDevices,
  importDeviceChain,
} from '../utils/equalizerApi';
import MenuIcon from '../icons/MenuIcon';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useContinuousEq } from '../utils/continuousEq';
import { useTranslation } from '../utils/I18nContext';
import { useCurrentEngine } from '../utils/audioEngineContext';

import '../styles/Button.scss';
import '../styles/ConfigInspector.scss';
import { ConfigFileNode, LayerPill, layerOfFile } from './ConfigFileNode';

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

/**
 * Every layer the tree actually holds a file for, read off the names.
 *
 * Off the names rather than off the layer list, because those are two different
 * claims and this panel reports the file: a layer the profile calls applied
 * that has no file under the device is precisely the disagreement worth
 * showing, and asking the profile which layers have files would hide it.
 *
 * The whole tree rather than the device file's own includes — a chain built by
 * an older FluidEQ, or edited by hand, can nest one file deeper than this one
 * would, and a layer whose pill has a row somewhere must not also be listed as
 * having none.
 */
const filedLayers = (file: IApoConfigFile | undefined): string[] => {
  if (!file) {
    return [];
  }
  const own = layerOfFile(file.fileName);
  return [
    ...(own ? [own] : []),
    ...file.includes.flatMap((child) => filedLayers(child)),
  ];
};

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

/**
 * The `Device:` pattern of the output Windows was last found playing
 * through, for the next reading of this page — this visit's or a later one's.
 *
 * The tree is local files and the output is a PowerShell enumeration, and the
 * two used to be awaited together, so every reading — each visit, and each
 * edit made anywhere while the page is open — drew nothing until the
 * enumeration came back. With the output known the tree is drawn as soon as
 * it is read. Only while it is not known — the first reading, and the first
 * after the output moves — does the tree wait for it: the current output's
 * card leads the row and is the one selected, and drawing first would move
 * both a moment later.
 */
let knownPattern: string | undefined;
let isWatchingOutputs = false;

const rememberPattern = (pattern: string) => {
  knownPattern = pattern;
  if (!isWatchingOutputs) {
    isWatchingOutputs = true;
    // For the life of the window: the output can move while this page is
    // not open, and the next visit must not draw the old one's card first.
    window.addEventListener('fluideq-output-changed', () => {
      knownPattern = undefined;
    });
  }
};

const ConfigInspector = () => {
  const { t } = useTranslation();
  // The page shows whichever engine's folder the app writes to; its words
  // have to name that engine, not the one that used to be the only choice.
  const isFluid = useCurrentEngine() === 'fluid';
  const {
    isEnabled,
    bypassed,
    filters,
    voicing,
    driver,
    smartEq,
    customFx,
    convolution,
    preAmp,
    refreshState,
  } = useFluidEqContext();
  const isContinuousOn = useContinuousEq();
  const [state, setState] = useState<IApoConfigTreeState>({
    status: 'loading',
  });
  /** The `Device:` pattern of the output Windows is playing through. */
  const [currentPattern, setCurrentPattern] = useState<string>(
    () => knownPattern ?? '',
  );
  const [selected, setSelected] = useState<string | undefined>(undefined);
  /** The newest reading; an older one's answers are dropped. */
  const readingRef = useRef(0);

  const load = useCallback(async () => {
    readingRef.current += 1;
    const reading = readingRef.current;
    setState({ status: 'loading' });
    const readOutput = async () => {
      const devices = await getAudioDevices().catch(() => []);
      if (reading !== readingRef.current) {
        return;
      }
      const active = devices.find((device) => device.isDefault);
      const pattern = active?.guid || active?.name || '';
      rememberPattern(pattern);
      setCurrentPattern(pattern);
    };
    const outputRead = readOutput();
    const tree = await getApoConfigTree().catch((error: Error) => error);
    if (knownPattern === undefined) {
      await outputRead;
    }
    if (reading !== readingRef.current) {
      return;
    }

    if (tree instanceof Error) {
      setState({ status: 'failed', message: tree.message });
      return;
    }
    setState(tree ? { status: 'ready', tree } : { status: 'absent' });
  }, []);

  const onConfigSaved = useCallback(async () => {
    // A custom file is user-owned, so saving it bypasses the generated-state
    // writer. Refresh the live state as well as this tree so a new curve is
    // visible on the graph immediately.
    await refreshState();
    await load();
  }, [load, refreshState]);

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

  /**
   * The import's own note, plus the one thing main cannot phrase.
   *
   * A bundle's custom block is the sender's text rather than a tuning, so an
   * import that carries a `Plugin:` or an `Include:` lands everything except
   * that block — see `isSafeImportedCustomBlock`. Saying nothing would leave
   * somebody with a chain that is quietly missing a part of itself, so the
   * sentence is appended here, where the dictionary is.
   */
  const importChain = useCallback(async () => {
    const outcome = await importDeviceChain();
    return outcome.isCustomSkipped
      ? `${outcome.note} ${t('config.import.customSkipped')}`
      : outcome.note;
  }, [t]);

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
    customFx,
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

  /**
   * The layers with no file, which is not the same as the layers with no place.
   *
   * Every other layer is drawn in the row of the file it wrote, which is where
   * it belongs — the pill and the file name say the same word. These have no
   * such row, and used to be swept into a strip above the tree labelled "no
   * file of its own": true, and no help at all to somebody looking at an
   * `impulse` pill hanging over five files and wondering which of them it was
   * part of. Both kinds have a level even though neither has a file, so both go
   * into the tree at theirs.
   */
  const filelessLayers = useMemo(() => {
    if (!shown) {
      return [];
    }
    const filed = new Set(filedLayers(shown.file));
    return (shown.layers ?? []).filter((layer) => !filed.has(layer.feature));
  }, [shown]);

  /**
   * Which of them the device file holds, and which are simply absent from it.
   *
   * Split on whether the layer is a feature, because that is exactly what
   * decides it: a feature is written to a file of its own and is therefore
   * missing from the includes when it is bypassed, while anything that is not a
   * feature — the convolution — is a line in the device file whether or not any
   * feature is switched off. The first kind is a row among the includes; the
   * second is a pill in the row of the file it is a line of.
   */
  const { heldLayers, unwrittenLayers } = useMemo(() => {
    const isFeature = (layer: IApoConfigLayer) =>
      (APO_FEATURES as readonly string[]).includes(layer.feature);
    return {
      heldLayers: filelessLayers.filter((layer) => !isFeature(layer)),
      unwrittenLayers: filelessLayers.filter(isFeature),
    };
  }, [filelessLayers]);

  return (
    <section className="config-inspector" aria-labelledby="config-title">
      {/* The same header every other tab page carries: a kicker, the name of
          the page, and a line saying what it is for. This one had the kicker
          and the line but no heading at all, which left it the one tab a
          screen reader could not announce and the one that did not look like
          the others. */}
      <div className="config-inspector__bar">
        <div className="config-inspector__title">
          <span className="eyebrow">{t('config.eyebrow')}</span>
          <h2 id="config-title">
            {t(isFluid ? 'config.title.fluid' : 'config.title')}
          </h2>
          <p className="config-inspector__lede">{t('config.lede')}</p>
        </div>
        {/* The app's own quiet button, as every page card's action is. A bare
            <button> inherited the global field styling and came out as a wide
            pale slab that read as a text input somebody had disabled; a copy
            of the button written here came out 25px beside the others' 32. */}
        <button
          type="button"
          className="button small subtle config-inspector__reload"
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
        <p className="config-inspector__note">
          {t(isFluid ? 'config.absent.fluid' : 'config.absent')}
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
              {t(
                isFluid
                  ? 'config.status.notIncluded.fluid'
                  : 'config.status.notIncluded',
              )}
            </p>
          )}
          {state.tree.isIncludedByApo && !state.tree.isApplied && (
            <p className="config-status config-status--off">
              {t(
                isFluid
                  ? 'config.status.engineOff.fluid'
                  : 'config.status.engineOff',
              )}
            </p>
          )}
          {state.tree.isIncludedByApo && state.tree.isApplied && (
            <p className="config-status config-status--on">
              {t(
                isFluid ? 'config.status.active.fluid' : 'config.status.active',
              )}
            </p>
          )}

          <div
            className="config-inspector__cards"
            role="tablist"
            aria-label={t(
              isFluid ? 'config.outputsAria.fluid' : 'config.outputsAria',
            )}
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
              {/* The two buttons together at the end of the row, with the note
                  holding the space to their left.

                  They were separated for a while, Export at one end and Import
                  at the other with the note between, on the argument that the
                  undoable one should not sit next to the one that overwrites
                  what you are listening to. That was tried and is not what this
                  is: they are one pair of opposite directions through the same
                  door, and split across a row they read as two unrelated
                  controls with a caption in the middle.

                  Export is still first in the markup, so tabbing reaches it
                  before Import. The note leads now rather than sitting between
                  them, which is the order it is read in as well as the order it
                  is laid out in. */}
              <div className="config-device__transfer">
                <span className="config-device__transfer-note">
                  {transferNote || t('config.import.hint')}
                </span>
                {/* One arrow each, and they point at the difference.
                    Side by side these are a mirrored pair of words, and in
                    several of the ten languages the words for export and import
                    differ by a syllable. The tray tells them apart before the
                    label is read: out of the machine, or into it. Hidden from
                    anything that reads rather than looks, because the label
                    beside it already says which is which. */}
                <div className="config-device__transfer-actions">
                  <button
                    type="button"
                    className="config-device__export"
                    onClick={() => transferChain(() => exportChain(shown))}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden>
                      <path d="M8 10V2.5M5.2 5.3L8 2.5l2.8 2.8" />
                      <path d="M2.5 9.8v3.7h11V9.8" />
                    </svg>
                    {t('config.export')}
                  </button>
                  <button
                    type="button"
                    className="config-device__import"
                    onClick={() => transferChain(importChain)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden>
                      <path d="M8 2.5V10M5.2 7.2L8 10l2.8-2.8" />
                      <path d="M2.5 9.8v3.7h11V9.8" />
                    </svg>
                    {t('config.import')}
                  </button>
                </div>
              </div>
              {/* Only for an output with no tree to put them in.
                  Where there is one they are in it — the impulse in the row of
                  the device file that holds its line, a bypassed layer as a row
                  at the level its include is missing from. This is the leftover
                  case: a block that includes nothing at all still has layers
                  worth reporting, and nowhere to report them but here. */}
              {!shown.file && filelessLayers.length > 0 && (
                <div className="config-layers">
                  <span className="config-layers__lead" id="config-fileless">
                    {t('config.layers.noFile')}
                  </span>
                  <ul
                    className="config-layers__list"
                    aria-labelledby="config-fileless"
                  >
                    {filelessLayers.map((layer) => (
                      <li key={layer.feature}>
                        <LayerPill
                          feature={layer.feature}
                          isApplied={layer.isApplied}
                          isLive={isContinuousOn && isCurrent(shown)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {shown.file ? (
                <ul className="config-device__tree">
                  <ConfigFileNode
                    key={`${keyOf(shown)}|${customFx?.fileName ?? 'no-custom'}`}
                    file={shown.file}
                    subject={splitLabel(shown).output}
                    heldLayers={heldLayers}
                    unwrittenLayers={unwrittenLayers}
                    isLive={isContinuousOn && isCurrent(shown)}
                    onSaved={onConfigSaved}
                  />
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
    </section>
  );
};

export default ConfigInspector;
