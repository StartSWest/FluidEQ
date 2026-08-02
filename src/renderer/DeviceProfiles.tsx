/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023> <AQUA Dev Team>
Copyright (C) <2026> <AQUA device-profile contributors>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AUTOMATIC_PRESET_PREFIX,
  IAudioDevice,
  IDeviceProfileSettings,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import Dropdown from './widgets/Dropdown';
import { IOptionEntry } from './widgets/List';
import { useAquaContext } from './utils/AquaContext';
import {
  getAudioDevices,
  getDeviceProfileSettings,
  setDefaultAudioDevice,
} from './utils/equalizerApi';
import './styles/DeviceProfiles.scss';

const EMPTY_SETTINGS: IDeviceProfileSettings = {
  version: 1,
  assignments: {},
};

const DeviceProfiles = () => {
  const { globalError, performHealthCheck, setGlobalError } = useAquaContext();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [settings, setSettings] =
    useState<IDeviceProfileSettings>(EMPTY_SETTINGS);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const activeDeviceIdRef = useRef('');

  const refresh = useCallback(async () => {
    try {
      const [nextDevices, nextSettings] = await Promise.all([
        getAudioDevices(),
        getDeviceProfileSettings(),
      ]);
      setDevices(nextDevices);
      setSettings(nextSettings);
      const activeDevice = nextDevices.find((device) => device.isDefault);
      if (activeDevice && activeDevice.id !== activeDeviceIdRef.current) {
        activeDeviceIdRef.current = activeDevice.id;
        setSelectedDeviceId(activeDevice.id);
        performHealthCheck();
      }
      setSelectedDeviceId((current) => {
        if (nextDevices.some((device) => device.id === current)) {
          return current;
        }
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
    [devices, selectedDeviceId],
  );
  const assignedPreset = selectedDeviceId
    ? settings.assignments[selectedDeviceId]?.presetName || ''
    : '';
  const isAutomaticProfile = assignedPreset.startsWith(AUTOMATIC_PRESET_PREFIX);
  let mappingLabel = 'Neutral output';
  if (assignedPreset) {
    mappingLabel = isAutomaticProfile ? 'Live tuning attached' : assignedPreset;
  }

  const handleDeviceChange = async (deviceId: string) => {
    setIsBusy(true);
    try {
      await setDefaultAudioDevice(deviceId);
      activeDeviceIdRef.current = '';
      await refresh();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsBusy(false);
    }
  };

  const deviceOptions: IOptionEntry[] = useMemo(
    () =>
      devices.map((device) => ({
        value: device.id,
        label: device.name,
        display: (
          <div className="device-option">
            <span
              className={device.isDefault ? 'device-dot active' : 'device-dot'}
            />
            <span>{device.name}</span>
          </div>
        ),
      })),
    [devices],
  );

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

      <span className="device-profiles__label">Output device</span>
      <Dropdown
        name="Output device"
        options={deviceOptions}
        value={selectedDeviceId}
        handleChange={handleDeviceChange}
        isDisabled={!!globalError || isBusy || devices.length === 0}
        emptyOptionsPlaceholder="No active outputs found"
      />

      <div className="device-profiles__mapping">
        <span className="device-profiles__label">Automatic mapping</span>
        <strong>{mappingLabel}</strong>
        <span>
          Edit any EQ control to save and attach it automatically to this
          output.
        </span>
      </div>
      <p className="device-profiles__hint">
        FluidEQ maps the stable endpoint ID, so this sound follows the device
        whenever Windows selects it.
      </p>
    </section>
  );
};

export default DeviceProfiles;
