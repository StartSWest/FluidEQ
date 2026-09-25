/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { useCurrentEngine } from '../utils/audioEngineContext';
import useEqualizerPower from '../utils/useEqualizerPower';

interface ISideBarEngineProps {
  /**
   * Whether the engine is set up to process the output being listened to
   * (`engineOnOutput`). Undefined while the window cannot tell, which reads
   * as working: no evidence of a fault is not a fault.
   */
  isEngineOnOutput: boolean | undefined;
  /**
   * Put the engine's own card back up — the one that says what is wrong on
   * this output and carries the repair for it. Pressing the button on while
   * it reads off for the engine's sake asks again rather than installing
   * anything: the card is where every repair is offered, and every one of
   * them costs a Windows prompt nobody has asked for yet.
   */
  onAskAboutEngine: () => void;
}

/**
 * The side bar's power: FluidEQ's own switch, and whether it is reaching the
 * sound at all.
 *
 * A round power button with the engine's name and state written under it,
 * rather than the eyebrow, title and pill switch it was. It is the one master
 * control in the column, and a switch made it read as one setting among the
 * others; the state line is what used to need a separate card to say.
 *
 * The button followed the stored preference and nothing else, so an output
 * Windows has never once loaded the engine on — a Bluetooth headset, on this
 * machine — showed the same lit switch as one being processed. It now reads
 * off whenever the window knows the engine is not on the output being
 * listened to, in red, and a press there asks about the engine rather than
 * turning FluidEQ's own power off behind a button that already read off.
 */
const SideBarEngine = ({
  isEngineOnOutput,
  onAskAboutEngine,
}: ISideBarEngineProps) => {
  const { t } = useTranslation();
  const engine = useCurrentEngine();
  const { isBlockingError, isEnabled, toggle } = useEqualizerPower();
  const isBroken = isEngineOnOutput === false;
  const isOn = isEnabled && !isBroken;

  const press = () => {
    if (!isBroken) {
      toggle().catch(() => undefined);
      return;
    }
    // It reads off because the engine is not reaching this output, not
    // because FluidEQ is switched off — so the press must not flip a
    // preference that is already on. Turning it back on is asking for the
    // engine to be put right, and the card is what asks.
    if (!isEnabled) {
      toggle().catch(() => undefined);
    }
    onAskAboutEngine();
  };

  let state = t('sidebar.state.off');
  let stateClass = ' is-off';
  if (isBroken) {
    state = t('sidebar.state.notOnOutput');
    stateClass = ' is-broken';
  } else if (isEnabled) {
    state = t('sidebar.state.on', {
      engine: t(engine === 'apo' ? 'engine.apo.name' : 'engine.fluid.name'),
    });
    stateClass = '';
  }

  return (
    <div className="side-bar__power">
      <button
        type="button"
        id="equalizerEnabler"
        className={`side-bar__power-button${isOn ? ' is-on' : ''}${
          isBroken ? ' is-broken' : ''
        }`}
        aria-pressed={isOn}
        aria-label={t('sidebar.systemEq')}
        title={state}
        disabled={isBlockingError}
        onClick={press}
      >
        <svg
          className="side-bar__power-glyph"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 3v9" />
          <path d="M6.6 6.6a7.6 7.6 0 1 0 10.8 0" />
        </svg>
      </button>
      <span className="side-bar__power-name">{t('sidebar.systemEq')}</span>
      <span className={`side-bar__power-state${stateClass}`}>{state}</span>
    </div>
  );
};

export default SideBarEngine;
