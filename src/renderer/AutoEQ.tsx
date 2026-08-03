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

const ALL_SOURCE_ID = 'all';
const ALL_SOURCE: IEqSource = {
  id: ALL_SOURCE_ID,
  name: 'All databases',
  description: 'Search AutoEQ official and every synced Squiglink database.',
  attributionUrl: 'https://github.com/jaakkopasanen/AutoEq',
  online: true,
};

interface IDeviceEntry {
  value: string;
  name: string;
  sourceId: IEqSource['id'];
  sourceName: string;
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
  const NO_DEVICE_SELECTION = 'Pick a device first! 🎧';
  const NO_RESPONSES = 'No supported responses 😞';
  const NO_RESPONSE_SELECTION = 'Pick a response! 🔊';

  const { globalError, setGlobalError, refreshState } = useAquaContext();
  const [devices, setDevices] = useState<IDeviceEntry[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentDevice, setCurrentDevice] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [sourceId, setSourceId] = useState<IEqSource['id'] | ''>(ALL_SOURCE_ID);
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
    sourceId === ALL_SOURCE_ID
      ? ALL_SOURCE
      : allSources.find((source) => source.id === sourceId);

  useEffect(() => {
    getSquiglinkSourceList()
      .then((sources: ISquigSource[]) => {
        const discoveredSources = sources.map((source) => ({
            id: source.id,
            name: `${source.name} · ${source.type}`,
            description: `Public ${source.type} measurements from ${source.name}.`,
            attributionUrl: source.website,
            online: true,
          }));
        const gadgetryTechFallback = EQ_SOURCES[1];
        setSquigSources([
          gadgetryTechFallback,
          ...discoveredSources.filter(
            (source) =>
              source.id !== gadgetryTechFallback.id &&
              source.attributionUrl !== gadgetryTechFallback.attributionUrl,
          ),
        ]);
        return undefined;
      })
      // Keep the cached GadgetryTech source usable when the optional global
      // manifest is temporarily offline.
      .catch(() => undefined);
  }, [setGlobalError]);

  const fetchDeviceNames = useCallback(async () => {
    if (!sourceId) {
      setDevices([]);
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
      return;
    }

    try {
      const sourcesToLoad =
        sourceId === ALL_SOURCE_ID
          ? allSources
          : allSources.filter((source) => source.id === sourceId);
      const results = await Promise.allSettled(
        sourcesToLoad.map(async (source) => ({
          source,
          names:
            source.id === 'autoeq'
              ? await getAutoEqDeviceList()
              : await getSquiglinkDeviceList(source.id),
        })),
      );
      const entries: IDeviceEntry[] = results.flatMap((result) => {
        if (result.status !== 'fulfilled') {
          return [];
        }
        return result.value.names.map((name) => ({
          value: `${result.value.source.id}::${name}`,
          name,
          sourceId: result.value.source.id,
          sourceName: result.value.source.name,
        }));
      });
      entries.sort((left, right) =>
        `${left.name} ${left.sourceName}`.localeCompare(
          `${right.name} ${right.sourceName}`,
        ),
      );
      setDevices(entries);
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [allSources, setGlobalError, sourceId]);

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
      await fetchDeviceNames();
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
      const selected = devices.find((device) => device.value === newValue);
      if (!selected) {
        return;
      }
      const nextResponses =
        selected.sourceId === 'autoeq'
          ? await getAutoEqResponseList(selected.name)
          : await getSquiglinkResponseList(selected.sourceId, selected.name);
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
      const selected = devices.find((device) => device.value === currentDevice);
      if (!selected) {
        return;
      }
      const profileName = formatPresetName(
        `${selected.name} - ${currentResponse}`,
      );
      if (selected.sourceId === 'autoeq') {
        await loadAutoEqPreset(selected.name, currentResponse, profileName);
      } else {
        await loadSquiglinkPreset(
          selected.sourceId,
          selected.name,
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
      devices.map((device) => {
        return {
          value: device.value,
          label: `${device.name} · ${device.sourceName}`,
          display: (
            <div className="eq-device-option">
              <strong>{device.name}</strong>
              <small>{device.sourceName}</small>
            </div>
          ),
        };
      }),
    [devices],
  );

  const sourceOptions: IOptionEntry[] = useMemo(
    () =>
      [ALL_SOURCE, ...allSources].map((source) => {
        let group = 'Squiglink public databases';
        if (source.id === ALL_SOURCE_ID) {
          group = 'All databases';
        } else if (source.id === EQ_SOURCES[0].id) {
          group = 'AutoEQ official';
        }
        const isPrimarySource =
          source.id === ALL_SOURCE_ID || source.id === EQ_SOURCES[0].id;
        return {
          value: source.id,
          label: source.name,
          group,
          display: (
            <div
              className={`eq-source-option${
                isPrimarySource ? '' : ' eq-source-option--child'
              }`}
            >
              <strong>{source.name}</strong>
              <small>{source.description}</small>
            </div>
          ),
        };
      }),
    [allSources],
  );

  const responseOptions: IOptionEntry[] = useMemo(
    () =>
      responses.map((s) => {
        const format = getResponseFormatLabel(s);
        const cleanName = getResponseDisplayName(s);
        return {
          value: s,
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

  return (
    <>
      <div className="section-heading auto-eq-title">
        <div>
          <span className="eyebrow">START FROM A REFERENCE</span>
          <h4>AutoEQ library</h4>
        </div>
        {currentSource ? (
          <a
            href={currentSource.attributionUrl}
            target="_blank"
            rel="noreferrer"
          >
            {currentSource.name}
          </a>
        ) : (
          <span>Select a source</span>
        )}
      </div>
      <div className="auto-eq">
        <div className="autoeq-field autoeq-field--source">
          <span>Measurement source</span>
          <Dropdown
            name="Measurement source"
            options={sourceOptions}
            value={sourceId}
            noSelectionPlaceholder="Select a source..."
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
            isDisabled={!!globalError || !sourceId}
            noSelectionPlaceholder={NO_DEVICE_SELECTION}
            emptyOptionsPlaceholder="No measured model matches your search."
            filterPlaceholder="Search by brand or model..."
            isFilterable
            showOptionsBeforeSearch={false}
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
        {sourceId === 'autoeq' && (
          <>
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
            {updateStatus?.updateAvailable && (
              <Button
                className="small"
                ariaLabel="Update AutoEq database"
                isDisabled={isUpdating}
                handleChange={updateDatabase}
              >
                {isUpdating ? 'Updating...' : 'Update database'}
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default AutoEQ;
