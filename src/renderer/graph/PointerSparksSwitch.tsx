/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import { useTranslation } from '../utils/I18nContext';
import {
  setPointerSparks,
  usePointerSparks,
} from '../utils/pointerSparksStore';
import Switch from '../widgets/Switch';

/**
 * The visualizer's sparks at the pointer, on or off (`pointerSparksStore.ts`):
 * a row of the Window colours menu's own grid under Rainbow mode, drawn as
 * that switch is, so the four read as one set.
 */
const PointerSparksSwitch = () => {
  const { t } = useTranslation();
  const id = useId();
  const isOn = usePointerSparks();
  const name = t('graph.sceneTint.sparks');
  return (
    <div
      className="graph-view-menu__slider graph-view-menu__slider--switch"
      title={t('graph.sceneTint.sparksHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <path d="M7 2.4c.5 2.8 1.2 3.5 4 4-2.8.5-3.5 1.2-4 4-.5-2.8-1.2-3.5-4-4 2.8-.5 3.5-1.2 4-4z" />
        <path d="M12.3 10.2l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z" />
      </svg>
      <label htmlFor={id}>{name}</label>
      <span className="graph-view-menu__switch">
        <Switch
          id={id}
          isOn={isOn}
          isDisabled={false}
          handleToggle={() => setPointerSparks(!isOn)}
          ariaLabel={name}
        />
      </span>
    </div>
  );
};

export default PointerSparksSwitch;
