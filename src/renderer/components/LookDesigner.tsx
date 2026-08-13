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

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { TranslationKey } from 'common/i18n';
import {
  GraphPalette,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  getGraphLook,
  hasGraphAccent,
  isDiscreteGraphStyle,
} from 'common/graphStyles';
import {
  DEFAULT_LEVEL_COLOURS,
  DEFAULT_SIGNAL_COLOUR,
  ICustomLook,
  ILookTuning,
  MAX_ATTACK_MS,
  MAX_FILL_OPACITY,
  MAX_GLOW,
  MAX_LOOK_COLOURS,
  MAX_LOOK_NAME_LENGTH,
  MAX_RELEASE_MS,
  MAX_STROKE_WIDTH,
  MIN_ATTACK_MS,
  MIN_BORDER_WIDTH,
  MAX_BORDER_WIDTH,
  MIN_FILL_OPACITY,
  MIN_GLOW,
  MIN_LOOK_COLOURS,
  MIN_RELEASE_MS,
  MIN_STROKE_WIDTH,
  createDraftLook,
  getDefaultTuning,
  getMaxLookColours,
  normalizeLookName,
  parseLookFile,
  serializeLookFile,
  toLookFileName,
  rebaseDraftLook,
  recolourDraftLook,
} from 'common/customLooks';
import { BAND_SPECTRUM_HEX } from '../utils/bandColors';
import { useIsRootEuphoric } from '../utils/euphoriaMode';
import { useTranslation } from '../utils/I18nContext';
import {
  clearLookDraft,
  deleteCustomLook,
  getCustomLook,
  isCustomLookListFull,
  readLookDraft,
  saveCustomLook,
  writeLookDraft,
} from '../utils/customLooks';
import {
  getGraphLookId,
  getResolvedLook,
  setGraphLook,
  setLookDraft,
  useSelectedLookId,
} from '../utils/graphStyle';
import '../styles/LookDesigner.scss';

/**
 * Written out rather than taken from `GRAPH_PALETTE_LABELS`.
 *
 * That table names looks in the picker, where the signal palette is the
 * unmarked case and so has an empty label — "Bars" rather than "Bars · signal".
 * Here they are side by side as a choice, and a choice with an unnamed option
 * is not one.
 *
 * The hints say what the colour *means* rather than what it looks like, because
 * that is the whole difference between the two gradients: one is painted along
 * the frequency axis and one up the decibel axis, and from a still picture of a
 * loud frame they can look much the same.
 */
const PALETTE_CHOICES: {
  value: GraphPalette;
  label: TranslationKey;
  hint: TranslationKey;
}[] = [
  {
    value: 'signal',
    label: 'look.palette.flat',
    hint: 'look.palette.flatHint',
  },
  {
    value: 'rainbow',
    label: 'look.palette.frequency',
    hint: 'look.palette.frequencyHint',
  },
  {
    value: 'level',
    label: 'look.palette.level',
    hint: 'look.palette.levelHint',
  },
];

/**
 * Where a palette's colours start when somebody decides to change them.
 *
 * Not the same question as `getDefaultPaletteColours`, which answers "what does
 * this palette paint if left alone" — and for two of the three the answer there
 * is "the colours already on screen", which is no use to a colour picker. This
 * one always returns something editable, starting from what is currently drawn
 * so the first thing the panel shows is not a change.
 */
const seedPaletteColours = (palette: GraphPalette): string[] => {
  if (palette === 'level') {
    return [...DEFAULT_LEVEL_COLOURS];
  }
  if (palette === 'rainbow') {
    return BAND_SPECTRUM_HEX.slice(0, MAX_LOOK_COLOURS);
  }
  return [DEFAULT_SIGNAL_COLOUR];
};

/**
 * The colours a stop can be set to without leaving the panel.
 *
 * The native colour input opens Chromium's own picker, which is a saturation
 * square, a hue strip and three numeric fields — about three hundred pixels of
 * chrome dropped over a two-hundred-and-fifty pixel panel, covering the very
 * graph the colour is being chosen against. It is a fine tool for specifying a
 * colour and a poor one for picking one while watching a wave.
 *
 * This is the other half of that trade: a fixed set, one click, nothing
 * covered. Two rows — the app's own accents first, then a spread around the
 * wheel — which is enough to build any ramp anybody has asked for. The native
 * picker is still there behind "custom" for the case this cannot serve.
 */
