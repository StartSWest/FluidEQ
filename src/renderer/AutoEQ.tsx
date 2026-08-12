/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { AUTOEQ_SOURCE_ID, IAutoEqUpdateStatus } from 'common/constants';
import { useFluidEqContext } from './utils/FluidEqContext';
import MenuIcon from './icons/MenuIcon';
import { useTranslation } from './utils/I18nContext';
import {
  addAutoEqSearchToHistory,
  clearAutoEqSearchHistory,
  useAutoEqSearchHistory,
} from './utils/autoEqSearchHistory';
import SidebarSection from './components/SidebarSection';
import { formatPresetName } from './utils/utils';
import Button from './widgets/Button';
import Dropdown from './widgets/Dropdown';
import { IOptionEntry } from './widgets/List';
import './styles/AutoEQ.scss';
import {
  getAutoEqDeviceList,
  getAutoEqResponseList,
  loadAutoEqPreset,
  checkAutoEqUpdate,
  clearHeadset,
  updateAutoEqDatabase,
} from './utils/equalizerApi';

const AUTOEQ_ATTRIBUTION_URL = 'https://github.com/jaakkopasanen/AutoEq';

interface IDeviceEntry {
  value: string;
  name: string;
}

const getResponseFormatLabel = (response: string) => {
  if (/graphiceq/i.test(response)) {
    return 'Graphic EQ · native APO GraphicEQ';
  }
  if (/fixedbandeq/i.test(response)) {
    return 'Fixed Band EQ · APO parametric filters';
  }
  return 'Parametric EQ · APO Filter/Fc/Gain/Q';
};

const getResponseDisplayName = (response: string) =>
  response.replace(/\s+-\s+(?:Parametric|FixedBand|Graphic)EQ(?:\.txt)?$/i, '');

