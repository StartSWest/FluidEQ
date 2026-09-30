/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useState } from 'react';
import type { IStartWithWindows } from 'main/startWithWindows';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import MenuPreferenceIcon from './MenuPreferenceIcon';

const bridge = () => window.electron?.ipcRenderer;

// Windows only. Electron reports Windows' own Startup apps switch on Windows
// alone, so on a Mac the row was labelled Start with Windows and, once turned
// on, said Windows had it switched off; Linux has no login items in Electron
// at all. A Mac's "Open at login" would be a row of its own, with its own
// words.
const onWindows = () => window.electron?.platform === 'win32';

// The last answer from main, kept while the menu is closed, so reopening it
// shows the state straight away rather than a frame of "off".
let known: IStartWithWindows | undefined;

/**
 * Whether Windows starts FluidEQ at sign-in, under the animations row in the
 * tools menu's settings tray.
 *
 * It asks for no administrator and never will: the entry is this person's
 * own, in their own startup list, and that is the only startup FluidEQ has
 * any business writing. The two things that can go wrong say so under the
 * switch instead of being swallowed — Windows' own Startup apps switch, which
 * overrules the entry and which the app may not touch, and a write Windows
 * refused.
 */
const StartupPicker = () => {
  const { t } = useTranslation();
  const switchId = useId();
  const [state, setState] = useState<IStartWithWindows | undefined>(
    () => known,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!onWindows()) {
      return undefined;
    }
    let current = true;
    bridge()
      ?.startWithWindows?.()
      .then((next) => {
        known = next;
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

  // A window whose bridge predates this row has no answer to show, and a
  // switch that cannot be read is worse than no row at all.
  if (!state || !onWindows()) {
    return null;
  }

  const choose = (wanted: boolean) => {
    setBusy(true);
    bridge()
      ?.setStartWithWindows?.(wanted)
      .then((saved) => {
        known = saved;
        setState(saved);
        return undefined;
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const note = (() => {
    if (state.failed) {
      return t('startup.failed');
    }
    return state.blockedByWindows ? t('startup.blocked') : undefined;
  })();

  return (
    <div className="menu-preference">
      <MenuPreferenceIcon name="startup" />
      <label htmlFor={switchId} className="menu-preference__label">
        {t('startup.label')}
      </label>
      <span className="menu-preference__switch">
        <Switch
          id={switchId}
          isOn={state.on}
          isDisabled={busy}
          handleToggle={() => choose(!state.on)}
          ariaLabel={t('startup.label')}
        />
      </span>
      {note && (
        <span className="menu-preference__note" role="status">
          {note}
        </span>
      )}
    </div>
  );
};

export default StartupPicker;
