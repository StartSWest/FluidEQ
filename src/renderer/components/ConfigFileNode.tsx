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

import {
  APO_FEATURES,
  APO_FEATURE_FILE_WORD_PATTERN,
  FILTER_LINE_PREFIX_REGEX,
  apoFeatureFileWord,
  apoFeatureOfFileWord,
} from 'common/constants';
import { IApoConfigFile, IApoConfigLayer } from 'common/apoConfig';
import { useState } from 'react';
import { LAYER_SWATCH } from '../styles/color';
import { useTranslation } from '../utils/I18nContext';
import { useCurrentEngine } from '../utils/audioEngineContext';
import { writeApoConfigFile } from '../utils/equalizerApi';

// One file of the config as the inspector draws it: its name, the layer
// it belongs to and that layer's pill, and its text, open for editing.

/** The one file per output that FluidEQ creates and then never writes again. */
const isCustomFile = (fileName: string) => /-custom\.txt$/i.test(fileName);

/**
 * Which layer a file holds, read off the name FluidEQ gave it.
 *
 * This is what puts the pill in the row of the file it describes, and colours
 * both the same. The panel used to name layers in one row and files in another
 * with nothing saying that `preset` and `fluideq-4e9fbe8266bb-preset.txt` were
 * the same thing; the name is what says so, so the name is what they are matched
 * on — never the order they happen to be listed in.
 *
 * Built from `APO_FEATURES` rather than spelled out, so a feature added later
 * cannot end up with a file this panel quietly declines to colour. The device
 * file still matches nothing; a non-empty custom file gets its own Custom FX
 * pill below because its contents are user-owned rather than a generated
 * feature file.
 */
const FEATURE_FILE = new RegExp(
  `-(${APO_FEATURE_FILE_WORD_PATTERN})\\.txt$`,
  'i',
);

/** The feature a file holds, by its key: the colours and the chips use it. */
export const layerOfFile = (fileName: string): string | undefined => {
  const word = fileName.match(FEATURE_FILE)?.[1];
  return word ? apoFeatureOfFileWord(word) : undefined;
};

/**
 * What a pill says: the word in its file's name, which for the voicing is
 * `preset` — see `apoFeatureFileWord`. The impulse and the custom file have no
 * feature file and are called by their own names.
 */
const pillWord = (layer: string): string => {
  const feature = APO_FEATURES.find((one) => one === layer);
  return feature ? apoFeatureFileWord(feature) : layer;
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
export const LayerPill = ({
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
    // The name stays the raw word in the file name rather than a translated
    // label. It reads as a developer token, and that is exactly its value here
    // — `preset` is literally the suffix of the `fluideq-4e9fbe8266bb-
    // preset.txt` it sits beside, so the word is what ties the pill to the
    // file name a centimetre to its left. A prettier label would break that.
    <span
      className={`config-layer${isApplied ? '' : ' is-off'}`}
      style={layerStyle(feature)}
      title={title}
    >
      <span className="config-layer__swatch" aria-hidden />
      <span className="config-layer__name">{pillWord(feature)}</span>
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
export const ConfigFileNode = ({
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
  const isFluid = useCurrentEngine() === 'fluid';
  // Open on arrival. There are never more than a handful and the whole point
  // of coming here is to see them; a tree that must be unfolded before it says
  // anything is a worse answer than the five files it is hiding.
  const [isOpen, setIsOpen] = useState(true);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState('');
  const filterCount = file.lines.filter((line) =>
    FILTER_LINE_PREFIX_REGEX.test(line),
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
            title={t('config.customCommands')}
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
    // edge, the swatch and the `-preset.txt` at the end of the name are one
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
            title={t('config.customCommands')}
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
                  {t(
                    isFluid ? 'config.hint.saving.fluid' : 'config.hint.saving',
                  )}
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
