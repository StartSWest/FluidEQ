/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import useEqualizerPower from '../utils/useEqualizerPower';
import Switch from '../widgets/Switch';

interface ISideBarEngineProps {
  /**
   * Whether the engine is set up to process the output being listened to
   * (`engineOnOutput`). Undefined while the window cannot tell, which reads
   * as working: no evidence of a fault is not a fault.
   */
  isEngineOnOutput: boolean | undefined;
  /**
   * Put the engine's own card back up — the one that says what is wrong on
   * this output and carries the repair for it. Pressing the switch on while
   * it reads off for the engine's sake asks again rather than installing
   * anything: the card is where every repair is offered, and every one of
   * them costs a Windows prompt nobody has asked for yet.
   */
  onAskAboutEngine: () => void;
}

/**
 * The side bar's engine card: FluidEQ's own power, and whether it is reaching
 * the sound at all.
 *
 * The switch followed the stored preference and nothing else, so an output
 * Windows has never once loaded the engine on — a Bluetooth headset, on this
 * machine — showed the same lit switch as one being processed. It now reads
 * off whenever the window knows the engine is not on the output being
 * listened to, and cannot be pressed there: the press would have turned
 * FluidEQ's own power off behind a switch that already read off, which is the
 * one thing worse than the switch lying.
 */
const SideBarEngine = ({
  isEngineOnOutput,
  onAskAboutEngine,
}: ISideBarEngineProps) => {
  const { t } = useTranslation();
  const { isBlockingError, isEnabled, toggle } = useEqualizerPower();
  const isBroken = isEngineOnOutput === false;

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

  return (
    <div className="col center side-bar__control-card side-bar__engine">
      <span className="control-kicker">{t('sidebar.engine')}</span>
      <h4>{t('sidebar.systemEq')}</h4>
      <Switch
        id="equalizerEnabler"
        isOn={isEnabled && !isBroken}
        ariaLabel={t('sidebar.systemEq')}
        handleToggle={press}
        isDisabled={isBlockingError}
      />
    </div>
  );
};

export default SideBarEngine;
