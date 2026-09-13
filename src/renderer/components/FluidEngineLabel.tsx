import { useFluidEqContext } from '../utils/FluidEqContext';
import { useAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { useTranslation } from '../utils/I18nContext';

export default function FluidEngineLabel() {
  const { status } = useAudioEngineStatus();
  const { isEngineUsable } = useFluidEqContext();
  const { t } = useTranslation();
  if (status?.engine === 'apo' && status.apo.installed && isEngineUsable) {
    return (
      <p className="eq-engine-label eq-engine-label--apo">
        {t('eq.apoEngine')}
      </p>
    );
  }
  if (
    status?.engine !== 'fluid' ||
    !status.fluid.installed ||
    !isEngineUsable
  ) {
    return null;
  }
  return <p className="eq-engine-label">{t('eq.fluidEngine')}</p>;
}
