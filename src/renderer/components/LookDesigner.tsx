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

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  GRAPH_STYLE_LABELS,
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
  normalizeLookName,
  rebaseDraftLook,
  recolourDraftLook,
} from 'common/customLooks';
import { BAND_SPECTRUM_HEX } from '../utils/bandColors';
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
const PALETTE_CHOICES: { value: GraphPalette; label: string; hint: string }[] =
  [
    {
      value: 'signal',
      label: 'Flat',
      hint: 'One colour for the whole figure',
    },
    {
      value: 'rainbow',
      label: 'Frequency',
      hint: 'Colour runs across the axis: it says where in the range a bar sits, and never changes as the music does',
    },
    {
      value: 'level',
      label: 'Level',
      hint: 'Colour runs up the axis: it says how loud a bar is, so it reddens as it grows',
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
const LookDesigner = ({ onClose }: ILookDesignerProps) => {
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
  // Read from the root class, the same single source of truth the drawing uses,
  // rather than from the euphoria store — which would need the rhythm streak
  // passed in to answer, and this panel has no business knowing about that.
  const isEuphoric =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('is-euphoric');

  const { tuning, style } = draft;
  const isDiscrete = isDiscreteGraphStyle(style);
  const canAccent = hasGraphAccent(style);
  const fallbackName = GRAPH_STYLE_LABELS[style];
  const isFull = !origin.isEditing && isCustomLookListFull();
  const paletteHint =
    PALETTE_CHOICES.find((choice) => choice.value === draft.palette)?.hint ??
    '';

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

  return (
    <div
      className="look-designer"
      role="dialog"
      aria-label={origin.isEditing ? 'Edit look' : 'Create look'}
    >
      <div className="look-designer__header">
        <h2>{origin.isEditing ? 'Edit look' : 'New look'}</h2>
        <button
          type="button"
          className="look-designer__close"
          onClick={onClose}
          aria-label="Close the look designer"
          title="Close without saving (Esc)"
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
      <p className="look-designer__pick">
        Pick the form with the picker above, or press Space.
      </p>

      <div className="look-designer__body">
        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>Colour by</span>
          </span>
          <div
            className="look-designer__choice"
            role="group"
            aria-label="Colour by"
          >
            {PALETTE_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={`look-designer__pill${
                  draft.palette === choice.value ? ' is-on' : ''
                }`}
                aria-pressed={draft.palette === choice.value}
                title={choice.hint}
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
                {choice.label}
              </button>
            ))}
          </div>
          <span className="look-designer__hint">{paletteHint}</span>
        </div>

        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>Colours</span>
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
              Reset
            </button>
          </span>
          <div className="look-designer__swatches">
            {draft.colours.map((colour, index) => (
              // Keyed by position, which is what a stop actually is: the
              // list is a ramp read from one end to the other, the same
              // colour may legitimately appear twice, and nothing here ever
              // reorders. Identity IS the index.
              // eslint-disable-next-line react/no-array-index-key
              <span className="look-designer__swatch" key={index}>
                <input
                  type="color"
                  value={colour}
                  aria-label={`Colour ${index + 1}`}
                  onChange={(event) => setColourAt(index, event.target.value)}
                />
                {draft.colours.length > MIN_LOOK_COLOURS && (
                  <button
                    type="button"
                    className="look-designer__swatch-drop"
                    aria-label={`Remove colour ${index + 1}`}
                    onClick={() => removeColourAt(index)}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
            {draft.colours.length < MAX_LOOK_COLOURS && (
              <button
                type="button"
                className="look-designer__swatch-add"
                aria-label="Add a colour"
                title="Add a colour to the end of the ramp"
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
          label="Pieces"
          value={isDiscrete ? String(tuning.columns) : '—'}
          isDisabled={!isDiscrete}
          hint={
            isDiscrete
              ? undefined
              : 'This form is drawn as one continuous figure'
          }
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
          label="Attack"
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
          label="Release"
          value={`${tuning.releaseMs} ms`}
          hint="How long a peak hangs before it falls away"
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
            <span>Drawn as</span>
          </span>
          <div
            className="look-designer__choice"
            role="group"
            aria-label="Drawn as"
          >
            <button
              type="button"
              className={`look-designer__pill${tuning.filled ? ' is-on' : ''}`}
              aria-pressed={tuning.filled}
              onClick={() => tune({ filled: true })}
            >
              Filled
            </button>
            <button
              type="button"
              className={`look-designer__pill${!tuning.filled ? ' is-on' : ''}`}
              aria-pressed={!tuning.filled}
              onClick={() => tune({ filled: false })}
            >
              Stroked
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
            label="Fill"
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
            label="Weight"
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

        {/* Greyed out rather than hidden when the mode is off.

            A control that vanishes takes its explanation with it, and "why is
            there no glow setting" is a worse question than "why is this one
            disabled" — the second answers itself in the hint underneath. */}
        <SettingRow
          id="look-designer-glow"
          label="Glow"
          value={tuning.glow > 0 ? `${Math.round(tuning.glow * 100)}%` : 'Off'}
          isDisabled={!isEuphoric}
          hint={
            isEuphoric
              ? 'How hard the figure swells and brightens on a beat.'
              : 'Needs euphoria mode. The glow is what that mode does to this figure — with it off, nothing here changes the drawing.'
          }
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
            <span>Euphoria border</span>
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
            {isEuphoric
              ? 'Rings the graph in a colour that travels the whole wheel. Decoration rather than a reading — right on a visualiser, noise on a measurement.'
              : 'Needs euphoria mode.'}
          </span>
        </div>

        <SettingRow
          id="look-designer-border-width"
          label="Border weight"
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
            <span>Lit peaks</span>
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
            <span className="look-designer__hint">
              This form has no lit tips to show
            </span>
          )}
        </div>

        {/* The label is the row, so the field it names is inside it. */}
        <label className="look-designer__row" htmlFor="look-designer-name">
          <span className="look-designer__caption">
            <span>Name</span>
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

      <div className="look-designer__actions">
        <button
          type="button"
          className="look-designer__button"
          onClick={() => tune(getDefaultTuning(style))}
          title="Put every setting back to how this form ships"
        >
          Reset
        </button>
        {origin.isEditing && (
          <button
            type="button"
            className="look-designer__button look-designer__button--danger"
            onClick={handleDelete}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className="look-designer__button look-designer__button--primary"
          onClick={handleSave}
          disabled={isFull}
          title={
            isFull
              ? 'The list is full — delete a look to make room'
              : 'Save this look and select it'
          }
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default LookDesigner;