const SWATCH_CHOICES = [
  '#00e5cf',
  '#54ff8a',
  '#ffcc4d',
  '#ff8a3d',
  '#ff4f4f',
  '#ff4f9a',
  '#c86bff',
  '#6b8aff',
  '#00b3ff',
  '#ffffff',
  '#9aa7b8',
  '#0d1420',
];

interface IStopPickerProps {
  colour: string;
  index: number;
  canRemove: boolean;
  onChange: (colour: string) => void;
  onRemove: () => void;
}

/**
 * One stop: a swatch that opens a small grid, and a corner control to drop it.
 */
const StopPicker = ({
  colour,
  index,
  canRemove,
  onChange,
  onRemove,
}: IStopPickerProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Anywhere else closes it. Pointer-down rather than click, so the grid is
  // gone by the time whatever was pressed reacts.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const close = () => setIsOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [isOpen]);

  return (
    <span
      className="look-designer__swatch"
      // The listener above is on the window, so a press inside must not reach
      // it or the grid would close on the way to the colour being chosen.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="look-designer__swatch-face"
        style={{ background: colour }}
        aria-label={t('look.colourValue', { number: index + 1, colour })}
        aria-expanded={isOpen}
        title={colour}
        onClick={() => setIsOpen((open) => !open)}
      />
      {canRemove && (
        <button
          type="button"
          className="look-designer__swatch-drop"
          aria-label={t('look.removeColour', { number: index + 1 })}
          onClick={onRemove}
        >
          ✕
        </button>
      )}
      {isOpen && (
        <div className="look-designer__swatch-grid" role="group">
          {SWATCH_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`look-designer__swatch-choice${
                choice === colour ? ' is-on' : ''
              }`}
              style={{ background: choice }}
              aria-label={choice}
              title={choice}
              onClick={() => {
                onChange(choice);
                setIsOpen(false);
              }}
            />
          ))}
          <label
            className="look-designer__swatch-custom"
            htmlFor={`look-designer-custom-${index}`}
            title={t('look.customColour')}
          >
            {t('look.custom')}
            <input
              id={`look-designer-custom-${index}`}
              type="color"
              value={colour}
              aria-label={t('look.customColour')}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
        </div>
      )}
    </span>
  );
};

interface ISettingRowProps {
  id: string;
  label: string;
  value: string;
  isDisabled?: boolean;
  hint?: string;
  children: ReactNode;
}

/**
 * A labelled control with its current value written beside the name.
 *
 * The number matters more here than on most sliders: these are milliseconds and
 * counts that somebody may want to reproduce on another form, and a thumb
 * position is not something you can write down.
 */
const SettingRow = ({
  id,
  label,
  value,
  isDisabled = false,
  hint,
  children,
}: ISettingRowProps) => (
  <div
    className={`look-designer__row${isDisabled ? ' is-disabled' : ''}`}
    aria-disabled={isDisabled}
  >
    <label className="look-designer__caption" htmlFor={id}>
      <span>{label}</span>
      <span className="look-designer__value">{value}</span>
    </label>
    {children}
    {hint && <span className="look-designer__hint">{hint}</span>}
  </div>
);

interface ISettingSliderProps {
  id: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  isDisabled?: boolean;
  onChange: (value: number) => void;
}

const SettingSlider = ({
  id,
  min,
  max,
  step = 1,
  value,
  isDisabled = false,
  onChange,
}: ISettingSliderProps) => (
  <input
    id={id}
    className="look-designer__slider"
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    disabled={isDisabled}
    onChange={(event) => onChange(Number(event.target.value))}
  />
);

interface ILookDesignerProps {
  onClose: () => void;
  /**
   * The panel is on its way out and should play its exit before it goes.
   *
   * Owned by the chart rather than by this component, because the thing that
   * has to wait is the unmount, and only the owner can delay that. All this
   * does is put the class on.
   */
  isClosing?: boolean;
}

