/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCurrentEngine } from '../utils/audioEngineContext';
import { useTranslation } from '../utils/I18nContext';
import useEqualizerPower from '../utils/useEqualizerPower';
import PlayerIcon from './PlayerIcon';
import useOutputName from './useOutputName';

/**
 * The amp's foot (Ivan, 2026-10-25): the output the sound is going to, and
 * which engine is shaping it, lit while FluidEQ is on. A reading, nothing to
 * press — the switch is the Sound section's.
 */
const PlayerFoot = () => {
  const { t } = useTranslation();
  const outputName = useOutputName();
  const engine = useCurrentEngine();
  const power = useEqualizerPower();
  const engineName = t(
    engine === 'apo' ? 'engine.apo.name' : 'engine.fluid.name',
  );

  return (
    <footer className="player-foot">
      <span className="player-foot__output" title={outputName}>
        <PlayerIcon name="headphones" />
        <span className="player-foot__words">{outputName ?? ''}</span>
      </span>
      <span className={`player-foot__engine${power.isEnabled ? ' is-on' : ''}`}>
        <span className="player-foot__lamp" aria-hidden="true" />
        <span className="player-foot__words">
          {power.isEnabled
            ? t('player.foot.on', { engine: engineName })
            : t('player.foot.off', { engine: engineName })}
        </span>
      </span>
    </footer>
  );
};

export default PlayerFoot;
