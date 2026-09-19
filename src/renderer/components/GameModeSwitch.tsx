/* FluidEQ — GPL-3.0-or-later */

import { useId } from 'react';
import { engineSupportsGameMode } from '../../common/engineHealth';
import { setGameMode, useDspSettings } from '../dsp/store';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import '../styles/GameModeSwitch.scss';

const GameModeSwitch = ({
  installedVersion,
  reportedGameMode,
}: {
  installedVersion?: string;
  reportedGameMode?: boolean;
}) => {
  const supported = engineSupportsGameMode(installedVersion, reportedGameMode);
  const id = useId();
  const { gameMode } = useDspSettings();
  const { isEnabled, isBlockingError } = useFluidEqContext();
  const { t } = useTranslation();
  return (
    <div
      className={`game-mode-switch${gameMode && supported ? ' is-on' : ''}`}
      title={t(supported ? 'dsp.gameMode.hint' : 'dsp.gameMode.update')}
    >
      <label htmlFor={id} className="game-mode-switch__label">
        <VoicingIcon profileId="games" className="game-mode-switch__icon" />
        {t('dsp.latency.gameMode')}
      </label>
      <Switch
        id={id}
        isOn={gameMode && supported}
        isDisabled={!supported || !isEnabled || isBlockingError}
        handleToggle={() => setGameMode(!gameMode)}
        ariaLabel={t('dsp.latency.gameMode')}
      />
    </div>
  );
};

export default GameModeSwitch;
