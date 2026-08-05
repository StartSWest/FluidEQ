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

import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  GRAPH_STYLES,
  GRAPH_STYLE_LABELS,
  GraphPalette,
  GraphStyle,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  getGraphLook,
  hasGraphAccent,
  isDiscreteGraphStyle,
} from 'common/graphStyles';
import {
  ICustomLook,
  ILookTuning,
  MAX_ATTACK_MS,
  MAX_FILL_OPACITY,
  MAX_LOOK_NAME_LENGTH,
  MAX_RELEASE_MS,
  MAX_STROKE_WIDTH,
  MIN_ATTACK_MS,
  MIN_FILL_OPACITY,
  MIN_RELEASE_MS,
  MIN_STROKE_WIDTH,
  createDraftLook,
  getDefaultTuning,
  normalizeLookName,
  rebaseDraftLook,
} from 'common/customLooks';
import {
  deleteCustomLook,
  getCustomLook,
  isCustomLookListFull,
  saveCustomLook,
} from '../utils/customLooks';
import {
  getGraphLookId,
  setGraphLook,
  setLookDraft,
} from '../utils/graphStyle';
import Dropdown from '../widgets/Dropdown';
import '../styles/LookDesigner.scss';

/**
 * Every form, as dropdown entries.
 *
 * Only the forms — not the looks the picker offers, which are the forms times
 * the palettes. The palette is a setting in this panel rather than half of the
 * identity of the thing being chosen, so offering "Bars" and "Bars · rainbow"
 * as separate bases would put the same control in two places and let them
 * disagree.
 */
const formOptions = GRAPH_STYLES.map((style) => ({
  value: style,
  label: GRAPH_STYLE_LABELS[style],
  display: (
    <span className="look-designer__form">{GRAPH_STYLE_LABELS[style]}</span>
  ),
}));

/**
 * Written out rather than taken from `GRAPH_PALETTE_LABELS`.
 *
 * That table names looks in the picker, where the signal palette is the
 * unmarked case and so has an empty label — "Bars" rather than "Bars · signal".
 * Here the two are side by side as a choice, and a choice with an unnamed half
 * is not one.
 */
const PALETTE_CHOICES: { value: GraphPalette; label: string; hint: string }[] =
  [
    {
      value: 'signal',
      label: 'Signal',
      hint: 'One colour for the whole figure',
    },
    {
      value: 'rainbow',
      label: 'Rainbow',
      hint: 'Colour says where in the range it sits',
    },
  ];

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
    if (existing) {
      return { look: existing, isEditing: true };
    }
    const base = getGraphLook(id);
    return {
      look: createDraftLook(base.style, base.palette),
      isEditing: false,
    };
  });
  const [draft, setDraft] = useState<ICustomLook>(origin.look);

  // Straight onto the real chart, every keystroke of it.
  useEffect(() => {
    setLookDraft(draft);
  }, [draft]);

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

  const { tuning, style } = draft;
  const isDiscrete = isDiscreteGraphStyle(style);
  const canAccent = hasGraphAccent(style);
  const fallbackName = GRAPH_STYLE_LABELS[style];
  const isFull = !origin.isEditing && isCustomLookListFull();

  const handleSave = () => {
    // A blank name is not an error — the placeholder has been showing what it
    // will be called all along, so saving simply takes that.
    const look: ICustomLook = {
      ...draft,
      name: normalizeLookName(draft.name) || fallbackName,
    };
    saveCustomLook(look);
    setGraphLook(look.id);
    onClose();
  };

  const handleDelete = () => {
    deleteCustomLook(draft.id);
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

      {/* Outside the scrolling body, and the only thing here that is.

          Its menu is a floating list of thirty-six, positioned absolutely from
          the trigger — inside a pane that scrolls it would be clipped at the
          pane's edge and scroll away from the control it belongs to. Out here
          it escapes the panel and is bounded by the graph card, exactly like
          the look picker in the legend above. */}
      <div className="look-designer__pick">
        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>Form</span>
          </span>
          <Dropdown
            name="look-designer-form"
            options={formOptions}
            value={style}
            isDisabled={false}
            isFilterable
            filterPlaceholder="Search forms"
            placement="down"
            handleChange={(next) =>
              // A different form is different geometry, so its own settings
              // come with it — see `rebaseDraftLook`.
              setDraft((current) =>
                rebaseDraftLook(current, next as GraphStyle),
              )
            }
          />
        </div>
      </div>

      <div className="look-designer__body">
        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>Colour</span>
          </span>
          <div
            className="look-designer__choice"
            role="group"
            aria-label="Colour"
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
                  setDraft((current) => ({
                    ...current,
                    palette: choice.value,
                  }))
                }
              >
                {choice.label}
              </button>
            ))}
          </div>
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
