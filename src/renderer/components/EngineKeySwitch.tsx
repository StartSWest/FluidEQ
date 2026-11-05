/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import toastColours from '../games/toastColours';
import { useTranslation } from '../utils/I18nContext';
import useEqualizerPower from '../utils/useEqualizerPower';

interface IEngineKeyBridge {
  onEngineKeyPressed?: (listener: () => void) => () => void;
  showGameToast?: (said: {
    what: string;
    game: string;
    icon?: string;
    colors?: Record<string, string>;
  }) => void;
}

/**
 * The power symbol the card wears: lit in the window's accent when FluidEQ is
 * on, an outline in its quiet ink when off, so the state reads before the
 * words do. A picture in the address, the only kind the card takes.
 */
const powerPicture = (isOn: boolean, colours: Record<string, string>) => {
  const accent = colours.accent ?? '#00e5cf';
  const muted = colours.muted ?? '#9aa5b1';
  const ink = colours.base ?? '#03141b';
  const svg = isOn
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${accent}"/><path d="M12 6.5v5.5M16.1 8.6a5.8 5.8 0 1 1-8.2 0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="none" stroke="${muted}" stroke-width="1.5"/><path d="M12 6.5v5.5M16.1 8.6a5.8 5.8 0 1 1-8.2 0" fill="none" stroke="${muted}" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * The on/off key's other half (`main/engineKey.ts` holds the key): a press
 * is the power switch, pressed, and a card on top of whatever is in front
 * says which way it went (Ivan, 2026-11-04: "so when they are on gaming it
 * shows on top and they can tell which state it is"). Nothing else changes.
 *
 * Headless and mounted for the window's whole life, beside the dialogs and
 * not inside a page: the key is pressed while FluidEQ is behind a game.
 */
const EngineKeySwitch = () => {
  const { t } = useTranslation();
  const power = useEqualizerPower();
  // Read at the press, not subscribed with: the listener is made once.
  const latest = useRef({ power, t });
  latest.current = { power, t };
  // One switch at a time: a second press while main is still switching
  // would read the old position and send the same command again.
  const switching = useRef(false);

  useEffect(() => {
    const bridge = window.electron?.ipcRenderer as IEngineKeyBridge | undefined;
    return bridge?.onEngineKeyPressed?.(() => {
      const now = latest.current;
      if (switching.current || now.power.isBlockingError) {
        return;
      }
      switching.current = true;
      now.power
        .toggle()
        .then((isOn) => {
          if (isOn === undefined) {
            return undefined;
          }
          const say = latest.current.t;
          const colours = toastColours();
          bridge.showGameToast?.({
            what: say(isOn ? 'engineKey.toast.on' : 'engineKey.toast.off'),
            game: say(
              isOn ? 'engineKey.toast.onDetail' : 'engineKey.toast.offDetail',
            ),
            icon: powerPicture(isOn, colours),
            colors: colours,
          });
          return undefined;
        })
        .finally(() => {
          switching.current = false;
        });
    });
  }, []);

  return null;
};

export default EngineKeySwitch;
