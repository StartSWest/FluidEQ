/* FluidEQ — GPL-3.0-or-later */
import { useCallback, useState } from 'react';
import type { IAudioDevice } from '../../common/constants';
import { getAudioDevices, setDefaultAudioDevice } from '../utils/equalizerApi';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import useOutputReadings from '../utils/useOutputReadings';
import Dropdown from '../widgets/Dropdown';

const RemoteAudioOutput = () => {
  const { t } = useTranslation();
  const { refreshState } = useFluidEqShell();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const show = useCallback(async (reading: Promise<IAudioDevice[]>) => {
    try {
      setDevices(await reading);
      setFailed(false);
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  }, []);
  const refresh = useCallback(() => show(getAudioDevices()), [show]);
  useOutputReadings(refresh, show);
  const choose = async (id: string) => {
    setBusy(true);
    try {
      await setDefaultAudioDevice(id);
      await refresh();
      window.dispatchEvent(
        new CustomEvent('fluideq-output-changed', { detail: { deviceId: id } }),
      );
      await refreshState();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="remote-audio__lane remote-audio__mix-output">
      <span className="control-kicker">{t('remoteAudio.group.output')}</span>
      <Dropdown
        name={t('remoteAudio.group.output')}
        value={devices.find((device) => device.isDefault)?.id ?? ''}
        options={devices.map((device) => ({
          value: device.id,
          label: device.name,
          display: device.name,
        }))}
        isDisabled={busy || devices.length === 0}
        handleChange={(id) => {
          choose(id).catch(() => setFailed(true));
        }}
      />
      {failed && (
        <span role="alert" className="remote-audio__lane-caption">
          {t('remoteAudio.error.playback')}
        </span>
      )}
    </div>
  );
};
export default RemoteAudioOutput;
