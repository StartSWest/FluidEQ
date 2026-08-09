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
 * This is what puts the pill in the row of the file it describes, and colours
 * both the same. The panel used to name layers in one row and files in another
 * with nothing saying that `voicing` and `fluideq-4e9fbe8266bb-voicing.txt` were
 * the same thing; the name is what says so, so the name is what they are matched
 * on — never the order they happen to be listed in.
 *
 * Built from `APO_FEATURES` rather than spelled out, so a feature added later
 * cannot end up with a file this panel quietly declines to colour. The device
 * file and the custom file match nothing here on purpose — neither is a layer.
 */
const FEATURE_FILE = new RegExp(`-(${APO_FEATURES.join('|')})\\.txt$`, 'i');

const layerOfFile = (fileName: string) =>
  fileName.match(FEATURE_FILE)?.[1].toLowerCase();

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

/**
 * One layer, said in the one place it belongs.
 *
 * Almost always that place is the row of the file it describes — the pill and
 * the file are the same layer said twice, and said three inches apart they had
 * to be matched up by eye. The exceptions are the layers with no file at all,
 * which is why this is a component rather than markup inlined into the tree:
 * the strip below the tree draws the same pill from the same source, so a
 * bypassed voicing looks like the voicing it is rather than like a second
 * notation for one.
 */
const LayerPill = ({
  feature,
  isApplied,
  isLive,
}: {
  feature: string;
  isApplied: boolean;
  /** Whether Continuous EQ is maintaining this output as you read it. */
  isLive: boolean;
}) => {
  const { t } = useTranslation();
  return (
    // The same bar the chip row draws, in the same colour, because it is the
    // same layer: a pill here, a chip on the EQ page and a curve on the graph
    // all agree. Every pill used to be the one lime, so the row said which
    // layers existed and nothing about which was which.
    //
    // The name stays the raw feature key rather than the translated one. It
    // reads as a developer token, and that is exactly its value here — `voicing`
    // is literally the suffix of the `fluideq-4e9fbe8266bb-voicing.txt` it now
    // sits beside, so the word is what ties the pill to the file name a
    // centimetre to its left. A prettier label would break that.
    <span
      className={`config-layer${isApplied ? '' : ' is-off'}`}
      style={layerStyle(feature)}
    >
      <span className="config-layer__swatch" aria-hidden />
      <span className="config-layer__name">{feature}</span>
      {/* The one layer that can be changing while you read this. Everything
          else in the panel is a file sitting on disk exactly as somebody left
          it; Smart EQ under Continuous EQ is being rewritten as the measurement
          moves, and a panel that showed it as settled would be out of date by
          the time it was read.

          Only for the output actually playing: the loop measures what is coming
          out now, so it can only be keeping one device's file measured. */}
      {feature === 'smart' && isApplied && isLive && (
        <span className="config-layer__live" title={t('config.liveTitle')} />
      )}
      <span className="config-layer__state">
        {isApplied ? t('config.layer.on') : t('config.layer.off')}
      </span>
    </span>
  );
};

/** One file and its children, drawn as a disclosure and editable in place. */
const ConfigFileNode = ({
  file,
  isLive,
  onSaved,
}: {
  file: IApoConfigFile;
  /** Passed to the pills: Continuous EQ is running on this output. */
  isLive: boolean;
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
      // The pill goes on this row too, and says the layer is applied, because
      // an Include naming it is the config asking for it. That it is also
      // marked missing is the second half of the same sentence — and the pill
      // has nowhere else to be said: the strip below only holds layers the tree
      // never mentions, and this one it mentions and cannot find.
      <li className="config-node config-node--missing">
        <span className="config-node__name">{file.fileName}</span>
        {layer && <LayerPill feature={layer} isApplied isLive={isLive} />}
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
    // The layer's colour, carried down to the head's edge and into the pill in
    // it. Both are read off the file's own name — see `layerOfFile` — so the
    // edge, the swatch and the `-voicing.txt` at the end of the name are one
    // fact drawn three ways rather than three things to reconcile.
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
        {/* Immediately after the name, and only when the name has a layer in
            it. The device file and the custom file are not layers, and neither
            gets a placeholder — an empty pill-sized gap would shift their names
            out of line with every other row for the sake of saying nothing.

            Applied, because the file is here and the config includes it. That
            comes from the file rather than from the profile deliberately: the
            profile's own answer belongs to the layers with no file, and this
            panel's promise is to report what is on disk. */}
        {layer && <LayerPill feature={layer} isApplied isLive={isLive} />}
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
                  isLive={isLive}
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
   * The layers with no row in the tree, because they have no file.
   *
   * Every other layer is drawn in the row of the file it wrote, which is where
   * it belongs — the pill and the file name say the same word. These cannot be:
   * there is nothing for them to sit beside. Two quite different things end up
   * here and both need saying. A bypassed layer writes no file at all, and a
   * bypass whose only visible consequence is a row quietly disappearing is a
   * switch you cannot check the result of. The convolution never has a file in
   * any state — APO applies an impulse ahead of the filters, so it is one line
   * in the device file — and it would otherwise be the one layer this panel
   * never mentioned.
   *
   * Kept to exactly those, so the strip is not a second copy of the tree: it
   * appears only when there is something the files below cannot tell you.
   */
  const filelessLayers = useMemo(() => {
    if (!shown) {
      return [];
    }
    const filed = new Set(filedLayers(shown.file));
    return (shown.layers ?? []).filter((layer) => !filed.has(layer.feature));
  }, [shown]);

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
          <h2 id="config-title">{t('config.title')}</h2>
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
                <div className="config-device__transfer-actions">
                  <button
                    type="button"
                    className="config-device__export"
                    onClick={() => transferChain(() => exportChain(shown))}
                  >
                    {t('config.export')}
                  </button>
                  <button
                    type="button"
                    className="config-device__import"
                    onClick={() => transferChain(importChain)}
                  >
                    {t('config.import')}
                  </button>
                </div>
              </div>
              {/* Above the tree rather than under it, which is where the row
                  of every layer used to be. What is left in it is the one
                  thing the files cannot report, and a bypass confirmed only
                  after scrolling past five expanded files is not confirmed. */}
              {filelessLayers.length > 0 && (
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
                    file={shown.file}
                    isLive={isContinuousOn && isCurrent(shown)}
                    onSaved={load}
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
