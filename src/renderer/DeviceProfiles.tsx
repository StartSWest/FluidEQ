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
import SidebarSection from './components/SidebarSection';
import { IOptionEntry } from './widgets/List';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
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
  const { isBlockingError, performHealthCheck, setGlobalError } =
    useFluidEqContext();
  const { t } = useTranslation();
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
        window.dispatchEvent(
          new CustomEvent('fluideq-output-changed', {
            detail: { deviceId: activeDevice.id },
          }),
        );
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

  // Polled, because Windows does not tell us when someone plugs in headphones,
  // and paused whenever the window is hidden.
  //
  // Each tick is an IPC round-trip that enumerates every audio endpoint on the
  // machine, and this panel is mounted for the whole life of the app — so
  // unpaused it is twenty of those a minute, forever, including while the
  // window is minimised behind everything else. A device list nobody can see
  // does not need refreshing, and nothing is missed by stopping: the refresh
  // on the way back up runs before the window is painted, so what you see when
  // you look is current.
  useEffect(() => {
    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      if (timer !== undefined) {
        return;
      }
      refresh();
      timer = window.setInterval(refresh, 3000);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [devices, selectedDeviceId],
  );
  const assignedPreset = selectedDeviceId
    ? settings.assignments[selectedDeviceId]?.presetName || ''
    : '';
  const isAutomaticProfile = assignedPreset.startsWith(AUTOMATIC_PRESET_PREFIX);
  let mappingLabel = t('output.mapping.neutral');
  if (assignedPreset) {
    mappingLabel = isAutomaticProfile
      ? t('output.mapping.live')
      : assignedPreset;
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
    // The picker is the summary, so folding this section hides the mapping
    // detail but leaves the output you are choosing between on screen.
    <SidebarSection
      eyebrow={t('output.eyebrow')}
      title={t('output.title')}
      summary={
        <div className="device-profiles__picker">
          {/* The badge earns its place: the picker lists every endpoint, so
              which one Windows is actually playing through is not otherwise
              obvious. */}
          <span className="device-profiles__label device-profiles__label--row">
            {t('output.device')}
            {selectedDevice?.isDefault && (
              <span className="default-badge">{t('output.active')}</span>
            )}
          </span>
          <Dropdown
            name={t('output.device')}
            options={deviceOptions}
            value={selectedDeviceId}
            handleChange={handleDeviceChange}
            isDisabled={isBlockingError || isBusy || devices.length === 0}
            emptyOptionsPlaceholder={t('output.none')}
          />
        </div>
      }
    >
      <div className="device-profiles__mapping">
        <span className="device-profiles__label">{t('output.mapping')}</span>
        <strong>{mappingLabel}</strong>
        <span>{t('output.mapping.hint')}</span>
      </div>
      <p className="device-profiles__hint">{t('output.hint')}</p>
    </SidebarSection>
  );
};

export default DeviceProfiles;
