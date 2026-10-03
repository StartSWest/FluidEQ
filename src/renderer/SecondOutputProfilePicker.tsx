/* FluidEQ — GPL-3.0-or-later */
import type { IAudioDevice } from 'common/constants';
import type { TAudioEngine } from 'common/audioEngine';
import OutputProfileSelect from './OutputProfileSelect';
import OutputEditButton from './OutputEditButton';
import { useTranslation } from './utils/I18nContext';
import { isOutputOff, outputEngineState } from './utils/outputEngineState';

interface IProps {
  device: IAudioDevice;
  engine: TAudioEngine | null;
  presetName: string;
  onChanged(): Promise<void>;
}

const SecondOutputProfilePicker = ({
  device,
  engine,
  presetName,
  onChanged,
}: IProps) => {
  const { t } = useTranslation();
  return (
    <div className="device-profiles__picker">
      <span className="device-profiles__label">{t('extraOutput.profile')}</span>
      <div className="extra-outputs__profileActions">
        <OutputProfileSelect
          device={device}
          presetName={presetName}
          onChanged={onChanged}
        />
        <span className="extra-outputs__separator" aria-hidden="true">
          ·
        </span>
        <OutputEditButton device={device} />
      </div>
      {isOutputOff(outputEngineState(device, engine)) && (
        <span className="apo-badge">{t('output.off')}</span>
      )}
    </div>
  );
};
export default SecondOutputProfilePicker;