/**
 * Build a look of your own.
 *
 * The looks that ship are all answers to the same question, and the settings
 * behind them — how many pieces, how fast it chases the music, painted or
 * drawn — are the interesting part. This hands those over without handing over
 * the geometry, so nothing here can produce a figure the engine has not already
 * been tested drawing.
 *
 * There is no preview pane, deliberately. The chart behind this panel is
 * already drawing the same audio at the size it will actually be seen at, so
 * the draft goes straight to it and the panel simply gets out of the way at the
 * edge. A thumbnail would be a second analyser, a second animation loop and a
 * smaller, less honest picture.
 */
const LookDesigner = ({ onClose, isClosing = false }: ILookDesignerProps) => {
  const { t } = useTranslation();
  // Where this panel started, worked out once.
  //
  // Opening it on a look the user made edits that look; opening it on one of
  // the built-ins starts a new one from that form's own settings. Both are the
  // obvious reading of "customise this", and which one applies is fixed at
  // mount — recomputing it would turn the first edit into a different mode.
  const [origin] = useState(() => {
    const id = getGraphLookId();
    const existing = getCustomLook(id);
    const isEditing = Boolean(existing);
    // Anything left half-built comes back first — a reload or a crash in the
    // middle of mixing a ramp should not cost the ramp. Only a look that is not
    // already saved: once it is in the list, the list is the truth.
    const resumed = existing ? null : readLookDraft();
    // A new look starts from what is on the graph, not from the form's own
    // defaults. Those differ the moment anything has been tuned — the border,
    // the glow, a colour ramp — and starting from the defaults meant opening
    // the panel changed the drawing before a single control had been touched.
    // Every one of these settings belongs to the look, so the look is what the
    // draft is taken from.
    const current = getResolvedLook();
    const look = existing ??
      resumed ?? {
        ...createDraftLook(current.style, current.palette),
        tuning: { ...current.tuning },
        colours: [...current.colours],
      };
    return {
      // Always something to edit.
      //
      // Two of the palettes store no colours at all, because empty means "the
      // ones already on screen" — right for a look that ships, useless for a
      // colour picker, which would have nothing to show. So the panel fills
      // them in from what is currently drawn: the swatches open on the exact
      // colours already on the graph, and seeing them is not a change to them.
      look: look.colours.length
        ? look
        : { ...look, colours: seedPaletteColours(look.palette) },
      isEditing,
    };
  });
  const [draft, setDraft] = useState<ICustomLook>(origin.look);
  const [importError, setImportError] = useState('');

  // Follow the picker.
  //
  // Changing the look in the header while this is open re-forms the draft on
  // whatever was chosen, so the arrows, the search and Space are how you walk
  // the forms while building one. Only the form moves: the palette and the
  // colours are this panel's business, and losing a ramp somebody had just
  // mixed because they stepped to the next shape would be the opposite of
  // helpful. The tuning does go, because it belongs to the geometry — see
  // `rebaseDraftLook`.
  const selectedLookId = useSelectedLookId();
  useEffect(() => {
    const custom = getCustomLook(selectedLookId);
    const style = custom ? custom.style : getGraphLook(selectedLookId).style;
    setDraft((current) => rebaseDraftLook(current, style));
  }, [selectedLookId]);

  // Straight onto the real chart, every keystroke of it — and into storage with
  // it, so the work survives a reload. Only for a look that is not saved yet:
  // editing one that is already in the list has somewhere better to be kept.
  useEffect(() => {
    setLookDraft(draft);
    if (!origin.isEditing) {
      writeLookDraft(draft);
    }
  }, [draft, origin.isEditing]);

  // Closing without saving puts the selection back. Registered separately from
  // the push above so it runs once, at unmount, rather than between every pair
  // of drafts.
  useEffect(() => () => setLookDraft(null), []);

  const tune = useCallback((patch: Partial<ILookTuning>) => {
    setDraft((current) => ({
      ...current,
      tuning: { ...current.tuning, ...patch },
    }));
  }, []);

  const setColourAt = useCallback((index: number, colour: string) => {
    setDraft((current) => {
      const colours = current.colours.slice();
      colours[index] = colour;
      return { ...current, colours };
    });
  }, []);

  const removeColourAt = useCallback((index: number) => {
    setDraft((current) => ({
      ...current,
      colours: current.colours.filter((_colour, at) => at !== index),
    }));
  }, []);

  /** Repeats the last colour, so a new stop starts where the ramp ended. */
  const addColour = useCallback(() => {
    setDraft((current) => ({
      ...current,
      colours: [
        ...current.colours,
        current.colours[current.colours.length - 1] ?? DEFAULT_SIGNAL_COLOUR,
      ],
    }));
  }, []);

  // Whether the mode the glow belongs to is actually running.
  //
  // Still the root class, the same single source of truth the drawing uses,
  // rather than the euphoria store — which would need the rhythm streak passed
  // in to answer, and this panel has no business knowing about that. Observed
  // rather than read during render, though: switching the mode while the panel
  // was open changed nothing here, because a DOM read is not something React
  // re-runs, so these settings sat enabled over a mode that was off and
  // disabled under one that was on.
  const isEuphoric = useIsRootEuphoric();

  const { tuning, style } = draft;
  const isDiscrete = isDiscreteGraphStyle(style);
  const canAccent = hasGraphAccent(style);
  const fallbackName = t(`graph.styleName.${style}` as TranslationKey);
  const isFull = !origin.isEditing && isCustomLookListFull();
  const paletteHintKey = PALETTE_CHOICES.find(
    (choice) => choice.value === draft.palette,
  )?.hint;
  const paletteHint = paletteHintKey ? t(paletteHintKey) : '';

  /**
   * The ramp as a CSS gradient, running the way the graph will run it.
   *
   * A single colour is not a gradient and CSS will not accept one stop, so it
   * is repeated — which paints the flat colour the figure will actually be.
   */
  const rampPreview = useMemo(() => {
    if (!draft.colours.length) {
      return 'none';
    }
    const stops =
      draft.colours.length === 1
        ? [draft.colours[0], draft.colours[0]]
        : draft.colours;
    const direction = draft.palette === 'level' ? 'to top' : 'to right';
    return `linear-gradient(${direction}, ${stops.join(', ')})`;
  }, [draft.colours, draft.palette]);

  const handleSave = () => {
    // A blank name is not an error — the placeholder has been showing what it
    // will be called all along, so saving simply takes that.
    const look: ICustomLook = {
      ...draft,
      name: normalizeLookName(draft.name) || fallbackName,
    };
    saveCustomLook(look);
    setGraphLook(look.id);
    // It is in the list now, and the list is the truth. Left behind, the
    // half-built copy would come back over the top of it on the next new look.
    clearLookDraft();
    onClose();
  };

  const handleDelete = () => {
    deleteCustomLook(draft.id);
    clearLookDraft();
    onClose();
  };

  /**
   * The look as a file, through a blob and a link click.
   *
   * Not through the main process. Every other file this app opens is one it has
   * to find for itself — a preset directory, an impulse response, the APO
   * config — and needs a native dialog to do it. This is the browser's own
   * download of a few hundred bytes the renderer already has in hand, and
   * routing it through IPC would add a channel, a handler and a round trip to
   * something the platform does in three lines.
   */
  const handleExport = () => {
    const look: ICustomLook = {
      ...draft,
      name: normalizeLookName(draft.name) || fallbackName,
    };
    const url = URL.createObjectURL(
      new Blob([serializeLookFile([look])], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = toLookFileName(look.name);
    link.click();
    // The blob is held alive by the URL until it is let go, and a session of
    // exporting would keep every one of them.
    URL.revokeObjectURL(url);
  };

  const handleImport = (file: File | undefined) => {
    if (!file) {
      return;
    }
    file
      .text()
      .then((text) => parseLookFile(text))
      .then((looks) => {
        if (!looks.length) {
          // Says nothing was found rather than nothing at all. The likeliest
          // reason is that this is not a look file, and silence reads as a bug.
          setImportError(t('look.error.emptyFile'));
          return false;
        }
        // Same id means the same look, so importing an updated copy replaces
        // it rather than leaving two entries nobody can tell apart.
        looks.forEach(saveCustomLook);
        setGraphLook(looks[0].id);
        clearLookDraft();
        onClose();
        return true;
      })
      .catch(() => setImportError(t('look.error.readFile')));
  };

  return (
    <div
      className={`look-designer${isClosing ? ' is-closing' : ''}`}
      role="dialog"
      aria-label={t(origin.isEditing ? 'look.edit' : 'look.create')}
    >
      <div className="look-designer__header">
        <h2>{t(origin.isEditing ? 'look.edit' : 'look.new')}</h2>
        <button
          type="button"
          className="look-designer__close"
          onClick={onClose}
          aria-label={t('look.close')}
          title={t('look.closeHint')}
        >
          ✕
        </button>
      </div>

      {/* The form is chosen with the picker in the header, not in here.

          There was a second form dropdown in this panel, which meant two
          controls for one decision sitting a few inches apart — and the one in
          the header is the better of the two anyway: it is searchable, it has
          arrows either side, and Space and the click on the plot already walk
          it. So the panel follows it instead. */}
      <p className="look-designer__pick">{t('look.pickForm')}</p>

      <div className="look-designer__body">
        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>{t('look.colourBy')}</span>
          </span>
          <div
            className="look-designer__choice"
            role="group"
            aria-label={t('look.colourBy')}
          >
            {PALETTE_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={`look-designer__pill${
                  draft.palette === choice.value ? ' is-on' : ''
                }`}
                aria-pressed={draft.palette === choice.value}
                title={t(choice.hint)}
                onClick={() =>
                  // The stops belong to the palette and do not survive it — see
                  // `recolourDraftLook` — and the new palette's are filled in
                  // rather than left empty, so there is always a ramp to edit.
                  setDraft((current) => {
                    const next = recolourDraftLook(current, choice.value);
                    return next.colours.length
                      ? next
                      : { ...next, colours: seedPaletteColours(next.palette) };
                  })
                }
              >
                {t(choice.label)}
              </button>
            ))}
          </div>
          <span className="look-designer__hint">{paletteHint}</span>
        </div>

        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>{t('look.colours')}</span>
            <button
              type="button"
              className="look-designer__reset"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  colours: seedPaletteColours(current.palette),
                }))
              }
            >
              {t('look.reset')}
            </button>
          </span>
          <div className="look-designer__swatches">
            {draft.colours.map((colour, index) => (
              <StopPicker
                // Keyed by position, which is what a stop actually is: the list
                // is a ramp read from one end to the other, the same colour may
                // legitimately appear twice, and nothing here ever reorders.
                // Identity IS the index.
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                colour={colour}
                index={index}
                canRemove={draft.colours.length > MIN_LOOK_COLOURS}
                onChange={(next) => setColourAt(index, next)}
                onRemove={() => removeColourAt(index)}
              />
            ))}
            {draft.colours.length < getMaxLookColours(draft.palette) && (
              <button
                type="button"
                className="look-designer__swatch-add"
                aria-label={t('look.addColour')}
                title={t('look.addColourHint')}
                onClick={addColour}
              >
                +
              </button>
            )}
          </div>
          {/* The ramp, drawn the way the graph will run it — up for level,
              across for the others — so the preview answers the same question
              the palette does. */}
          <span
            className="look-designer__ramp"
            style={{ backgroundImage: rampPreview }}
          />
        </div>

        <SettingRow
          id="look-designer-columns"
          label={t('look.pieces')}
          value={isDiscrete ? String(tuning.columns) : '—'}
          isDisabled={!isDiscrete}
          hint={isDiscrete ? undefined : t('look.continuous')}
        >
          <SettingSlider
            id="look-designer-columns"
            min={MIN_GRAPH_COLUMNS}
            max={MAX_GRAPH_COLUMNS}
            value={tuning.columns}
            isDisabled={!isDiscrete}
            onChange={(columns) => tune({ columns })}
          />
        </SettingRow>

        <SettingRow
          id="look-designer-attack"
          label={t('look.attack')}
          value={`${tuning.attackMs} ms`}
        >
          <SettingSlider
            id="look-designer-attack"
            min={MIN_ATTACK_MS}
            max={MAX_ATTACK_MS}
            value={tuning.attackMs}
            onChange={(attackMs) =>
              // Raising the attack past the release would make the figure fall
              // faster than it rises, which reads as broken rather than as a
              // style. The release comes up with it instead of being clamped
              // silently at draw time.
              tune({
                attackMs,
                releaseMs: Math.max(attackMs, tuning.releaseMs),
              })
            }
          />
        </SettingRow>

        <SettingRow
          id="look-designer-release"
          label={t('look.release')}
          value={`${tuning.releaseMs} ms`}
          hint={t('look.releaseHint')}
        >
          <SettingSlider
            id="look-designer-release"
            // Never faster than the attack: a meter that drops quicker than it
            // climbs loses the peak before the eye it attracted gets there.
            min={Math.max(MIN_RELEASE_MS, tuning.attackMs)}
            max={MAX_RELEASE_MS}
            value={tuning.releaseMs}
            onChange={(releaseMs) => tune({ releaseMs })}
          />
        </SettingRow>

        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>{t('look.drawnAs')}</span>
          </span>
          <div
            className="look-designer__choice"
            role="group"
            aria-label={t('look.drawnAs')}
          >
            <button
              type="button"
              className={`look-designer__pill${tuning.filled ? ' is-on' : ''}`}
              aria-pressed={tuning.filled}
              onClick={() => tune({ filled: true })}
            >
              {t('look.filled')}
            </button>
            <button
              type="button"
              className={`look-designer__pill${!tuning.filled ? ' is-on' : ''}`}
              aria-pressed={!tuning.filled}
              onClick={() => tune({ filled: false })}
            >
              {t('look.stroked')}
            </button>
          </div>
        </div>

        {/* One control, because only one of the two ever applies: a painted
            figure has no stroke to widen and a stroked one has nothing to set
            the opacity of. Showing both would leave a dead slider on screen
            whichever way the choice above went. */}
        {tuning.filled ? (
          <SettingRow
            id="look-designer-fill"
            label={t('look.fill')}
            value={`${Math.round(tuning.fillOpacity * 100)}%`}
          >
            <SettingSlider
              id="look-designer-fill"
              min={MIN_FILL_OPACITY}
              max={MAX_FILL_OPACITY}
              step={0.05}
              value={tuning.fillOpacity}
              onChange={(fillOpacity) => tune({ fillOpacity })}
            />
          </SettingRow>
        ) : (
          <SettingRow
            id="look-designer-width"
            label={t('look.weight')}
            value={`${tuning.strokeWidth} px`}
          >
            <SettingSlider
              id="look-designer-width"
              min={MIN_STROKE_WIDTH}
              max={MAX_STROKE_WIDTH}
              value={tuning.strokeWidth}
              onChange={(strokeWidth) => tune({ strokeWidth })}
            />
          </SettingRow>
        )}

        {/* What the mode does to this look, gathered under its own heading.

            These three do nothing at all outside euphoria, and scattered among
            the settings that always apply they read as broken rather than as
            conditional. Under a heading in the mode's own colour they read as
            what they are: a section that belongs to something else.

            Greyed rather than hidden when the mode is off, because a control
            that vanishes takes its explanation with it — "why is there no glow
            setting" is a worse question than "why is this one disabled", and
            the second answers itself in the hint underneath. */}
        <p className="look-designer__group">{t('look.rainbow')}</p>

        <SettingRow
          id="look-designer-glow"
          label={t('look.glow')}
          value={
            tuning.glow > 0
              ? `${Math.round(tuning.glow * 100)}%`
              : t('look.off')
          }
          isDisabled={!isEuphoric}
          hint={isEuphoric ? t('look.glowHint') : t('look.glowNeedsRainbow')}
        >
          <SettingSlider
            id="look-designer-glow"
            min={MIN_GLOW}
            max={MAX_GLOW}
            step={0.05}
            value={tuning.glow}
            isDisabled={!isEuphoric}
            onChange={(glow) => tune({ glow })}
          />
        </SettingRow>

        <div
          className={`look-designer__row look-designer__row--switch${
            isEuphoric ? '' : ' is-disabled'
          }`}
        >
          <label
            className="look-designer__caption"
            htmlFor="look-designer-border"
          >
            <span>{t('look.rainbowBorder')}</span>
            <input
              id="look-designer-border"
              type="checkbox"
              className="look-designer__check"
              checked={tuning.border}
              disabled={!isEuphoric}
              onChange={(event) => tune({ border: event.target.checked })}
            />
          </label>
          <span className="look-designer__hint">
            {isEuphoric ? t('look.rainbowBorderHint') : t('look.needsRainbow')}
          </span>
        </div>

        <SettingRow
          id="look-designer-border-width"
          label={t('look.borderWeight')}
          value={`${tuning.borderWidth} px`}
          isDisabled={!isEuphoric || !tuning.border}
        >
          <SettingSlider
            id="look-designer-border-width"
            min={MIN_BORDER_WIDTH}
            max={MAX_BORDER_WIDTH}
            value={tuning.borderWidth}
            isDisabled={!isEuphoric || !tuning.border}
            onChange={(borderWidth) => tune({ borderWidth })}
          />
        </SettingRow>

        <div
          className={`look-designer__row look-designer__row--switch${
            canAccent ? '' : ' is-disabled'
          }`}
        >
          {/* The control sits inside its own label, so the caption is part of
              the hit target rather than a word next to one. */}
          <label
            className="look-designer__caption"
            htmlFor="look-designer-accents"
          >
            <span>{t('look.litPeaks')}</span>
            <input
              id="look-designer-accents"
              type="checkbox"
              className="look-designer__check"
              checked={canAccent && tuning.accents}
              disabled={!canAccent}
              onChange={(event) => tune({ accents: event.target.checked })}
            />
          </label>
          {!canAccent && (
            <span className="look-designer__hint">{t('look.noLitPeaks')}</span>
          )}
        </div>

        {/* The label is the row, so the field it names is inside it. */}
        <label className="look-designer__row" htmlFor="look-designer-name">
          <span className="look-designer__caption">
            <span>{t('look.name')}</span>
          </span>
          <input
            id="look-designer-name"
            className="look-designer__name"
            type="text"
            value={draft.name}
            maxLength={MAX_LOOK_NAME_LENGTH}
            placeholder={fallbackName}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
      </div>

      {importError && (
        <p className="look-designer__error" role="status">
          {importError}
        </p>
      )}

      {/* One row.

          These were two rows of wide buttons, which in a 252px panel is a
          block of furniture at the bottom of a pane that exists to show a
          drawing. Only Save is worth a word — it is the one with a consequence
          — so the rest become squares, each with a title and a label for
          anything that is not reading the picture. */}
      <div className="look-designer__actions">
        <button
          type="button"
          className="look-designer__icon"
          onClick={() => tune(getDefaultTuning(style))}
          aria-label={t('look.resetAll')}
          title={t('look.resetAllHint')}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3" />
          </svg>
        </button>
        <button
          type="button"
          className="look-designer__icon"
          onClick={handleExport}
          aria-label={t('look.export')}
          title={t('look.exportHint')}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M8 10V2M5 5l3-3 3 3M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
          </svg>
        </button>
        <label
          className="look-designer__icon"
          htmlFor="look-designer-import"
          title={t('look.import')}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M8 2v8M5 7l3 3 3-3M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
          </svg>
          <input
            id="look-designer-import"
            type="file"
            accept="application/json,.json"
            aria-label={t('look.import')}
            onChange={(event) => {
              const [file] = Array.from(event.target.files ?? []);
              // Cleared, or choosing the same file twice in a row does nothing
              // the second time: the value has not changed, so no event fires.
              // eslint-disable-next-line no-param-reassign
              event.target.value = '';
              handleImport(file);
            }}
          />
        </label>
        {origin.isEditing && (
          <button
            type="button"
            className="look-designer__icon look-designer__icon--danger"
            onClick={handleDelete}
            aria-label={t('look.delete')}
            title={t('look.delete')}
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.5 9h6l.5-9M6.5 6.5v4M9.5 6.5v4" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="look-designer__button look-designer__button--primary"
          onClick={handleSave}
          disabled={isFull}
          title={isFull ? t('look.full') : t('look.saveHint')}
        >
          {t('look.save')}
        </button>
      </div>
    </div>
  );
};

export default LookDesigner;
