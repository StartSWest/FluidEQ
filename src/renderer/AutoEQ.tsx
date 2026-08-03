/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { IAutoEqUpdateStatus, IEqSource, ISquigSource } from 'common/constants';
import { useAquaContext } from './utils/AquaContext';
import { formatPresetName } from './utils/utils';
import Button from './widgets/Button';
import Dropdown from './widgets/Dropdown';
import { IOptionEntry } from './widgets/List';
import './styles/AutoEQ.scss';
import {
  getAutoEqDeviceList,
  getAutoEqResponseList,
  loadAutoEqPreset,
  getSquiglinkDeviceList,
  getSquiglinkResponseList,
  loadSquiglinkPreset,
  getSquiglinkSourceList,
  checkAutoEqUpdate,
  updateAutoEqDatabase,
} from './utils/equalizerApi';

const EQ_SOURCES: IEqSource[] = [
  {
    id: 'autoeq',
    name: 'AutoEq official',
    description: 'Generated parametric profiles from the AutoEq project.',
    attributionUrl: 'https://github.com/jaakkopasanen/AutoEq',
    online: false,
  },
  {
    id: 'squiglink-gadgetrytech-headphones-headsets',
    name: 'Squiglink / GadgetryTech',
    description: 'Public headphone measurements, fitted locally into PEQ.',
    attributionUrl: 'https://gadgetrytech.squig.link/headsets/',
    online: true,
  },
];

