/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { type CSSProperties, type ReactNode, useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import { NEUTRAL_RESPONSE, type ISceneResponse } from 'common/sceneResponse';
import { useTranslation } from '../utils/I18nContext';
import {
  RESPONSE_SLIDER_STEPS,
  responseFromPosition,
  responseToPosition,
} from '../utils/responseSlider';
import {
  clearListenerResponse,
  LISTENER_RESPONSE_KEYS,
  setListenerResponse,
  type TListenerResponseKey,
  useListenerResponse,
  useOwnResponse,
} from '../utils/sceneResponseStore';

interface ISceneResponseMenuProps {
  /** The Plus visualizer on the graph. */
  lookId: string;
}

const TEXT: Record<
  TListenerResponseKey,
  { label: TranslationKey; hint: TranslationKey }
> = {
  attack: { label: 'graph.scene.attack', hint: 'graph.scene.attackHint' },
  release: { label: 'graph.scene.release', hint: 'graph.scene.releaseHint' },
};

/**
 * How near the visualizer's own value, along the track, the thumb falls onto
 * it. The way back to how the scene was made to move should not take a
 * steady hand on an 86px slider, and a value let go there is forgotten
 * rather than kept as a copy.
 */
const OWN_SNAP_REACH = 0.03;

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
    {children}
  </svg>
);

const ICONS: Record<TListenerResponseKey, ReactNode> = {
  // A quick rise, then held.
  attack: <path d="M1.5 12.5h3l3.2-9h6.8" />,
  // Held, then a long fall.
  release: <path d="M1.5 3.5h5.5c2.5 0 4.5 9 7.5 9" />,
};

function TimingSlider({
  lookId,
  field,
  own,
  chosen,
}: {
  lookId: string;
  field: TListenerResponseKey;
  own: ISceneResponse | undefined;
  chosen: number | undefined;
}) {
  const { t } = useTranslation();
  const id = useId();
  const ownValue = own?.[field] ?? NEUTRAL_RESPONSE[field];
  const value = chosen ?? ownValue;
  const ownPosition = responseToPosition(field, ownValue);
  const readout = t('graph.scene.ms', { ms: String(value) });
  // Until the scene has loaded its own timing is unknown, and a slider moved
  // before then would be measured against nothing.
  const disabled = own === undefined;
  return (
    <label
      className={`graph-view-menu__slider graph-view-menu__slider--timing${
        disabled ? ' is-disabled' : ''
      }`}
      htmlFor={id}
      title={t(TEXT[field].hint)}
    >
      <Icon>{ICONS[field]}</Icon>
      <span>{t(TEXT[field].label)}</span>
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
          max={RESPONSE_SLIDER_STEPS}
          step={1}
          value={Math.round(
            responseToPosition(field, value) * RESPONSE_SLIDER_STEPS,
          )}
          aria-valuetext={readout}
          disabled={disabled}
          onChange={(event) => {
            const position = Number(event.target.value) / RESPONSE_SLIDER_STEPS;
            const next =
              Math.abs(position - ownPosition) <= OWN_SNAP_REACH
                ? ownValue
                : responseFromPosition(field, position);
            setListenerResponse(lookId, field, next, ownValue);
          }}
        />
      </span>
      <span className="graph-view-menu__value">{readout}</span>
    </label>
  );
}

/**
 * The attack and release of the Plus visualizer on the graph, in the View
 * menu: starting from the timing the visualizer came with, set to anything
 * the listener likes, and kept for that visualizer. Drawn into the menu only
 * while a scene is on the graph; the menu stays open while they are dragged,
 * as its other sliders do, so the picture is the readout.
 */
export default function SceneResponseMenu({ lookId }: ISceneResponseMenuProps) {
  const { t } = useTranslation();
  const own = useOwnResponse(lookId);
  const chosen = useListenerResponse(lookId);
  return (
    <>
      <div className="graph-view-menu__divider" />
      {LISTENER_RESPONSE_KEYS.map((field) => (
        <TimingSlider
          key={field}
          lookId={lookId}
          field={field}
          own={own}
          chosen={chosen?.[field]}
        />
      ))}
      <button
        type="button"
        role="menuitem"
        disabled={chosen === undefined}
        title={t('graph.scene.ownTimingHint')}
        onClick={() => clearListenerResponse(lookId)}
      >
        <Icon>
          <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
          <path d="M2.2 2.4v3.4h3.4" />
        </Icon>
        <span>{t('graph.scene.ownTiming')}</span>
      </button>
    </>
  );
}
