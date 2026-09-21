/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useId, useState } from 'react';
import type { IMotionPreferenceState } from 'main/ipc/motionPreference';
import type { TMotionPreference } from 'main/motionPreference';
import { prefersReducedMotion } from '../utils/bandReveal';
import { useTranslation } from '../utils/I18nContext';
import { applyMotionPreference } from '../utils/motionPreference';
import Switch from '../widgets/Switch';

const bridge = () => window.electron?.ipcRenderer;

// The last answer from main, kept while the menu is closed so reopening it
// shows a choice made earlier in this session straight away.
let known: IMotionPreferenceState | undefined;

/**
 * Before main has answered: what this window runs is exactly what it was
 * launched with, since the launch switch is what `prefers-reduced-motion`
 * reports — so the row is complete from the menu's first frame instead of
 * appearing a frame after it.
 */
const running = (): IMotionPreferenceState => {
  const motion: TMotionPreference = prefersReducedMotion() ? 'reduced' : 'full';
  return { chosen: motion, atLaunch: motion };
};

/**
 * Whether the app animates, in the actions menu's settings tray beside the
 * theme and the language: the app's own choice rather than Windows'
 * "Animation effects", which turned every motion here off for everybody who
 * had switched it off for a faster desktop (`main/motionPreference.ts`). Off
 * is reduced motion, there for the people motion troubles.
 *
 * A switch, because it is one yes-or-no: it was a select whose list held the
 * two sentences "Animations on" and "Reduced motion".
 *
 * It takes effect from the next start — it is how the window is launched —
 * and says so while the choice and the running window disagree.
 */
const MotionPicker = () => {
  const { t } = useTranslation();
  const switchId = useId();
  const [state, setState] = useState<IMotionPreferenceState>(
    () => known ?? running(),
  );

  useEffect(() => {
    let current = true;
    bridge()
      ?.motionPreference?.()
      .then((next) => {
        known = next;
        applyMotionPreference(next.chosen);
        if (current) {
          setState(next);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  const choose = (next: TMotionPreference) => {
    bridge()
      ?.setMotionPreference?.(next)
      .then((saved) => {
        known = saved;
        applyMotionPreference(saved.chosen);
        setState(saved);
        return undefined;
      })
      .catch(() => undefined);
  };

  return (
    <div className="menu-preference">
      <label htmlFor={switchId} className="menu-preference__label">
        {t('motion.aria')}
      </label>
      <span className="menu-preference__switch">
        <Switch
          id={switchId}
          isOn={state.chosen === 'full'}
          isDisabled={false}
          handleToggle={() =>
            choose(state.chosen === 'full' ? 'reduced' : 'full')
          }
          ariaLabel={t('motion.aria')}
        />
      </span>
      {state.chosen === 'full' && state.atLaunch === 'reduced' && (
        <span className="menu-preference__note" role="status">
          {t('motion.restart')}
        </span>
      )}
    </div>
  );
};

export default MotionPicker;
