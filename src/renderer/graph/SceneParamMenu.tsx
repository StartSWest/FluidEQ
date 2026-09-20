/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { type CSSProperties, type ReactNode, useId } from 'react';
import { resolveParamName, type IScenePackParam } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import {
  clearListenerParams,
  setListenerParam,
  useListenerParams,
  useOwnParams,
} from '../utils/sceneParamStore';

interface ISceneParamMenuProps {
  /** The Plus visualizer on the graph. */
  lookId: string;
}

/** Positions along the track. One per percent of the control's own range. */
const STEPS = 100;

/**
 * How near the visualizer's own value, along the track, the thumb falls onto
 * it - the same reach the timing sliders beside these use. The way back to
 * how the scene was made should not take a steady hand on a short slider, and
 * a value let go there is forgotten rather than kept as a copy.
 */
const OWN_SNAP_REACH = 0.03;

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
    {children}
  </svg>
);

function ParamSlider({
  lookId,
  param,
  chosen,
}: {
  lookId: string;
  param: IScenePackParam;
  chosen: number | undefined;
}) {
  const { t, locale } = useTranslation();
  const id = useId();
  const span = Math.max(param.max - param.min, 1e-6);
  const value = chosen ?? param.value;
  const toPosition = (raw: number) =>
    Math.min(1, Math.max(0, (raw - param.min) / span));
  const ownPosition = toPosition(param.value);
  const readout = t('graph.scene.percent', {
    percent: String(Math.round(toPosition(value) * 100)),
  });
  return (
    <label
      className="graph-view-menu__slider graph-view-menu__slider--timing"
      htmlFor={id}
      title={t('graph.scene.controlHint')}
    >
      {/* A control with a handle on it, not a plus: these are the scene's own
          knobs, and the row beside them reads as "add" otherwise. */}
      <Icon>
        <path d="M2.5 5h11" />
        <path d="M2.5 11h11" />
        <circle cx="6" cy="5" r="1.8" />
        <circle cx="10.5" cy="11" r="1.8" />
      </Icon>
      <span>{resolveParamName(param, locale)}</span>
      <span className="graph-view-menu__track">
        {/* Where the visualizer's own value sits, so the way back is seen. */}
        <i
          className="graph-view-menu__snap graph-view-menu__snap--own"
          style={{ '--snap-frac': ownPosition } as CSSProperties}
          aria-hidden
        />
        <input
          id={id}
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={Math.round(toPosition(value) * STEPS)}
          aria-valuetext={readout}
          onChange={(event) => {
            const position = Number(event.target.value) / STEPS;
            const next =
              Math.abs(position - ownPosition) <= OWN_SNAP_REACH
                ? param.value
                : param.min + position * span;
            setListenerParam(lookId, param.id, next, param.value);
          }}
        />
      </span>
      <span className="graph-view-menu__value">{readout}</span>
    </label>
  );
}

/**
 * The Plus visualizer's own controls, in the View menu: whatever the scene on
 * the graph declares - how many elements it scatters, how much fire it
 * throws - each starting from the value its author gave it, set to anything
 * the listener likes and kept for that visualizer.
 *
 * Nothing is drawn until the scene has loaded, because the controls are the
 * scene's own and it is what says which it has; and nothing is drawn for a
 * scene that declares none, rather than a heading over an empty space.
 */
export default function SceneParamMenu({ lookId }: ISceneParamMenuProps) {
  const { t } = useTranslation();
  const own = useOwnParams(lookId);
  const chosen = useListenerParams(lookId);
  // The same filter the Studio's copy of this list applies, and for the same
  // reason: a scene's AI writes these, so a range with no width is possible.
  // Its slider swept a 0-100% readout while every value it wrote landed back
  // on the one value the author gave — a control that could only sit still.
  const movable = own?.filter((param) => param.max - param.min > 0);
  if (!movable || movable.length === 0) {
    return null;
  }
  return (
    <>
      {movable.map((param) => (
        <ParamSlider
          key={param.id}
          lookId={lookId}
          param={param}
          chosen={chosen?.[param.id]}
        />
      ))}
      <button
        type="button"
        role="menuitem"
        disabled={chosen === undefined}
        title={t('graph.scene.ownControlsHint')}
        onClick={() => clearListenerParams(lookId)}
      >
        <Icon>
          <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
          <path d="M2.2 2.4v3.4h3.4" />
        </Icon>
        <span>{t('graph.scene.ownControls')}</span>
      </button>
    </>
  );
}