const AutoEQ = () => {
  const CLEAR_SELECTION_EVENT = 'fluideq-clear-autoeq-selection';
  const NO_DEVICE_SELECTION = 'Pick a device first! 🎧';
  const NO_RESPONSES = 'No supported responses 😞';
  const NO_RESPONSE_SELECTION = 'Pick a response! 🔊';

  const { globalError, setGlobalError, refreshState } = useAquaContext();
  const [devices, setDevices] = useState<string[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentDevice, setCurrentDevice] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [sourceId, setSourceId] = useState<IEqSource['id']>('autoeq');
  const [squigSources, setSquigSources] = useState<IEqSource[]>(
    EQ_SOURCES.slice(1),
  );
  const [updateStatus, setUpdateStatus] = useState<IAutoEqUpdateStatus>();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const clearSelection = () => {
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
    };

    window.addEventListener(CLEAR_SELECTION_EVENT, clearSelection);
    return () =>
      window.removeEventListener(CLEAR_SELECTION_EVENT, clearSelection);
  }, []);

  const allSources = useMemo(
    () => [EQ_SOURCES[0], ...squigSources],
    [squigSources],
  );
  const currentSource =
    allSources.find((source) => source.id === sourceId) || allSources[0];

  useEffect(() => {
    getSquiglinkSourceList()
      .then((sources: ISquigSource[]) => {
        setSquigSources(
          sources.map((source) => ({
            id: source.id,
            name: `${source.name} · ${source.type}`,
            description: `Public ${source.type} measurements from ${source.name}.`,
            attributionUrl: source.website,
            online: true,
          })),
        );
        return undefined;
      })
      // Keep the cached GadgetryTech source usable when the optional global
      // manifest is temporarily offline.
      .catch(() => undefined);
  }, [setGlobalError]);

  const fetchDeviceNames = useCallback(async () => {
    try {
      const list =
        sourceId === 'autoeq'
          ? await getAutoEqDeviceList()
          : await getSquiglinkDeviceList(sourceId);
      setDevices(list);
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [setGlobalError, sourceId]);

  // Fetch supported devices from the selected source.
  useEffect(() => {
    fetchDeviceNames();
    if (sourceId === 'autoeq') {
      checkAutoEqUpdate()
        .then(setUpdateStatus)
        .catch(() => setUpdateStatus(undefined))
        .finally(() => setIsCheckingUpdate(false));
    } else {
      setUpdateStatus(undefined);
      setIsCheckingUpdate(false);
    }
  }, [fetchDeviceNames, sourceId]);

  // A background startup sync updates both databases without requiring a
  // manual “Check again”. Refresh the visible list when it completes.
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'databases-synced',
      (...args: unknown[]) => {
        const result = args[0] as { autoeq?: IAutoEqUpdateStatus } | undefined;
        if (sourceId === 'autoeq' && result?.autoeq) {
          setUpdateStatus(result.autoeq);
          setIsCheckingUpdate(false);
        }
        fetchDeviceNames();
      },
    );
    return () => {
      unsubscribe();
    };
  }, [fetchDeviceNames, sourceId]);

  const updateDatabase = async () => {
    setIsUpdating(true);
    try {
      setUpdateStatus(await updateAutoEqDatabase());
      setDevices(await getAutoEqDeviceList());
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsUpdating(false);
    }
  };

  // When user changes the current selected device, fetch the supported responses
  const handleDeviceChange = async (newValue: string) => {
    try {
      const nextResponses =
        sourceId === 'autoeq'
          ? await getAutoEqResponseList(newValue)
          : await getSquiglinkResponseList(sourceId, newValue);
      setResponses(nextResponses);
      setCurrentDevice(newValue);
      // Pick the first available measurement so every model starts with a
      // usable tone instead of leaving the target selector blank.
      setCurrentResponse(nextResponses[0] ?? '');
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const applyAutoEQ = async () => {
    try {
      const profileName = formatPresetName(
        `${currentDevice} - ${currentResponse}`,
      );
      if (sourceId === 'autoeq') {
        await loadAutoEqPreset(currentDevice, currentResponse, profileName);
      } else {
        await loadSquiglinkPreset(
          sourceId,
          currentDevice,
          currentResponse,
          profileName,
        );
      }
      await refreshState();
      window.dispatchEvent(new Event('fluideq-presets-changed'));
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const deviceOptions: IOptionEntry[] = useMemo(
    () =>
      devices.map((s) => {
        return {
          value: s,
          label: s,
          display: <div>{s}</div>,
        };
      }),
    [devices],
  );

  const sourceOptions: IOptionEntry[] = useMemo(
    () =>
      allSources.map((source) => ({
        value: source.id,
        label: source.name,
        group:
          source.id === EQ_SOURCES[0].id
            ? 'AutoEQ official'
            : 'Squiglink public databases',
        display: (
          <div
            className={`eq-source-option${
              source.id === EQ_SOURCES[0].id ? '' : ' eq-source-option--child'
            }`}
          >
            <strong>{source.name}</strong>
            <small>{source.description}</small>
          </div>
        ),
      })),
    [allSources],
  );

  const responseOptions: IOptionEntry[] = useMemo(
    () =>
      responses.map((s) => {
        return {
          value: s,
          label: s,
          display: <div>{s}</div>,
        };
      }),
    [responses],
  );

  return (
    <>
      <div className="section-heading auto-eq-title">
        <div>
          <span className="eyebrow">START FROM A REFERENCE</span>
          <h4>AutoEQ library</h4>
        </div>
        <a href={currentSource.attributionUrl} target="_blank" rel="noreferrer">
          {currentSource.name}
        </a>
      </div>
      <div className="auto-eq">
        <div className="autoeq-field autoeq-field--source">
          <span>Measurement source</span>
          <Dropdown
            name="Measurement source"
            options={sourceOptions}
            value={sourceId}
            handleChange={(newValue) =>
              setSourceId(newValue as IEqSource['id'])
            }
            isDisabled={!!globalError}
            filterPlaceholder="Search sources..."
            isFilterable
          />
        </div>
        <div className="autoeq-field autoeq-field--model">
          <span>Headphone model</span>
          <Dropdown
            name="Audio Device"
            options={deviceOptions}
            value={currentDevice}
            handleChange={handleDeviceChange}
            isDisabled={!!globalError}
            noSelectionPlaceholder={NO_DEVICE_SELECTION}
            emptyOptionsPlaceholder="No measured model matches your search."
            filterPlaceholder="Search by brand or model..."
            isFilterable
          />
        </div>
        <div className="autoeq-field">
          <span>Measurement / target</span>
          <Dropdown
            name="Target Frequency Response"
            options={responseOptions}
            value={currentResponse}
            handleChange={(newValue) => setCurrentResponse(newValue)}
            isDisabled={!!globalError || responses.length === 0}
            emptyOptionsPlaceholder={NO_RESPONSES}
            noSelectionPlaceholder={NO_RESPONSE_SELECTION}
          />
        </div>
        <Button
          className="small"
          ariaLabel="Apply selected headset EQ"
          isDisabled={
            !!globalError || currentDevice === '' || currentResponse === ''
          }
          handleChange={applyAutoEQ}
        >
          Apply headset EQ
        </Button>
      </div>
      <div className="autoeq-update">
        {sourceId === 'autoeq' ? (
          <span>
            {isCheckingUpdate && 'Checking official database...'}
            {!isCheckingUpdate &&
              updateStatus?.updateAvailable &&
              `Update available (${updateStatus.latest?.modelCount.toLocaleString()} models)`}
            {!isCheckingUpdate &&
              updateStatus &&
              !updateStatus.updateAvailable &&
              `Official database up to date - ${updateStatus.current.modelCount.toLocaleString()} models`}
            {!isCheckingUpdate && !updateStatus && 'Update check unavailable'}
          </span>
        ) : (
          <span>
            Live public measurements from{' '}
            <a
              href={currentSource.attributionUrl}
              target="_blank"
              rel="noreferrer"
            >
              GadgetryTech on Squiglink
            </a>
          </span>
        )}
        {sourceId === 'autoeq' && updateStatus?.updateAvailable && (
          <Button
            className="small"
            ariaLabel="Update AutoEq database"
            isDisabled={isUpdating}
            handleChange={updateDatabase}
          >
            {isUpdating ? 'Updating...' : 'Update database'}
          </Button>
        )}
      </div>
    </>
  );
};

export default AutoEQ;
