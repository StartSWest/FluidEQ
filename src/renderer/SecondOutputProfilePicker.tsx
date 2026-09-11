/* FluidEQ — GPL-3.0-or-later */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTOMATIC_PRESET_PREFIX, type IAudioDevice } from 'common/constants';
import type { TAudioEngine } from 'common/audioEngine';
import Dropdown from './widgets/Dropdown';
import { useTranslation } from './utils/I18nContext';
import { assignDeviceProfile } from './utils/equalizerApi';
import { reportError } from './utils/logger';
import { isOutputOff, outputEngineState } from './utils/outputEngineState';

interface IProps {
  device: IAudioDevice;
  /** Which engine's endpoint answer the badge below is allowed to read. */
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
  const [catalogue, setCatalogue] = useState({
    current: presetName,
    names: [] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const saving = useRef(false);
  const refresh = useCallback(async () => {
    generation.current += 1;
    const request = generation.current;
    try {
      const next = await window.electron.ipcRenderer.getOutputMirrorProfiles(
        device.id,
      );
      if (generation.current === request) {
        setCatalogue(next);
        setLoaded(true);
        setError('');
      }
    } catch (failure) {
      reportError('Could not read second output profiles', failure);
      if (generation.current === request) {
        setError(t('extraOutput.profile.error'));
      }
    }
  }, [device.id, t]);
  useEffect(() => {
    refresh();
    window.addEventListener('fluideq-presets-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      generation.current += 1;
      window.removeEventListener('fluideq-presets-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh, presetName]);
  const select = async (name: string) => {
    if (!name || saving.current || name === catalogue.current) {
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await assignDeviceProfile(
        {
          deviceId: device.id,
          deviceGuid: device.guid,
          deviceName: device.name,
          presetName: name,
        },
        true,
      );
      await refresh();
      await onChanged();
    } catch (failure) {
      reportError('Could not change second output profile', failure);
      setError(t('extraOutput.profile.error'));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const names = [...new Set([catalogue.current, ...catalogue.names])].filter(
    Boolean,
  );
  const options = names.map((name) => {
    const label = name.startsWith(AUTOMATIC_PRESET_PREFIX)
      ? t('output.mapping.live')
      : name;
    return { value: name, label, display: label };
  });
  // Dropdown falls back to the first option for unknown values. An explicit
  // neutral entry keeps a device with no assignment from claiming a profile.
  if (!catalogue.current) {
    options.unshift({
      value: '',
      label: t('output.mapping.neutral'),
      display: t('output.mapping.neutral'),
    });
  }
  return (
    <div className="device-profiles__picker" aria-busy={busy || !loaded}>
      <span className="device-profiles__label">{t('extraOutput.profile')}</span>
      <Dropdown
        name={`${t('extraOutput.profile')} — ${device.name}`}
        menuClassName="device-profiles-menu"
        options={options}
        value={catalogue.current}
        isDisabled={busy || !loaded || names.length === 0}
        handleChange={select}
      />
      {/* The engine in use decides which answer counts, and an output
          Windows runs no effects on is off under both — see
          `outputEngineState`. */}
      {isOutputOff(outputEngineState(device, engine)) && (
        <span className="apo-badge">{t('output.off')}</span>
      )}
      {error && (
        <span className="extra-outputs__obstacle" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
export default SecondOutputProfilePicker;
