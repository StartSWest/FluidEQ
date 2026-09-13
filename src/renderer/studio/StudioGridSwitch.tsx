/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId } from 'react';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { setStudioGridShown, useStudioGridShown } from './studioPaper';

/**
 * Whether the stage shows the graph's grid, to measure a scene against.
 *
 * Wears the glyph of the graph's own grid button, so the promise is the same
 * in both places. Never disabled: it is a way of looking, and the grid is
 * there the moment a scene plays.
 */
export default function StudioGridSwitch() {
  const { t } = useTranslation();
  const id = useId();
  const isOn = useStudioGridShown();
  return (
    <div className="studio-grid-switch">
      <label className="studio-grid-switch__label" htmlFor={id}>
        <svg
          className="studio-grid-switch__glyph"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" />
        </svg>
        {t('studio.grid.label')}
      </label>
      <Switch
        id={id}
        ariaLabel={t('studio.grid.label')}
        isOn={isOn}
        isDisabled={false}
        handleToggle={() => setStudioGridShown(!isOn)}
      />
      <span className="studio-test__hint studio-grid-switch__hint">
        {t('studio.grid.hint')}
      </span>
    </div>
  );
}