const AutoEQ = () => {
  const CLEAR_SELECTION_EVENT = 'fluideq-clear-autoeq-selection';
  const {
    headset,
    headsetTarget,
    headsetSource,
    isBlockingError,
    setGlobalError,
    refreshState,
  } = useFluidEqContext();
  const { t } = useTranslation();
  const searchHistory = useAutoEqSearchHistory();
  const [devices, setDevices] = useState<IDeviceEntry[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentDevice, setCurrentDevice] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [updateStatus, setUpdateStatus] = useState<IAutoEqUpdateStatus>();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const applyRunRef = useRef(0);
  const fetchRunRef = useRef(0);
  const appliedRef = useRef(headset);
  const appliedTargetRef = useRef(headsetTarget);
  const appliedSourceRef = useRef(headsetSource);

  useEffect(() => {
    appliedRef.current = headset;
    appliedTargetRef.current = headsetTarget;
    appliedSourceRef.current = headsetSource;
  }, [headset, headsetSource, headsetTarget]);

  useEffect(
    () => () => {
      applyRunRef.current += 1;
      fetchRunRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    const clearSelection = () => {
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
      refreshState();
    };
    window.addEventListener(CLEAR_SELECTION_EVENT, clearSelection);
    return () =>
      window.removeEventListener(CLEAR_SELECTION_EVENT, clearSelection);
  }, [CLEAR_SELECTION_EVENT, refreshState]);

  const fetchDeviceNames = useCallback(async () => {
    fetchRunRef.current += 1;
    const runId = fetchRunRef.current;
    const isCurrentRun = () => fetchRunRef.current === runId;

    try {
      const names = await getAutoEqDeviceList();
      if (!isCurrentRun()) {
        return;
      }
      const entries = names
        .map((name) => ({ value: `${AUTOEQ_SOURCE_ID}::${name}`, name }))
        .sort((left, right) => left.name.localeCompare(right.name));
      setDevices(entries);

      const appliedName = appliedRef.current;
      const appliedSource = appliedSourceRef.current;
      if (
        !appliedName ||
        (appliedSource && appliedSource !== AUTOEQ_SOURCE_ID)
      ) {
        setCurrentDevice('');
        setCurrentResponse('');
        setResponses([]);
        return;
      }

      const applied = entries.find((entry) => entry.name === appliedName);
      if (!applied) {
        setCurrentDevice('');
        setCurrentResponse('');
        setResponses([]);
        return;
      }

      const nextResponses = await getAutoEqResponseList(applied.name);
      if (!isCurrentRun()) {
        return;
      }
      setCurrentDevice(applied.value);
      setResponses(nextResponses);
      const appliedTarget = appliedTargetRef.current;
      setCurrentResponse(
        appliedTarget && nextResponses.includes(appliedTarget)
          ? appliedTarget
          : '',
      );
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  }, [setGlobalError]);

  useEffect(() => {
    checkAutoEqUpdate()
      .then(setUpdateStatus)
      .catch(() => setUpdateStatus(undefined))
      .finally(() => setIsCheckingUpdate(false));
  }, [fetchDeviceNames]);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'databases-synced',
      (...args: unknown[]) => {
        const result = args[0] as { autoeq?: IAutoEqUpdateStatus } | undefined;
        if (result?.autoeq) {
          setUpdateStatus(result.autoeq);
          setIsCheckingUpdate(false);
        }
        fetchDeviceNames();
      },
    );
    return () => {
      unsubscribe();
    };
  }, [fetchDeviceNames]);

  useEffect(() => {
    fetchDeviceNames();
  }, [fetchDeviceNames, headset, headsetTarget, headsetSource]);

  const handleDeviceChange = async (newValue: string) => {
    fetchRunRef.current += 1;
    const runId = fetchRunRef.current;
    const selected = devices.find((device) => device.value === newValue);
    if (!selected) {
      return;
    }
    try {
      const nextResponses = await getAutoEqResponseList(selected.name);
      if (fetchRunRef.current !== runId) {
        return;
      }
      setCurrentDevice(newValue);
      setResponses(nextResponses);
      setCurrentResponse(nextResponses[0] ?? '');
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  };

  const selectedDevice = devices.find(
    (device) => device.value === currentDevice,
  );
  const isApplied =
    !!headset &&
    !!selectedDevice &&
    selectedDevice.name === headset &&
    (!headsetSource || headsetSource === AUTOEQ_SOURCE_ID) &&
    currentResponse === headsetTarget;

  const applyAutoEQ = async () => {
    applyRunRef.current += 1;
    const runId = applyRunRef.current;
    setIsApplying(true);
    try {
      if (!selectedDevice) {
        return;
      }
      const profileName = formatPresetName(
        `${selectedDevice.name} - ${currentResponse}`,
      );
      await loadAutoEqPreset(selectedDevice.name, currentResponse, profileName);
      window.dispatchEvent(new Event('fluideq-presets-changed'));
      await refreshState({ revealBands: true });
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      if (applyRunRef.current === runId) {
        setIsApplying(false);
      }
    }
  };

  const updateDatabase = async () => {
    setIsUpdating(true);
    try {
      setUpdateStatus(await updateAutoEqDatabase());
      await fetchDeviceNames();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setIsUpdating(false);
    }
  };

  const responseOptions: IOptionEntry[] = useMemo(
    () =>
      responses.map((response) => {
        const format = getResponseFormatLabel(response);
        const cleanName = getResponseDisplayName(response);
        return {
          value: response,
          label: `${cleanName} · ${format}`,
          display: (
            <div className="autoeq-response-option">
              <strong>{cleanName}</strong>
              <small>{format}</small>
            </div>
          ),
        };
      }),
    [responses],
  );

  const deviceOptions: IOptionEntry[] = useMemo(
    () =>
      devices.map((device) => ({
        value: device.value,
        label: `${device.name} · ${t('autoeq.official')}`,
        display: (
          <div className="eq-device-option">
            <strong>{device.name}</strong>
            <small>{t('autoeq.official')}</small>
          </div>
        ),
      })),
    [devices, t],
  );

  let applyLabel = t('autoeq.apply');
  if (isApplying) {
    applyLabel = t('autoeq.applying');
  } else if (isApplied) {
    applyLabel = t('convolution.isApplied');
  }

  return (
    <SidebarSection
      className="autoeq-section"
      eyebrow={t('autoeq.eyebrow')}
      title={t('autoeq.title')}
      summary={
        <div className="autoeq-applied">
          <MenuIcon name="model" />
          <span>
            {headset
              ? t('autoeq.applied', {
                  name: headsetTarget
                    ? `${headset} · ${getResponseDisplayName(headsetTarget)}`
                    : headset,
                })
              : t('autoeq.notApplied')}
          </span>
          {headset && (
            <button
              type="button"
              className="autoeq-applied__clear"
              title={t('eq.layers.clearReference')}
              aria-label={t('eq.layers.clearReference')}
              disabled={isBlockingError}
              onClick={(event) => {
                event.stopPropagation();
                clearHeadset()
                  .then(() => refreshState())
                  .catch((error) => setGlobalError(error as ErrorDescription));
              }}
            >
              <MenuIcon name="clear" />
            </button>
          )}
        </div>
      }
    >
      <div className="autoeq-attribution">
        <a href={AUTOEQ_ATTRIBUTION_URL} target="_blank" rel="noreferrer">
          {t('autoeq.officialDatabase')}
        </a>
      </div>
      <div className="auto-eq">
        <div className="autoeq-field autoeq-field--model">
          <span className="autoeq-field__title">{t('autoeq.model')}</span>
          <Dropdown
            name={t('autoeq.deviceAria')}
            menuClassName="auto-eq-menu"
            options={deviceOptions}
            value={currentDevice}
            handleChange={handleDeviceChange}
            isDisabled={isBlockingError}
            noSelectionPlaceholder={t('autoeq.pickDevice')}
            emptyOptionsPlaceholder={t('autoeq.noModel')}
            filterPlaceholder={t('autoeq.searchModels')}
            searchHistory={searchHistory}
            searchHistoryLabel={t('video.searchRecent')}
            clearSearchHistoryLabel={t('video.searchForgetAll')}
            onSearchCommit={addAutoEqSearchToHistory}
            onClearSearchHistory={clearAutoEqSearchHistory}
            isFilterable
          />
        </div>
        <div className="autoeq-field autoeq-field--target">
          <span className="autoeq-field__title">{t('autoeq.target')}</span>
          <Dropdown
            name={t('autoeq.targetAria')}
            menuClassName="auto-eq-menu"
            options={responseOptions}
            value={currentResponse}
            handleChange={(newValue) => setCurrentResponse(newValue)}
            isDisabled={isBlockingError || responses.length === 0}
            emptyOptionsPlaceholder={t('autoeq.noResponses')}
            noSelectionPlaceholder={t('autoeq.pickResponse')}
          />
        </div>
        <Button
          className={isApplied ? 'small is-applied' : 'small'}
          ariaLabel={t('autoeq.applyAria')}
          isDisabled={
            isBlockingError || currentDevice === '' || currentResponse === ''
          }
          handleChange={applyAutoEQ}
        >
          {applyLabel}
        </Button>
      </div>
      <div className="autoeq-update">
        <span>
          {isCheckingUpdate && t('autoeq.checking')}
          {!isCheckingUpdate &&
            updateStatus?.updateAvailable &&
            t('autoeq.updateAvailable', {
              count: updateStatus.latest?.modelCount.toLocaleString() ?? '',
            })}
          {!isCheckingUpdate &&
            updateStatus &&
            !updateStatus.updateAvailable &&
            t('autoeq.upToDate', {
              count: updateStatus.current.modelCount.toLocaleString(),
            })}
          {!isCheckingUpdate && !updateStatus && t('autoeq.updateUnknown')}
        </span>
        {updateStatus?.updateAvailable && (
          <Button
            className="small"
            ariaLabel={t('autoeq.updateAria')}
            isDisabled={isUpdating}
            handleChange={updateDatabase}
          >
            {isUpdating ? t('autoeq.updating') : t('autoeq.update')}
          </Button>
        )}
      </div>
    </SidebarSection>
  );
};

export default AutoEQ;
