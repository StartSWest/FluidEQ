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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
 * file still matches nothing; a non-empty custom file gets its own Custom FX
 * pill below because its contents are user-owned rather than a generated
 * feature file.
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
 * Usually that place is the row of the file it describes — the pill and the
 * file are the same layer said twice, and said three inches apart they had to
 * be matched up by eye. A layer with no file still has a place: the impulse is
 * a line in the device file, so its pill goes in that file's row, and a
 * bypassed layer belongs at the level its `Include:` is missing from, so it
 * gets a row of its own among the includes that were written.
 *
 * A component rather than markup inlined into the tree because all four of
 * those draw it, and a bypassed voicing has to look like the voicing it is
 * rather than like a second notation for one.
 */
const LayerPill = ({
  feature,
  isApplied,
  isLive,
  title,
}: {
  feature: string;
  isApplied: boolean;
  /** Whether Continuous EQ is maintaining this output as you read it. */
  isLive: boolean;
  /** Said on hover where the pill's place in the tree needs a sentence. */
  title?: string;
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
      title={title}
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
  subject,
  heldLayers = [],
  unwrittenLayers = [],
}: {
  file: IApoConfigFile;
  /** Passed to the pills: Continuous EQ is running on this output. */
  isLive: boolean;
  onSaved: () => void;
  /**
   * The output whose chain this file heads, named in the file's own row.
   *
   * Only the device file is given one, and it is the row that needed it: its
   * name is a digest of the endpoint id, so the file at the top of the tree was
   * the only one whose row said nothing about what it was for.
   */
  subject?: string;
  /**
   * Layers this file carries as a line of its own rather than as an `Include:`.
   *
   * The impulse response, in practice. Equalizer APO applies a convolution as a
   * stage ahead of the filters, so it is one `Convolution:` line in the device
   * file and never gets a file of its own — which used to leave its pill
   * floating in a strip above the tree, saying it had no file and nothing about
   * which file it was in. It is in this one.
   */
  heldLayers?: IApoConfigLayer[];
  /**
   * Layers whose `Include:` would have been in this file and is not.
   *
   * A bypassed layer keeps every setting and loses only its include, which is
   * the whole of the A/B switch — so there is no file to put its pill beside,
   * and the level it is missing from is the only thing left that places it.
   */
  unwrittenLayers?: IApoConfigLayer[];
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
  const hasCustomCommands =
    isCustom &&
    file.lines.some((line) => {
      const command = line.split('#')[0].trim();
      return command.length > 0;
    });
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
        {hasCustomCommands && (
          <LayerPill
            feature="custom"
            isApplied
            isLive={isLive}
            title="User-owned custom APO commands"
          />
        )}
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
        {/* Immediately after the name, when the name has a generated layer in
            it or this is a non-empty custom file. The device file itself gets
            nothing here. The column the pills start at is held open by the
            name, in the stylesheet, so a row without one still lines up with
            the rows around it rather than closing the gap.

            Applied, because the file is here and the config includes it. That
            comes from the file rather than from the profile deliberately: the
            profile's own answer belongs to the layers with no file, and this
            panel's promise is to report what is on disk. */}
        {layer && <LayerPill feature={layer} isApplied isLive={isLive} />}
        {hasCustomCommands && (
          <LayerPill
            feature="custom"
            isApplied
            isLive={isLive}
            title="User-owned custom APO commands"
          />
        )}
        {subject && (
          <span className="config-node__subject" title={subject}>
            {subject}
          </span>
        )}
        {/* In this row because this is the file the line is in. Applied or
            not comes from the profile here rather than from the file, and it
            has to: an impulse that is switched off leaves no `Convolution:`
            line behind, so the file alone cannot tell "no impulse" from "an
            impulse, switched off". */}
        {heldLayers.map((held) => (
          <LayerPill
            key={held.feature}
            feature={held.feature}
            isApplied={held.isApplied}
            isLive={isLive}
            title={t('config.layers.inFile')}
          />
        ))}
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
          {(file.includes.length > 0 || unwrittenLayers.length > 0) && (
            <ul className="config-node__children">
              {file.includes.map((child) => (
                <ConfigFileNode
                  key={child.fileName}
                  file={child}
                  isLive={isLive}
                  onSaved={onSaved}
                />
              ))}
              {/* After the includes, because that is what they are not. A row
                  among the files, at the level the layer's own file would have
                  been written to, saying it was not — which is a different
                  statement from the row simply not being there, and the only
                  one a bypass switch can be checked against. */}
              {unwrittenLayers.map((unwritten) => (
                <li
                  key={unwritten.feature}
                  className="config-node config-node--unwritten"
                >
                  <span className="config-node__name">
                    {t('config.layers.noFile')}
                  </span>
                  <LayerPill
                    feature={unwritten.feature}
                    isApplied={unwritten.isApplied}
                    isLive={isLive}
                  />
                </li>
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
