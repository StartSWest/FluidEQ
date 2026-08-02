/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023> <AQUA Dev Team>
Copyright (C) <2026> <AQUA device-profile contributors>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IAudioDevice, IDeviceProfileSettings } from 'common/constants';
import { ErrorDescription } from 'common/errors';
import Button from './widgets/Button';
import { useAquaContext } from './utils/AquaContext';
import {
  assignDeviceProfile,
  activateAudioDeviceProfile,
  getAudioDevices,
  getDeviceProfileSettings,
  getPresetListFromFiles,
  removeDeviceProfile,
} from './utils/equalizerApi';
import './styles/DeviceProfiles.scss';

const EMPTY_SETTINGS: IDeviceProfileSettings = {
  version: 1,
  assignments: {},
};

const DeviceProfiles = () => {
  const { globalError, performHealthCheck, setGlobalError } = useAquaContext();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [settings, setSettings] =
    useState<IDeviceProfileSettings>(EMPTY_SETTINGS);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const activeDeviceIdRef = useRef('');

  const refresh = useCallback(async () => {
    try {
      const [nextDevices, nextPresets, nextSettings] = await Promise.all([
        getAudioDevices(),
        getPresetListFromFiles(),
        getDeviceProfileSettings(),
      ]);
      setDevices(nextDevices);
      setPresets(nextPresets);
      setSettings(nextSettings);
      const activeDevice = nextDevices.find((device) => device.isDefault);
      if (
        activeDevice &&
        activeDevice.id !== activeDeviceIdRef.current
      ) {
        activeDeviceIdRef.current = activeDevice.id;
        setSelectedDeviceId(activeDevice.id);
        await activateAudioDeviceProfile(activeDevice.id);
        performHealthCheck();
      }
      setSelectedDeviceId((current) => {
        if (nextDevices.some((device) => device.id === current)) return current;
        return (
          nextDevices.find((device) => device.isDefault)?.id ||
          nextDevices[0]?.id ||
          ''
        );
      });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [performHealthCheck, setGlobalError]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [devices, selectedDeviceId]
  );
  const assignedPreset = selectedDeviceId
    ? settings.assignments[selectedDeviceId]?.presetName || ''
    : '';

  useEffect(() => {
    setSelectedPreset(assignedPreset);
  }, [assignedPreset, selectedDeviceId]);

  const handleDeviceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeviceId(event.target.value);
  };

  const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedPreset(event.target.value);
  };

  const handleAssign = async () => {
    if (!selectedDevice || !selectedPreset) return;
    setIsBusy(true);
    try {
      await assignDeviceProfile({
        deviceId: selectedDevice.id,
        deviceName: selectedDevice.name,
        deviceGuid: selectedDevice.guid,
        presetName: selectedPreset,
      });
      if (selectedDevice.isDefault) {
        await activateAudioDeviceProfile(selectedDevice.id);
        performHealthCheck();
      }
      await refresh();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedDeviceId) return;
    setIsBusy(true);
    try {
      await removeDeviceProfile(selectedDeviceId);
      if (selectedDevice?.isDefault) {
        await activateAudioDeviceProfile(selectedDeviceId);
        performHealthCheck();
      }
      setSelectedPreset('');
      await refresh();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="device-profiles">
      <div className="device-profiles__heading">
        <div>
          <span className="eyebrow">FOLLOWS YOUR OUTPUT</span>
          <h4>Automatic profile</h4>
        </div>
        {selectedDevice?.isDefault && (
          <span className="default-badge">ACTIVE</span>
        )}
      </div>

      <label htmlFor="audio-device">Output device</label>
      <select
        id="audio-device"
        value={selectedDeviceId}
        onChange={handleDeviceChange}
        disabled={!!globalError || isBusy}
      >
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.isDefault ? '● ' : ''}
            {device.name}
          </option>
        ))}
      </select>

      <label htmlFor="device-preset">Profile for this output</label>
      <select
        id="device-preset"
        value={selectedPreset}
        onChange={handlePresetChange}
        disabled={!!globalError || isBusy || presets.length === 0}
      >
        <option value="">Choose a named profile…</option>
        {presets.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
      </select>

      <div className="device-profiles__actions">
        <Button
          ariaLabel="Assign preset to selected audio device"
          className="small"
          isDisabled={
            !!globalError || isBusy || !selectedDevice || !selectedPreset
          }
          handleChange={handleAssign}
        >
          {assignedPreset ? 'Update mapping' : 'Attach profile'}
        </Button>
        {assignedPreset && (
          <button className="link-button" type="button" onClick={handleRemove}>
            Remove
          </button>
        )}
      </div>
      <p className="device-profiles__hint">
        FluidEQ maps the stable endpoint ID, so this sound follows the device
        whenever Windows selects it.
      </p>
    </section>
  );
};

export default DeviceProfiles;
