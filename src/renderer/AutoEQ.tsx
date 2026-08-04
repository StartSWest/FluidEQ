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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { IAutoEqUpdateStatus, IEqSource } from 'common/constants';
import { useFluidEqContext } from './utils/FluidEqContext';
import MenuIcon from './icons/MenuIcon';
import { useTranslation } from './utils/I18nContext';
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
  getSquiglinkDeviceList,
  getSquiglinkResponseList,
  loadSquiglinkPreset,
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

/**
 * The synthetic "everything at once" source.
 *
 * Built inside the component rather than at module scope: its name and
 * description are the only two strings in this list that FluidEQ writes itself
 * rather than taking from a provider, so they are the only two that can — and
 * therefore must — be translated.
 */
const useAllSource = (
  t: (key: 'autoeq.allDatabases' | 'autoeq.allDatabases.hint') => string,
): IEqSource => ({
  id: ALL_SOURCE_ID,
  name: t('autoeq.allDatabases'),
  description: t('autoeq.allDatabases.hint'),
  attributionUrl: 'https://github.com/jaakkopasanen/AutoEq',
  online: true,
});

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
  const { headset, isBlockingError, setGlobalError, refreshState } =
    useFluidEqContext();
  const { t } = useTranslation();
  const NO_DEVICE_SELECTION = t('autoeq.pickDevice');
  const NO_RESPONSES = t('autoeq.noResponses');
  const NO_RESPONSE_SELECTION = t('autoeq.pickResponse');
  const [devices, setDevices] = useState<IDeviceEntry[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentDevice, setCurrentDevice] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [sourceId, setSourceId] = useState<IEqSource['id'] | ''>(ALL_SOURCE_ID);
  // Two curated databases rather than every Squiglink site there is. The full
  // manifest ran to dozens of sources of wildly varying quality and coverage,
  // which made picking one a chore and made "All databases" slow and noisy.
  const squigSources = useMemo(() => EQ_SOURCES.slice(1), []);
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

  // Read inside fetchDeviceNames without making it a dependency: the device
  // list depends on the source, not on what happens to be applied.
  const appliedRef = useRef(headset);
  useEffect(() => {
    appliedRef.current = headset;
  }, [headset]);

  const allSource = useAllSource(t);
  const allSources = useMemo(
    () => [EQ_SOURCES[0], ...squigSources],
    [squigSources],
  );
  const currentSource =
    sourceId === ALL_SOURCE_ID
      ? allSource
      : allSources.find((source) => source.id === sourceId);

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
      // Put the applied model back in the picker if this source has it. The
      // selection is local state and the applied reference is not, so without
      // this the combos reset to "pick a device" every time the panel remounts
      // or the output changes, while the bands stayed exactly where they were.
      const applied = entries.find(
        (entry) => entry.name === appliedRef.current,
      );
      setCurrentDevice(applied ? applied.value : '');
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

  // The model in the picker is already the one driving the bands. Compared by
  // name because that is what the applied reference records — the picker’s
  // value is source-qualified and would never match it.
  const isApplied =
    !!headset &&
    devices.find((device) => device.value === currentDevice)?.name === headset;

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
      [allSource, ...allSources].map((source) => {
        let group = 'Squiglink public databases';
        if (source.id === ALL_SOURCE_ID) {
          group = t('autoeq.allDatabases');
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
    [allSource, allSources, t],
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
    // Collapsible for the same reason the sidebar sections are: this is a
    // starting point, not something you keep coming back to, and folded away
    // it hands three rows of height to the bands underneath it.
    <SidebarSection
      className="autoeq-section"
      eyebrow={t('autoeq.eyebrow')}
      title={t('autoeq.title')}
      // What is currently applied, kept outside the fold. Folded, this is the
      // whole point of the section — you want to know which reference your
      // bands came from without opening anything.
      summary={
        <div className="autoeq-applied">
          <MenuIcon name="model" />
          <span>
            {headset
              ? t('autoeq.applied', { name: headset })
              : t('autoeq.notApplied')}
          </span>
        </div>
      }
    >
      {/* Inside the fold, not in the summary. Whose measurements these are
          matters while you are choosing one and not at all once the section is
          closed, where it was just a stray line of text under the header. */}
      <div className="autoeq-attribution">
        {currentSource && currentSource.id !== ALL_SOURCE_ID ? (
          <a
            href={currentSource.attributionUrl}
            target="_blank"
            rel="noreferrer"
          >
            {currentSource.name}
          </a>
        ) : (
          <span>{currentSource?.name || t('autoeq.selectSource')}</span>
        )}
      </div>
      <div className="auto-eq">
        <div className="autoeq-field autoeq-field--source">
          <span className="autoeq-field__title">{t('autoeq.source')}</span>
          <Dropdown
            name="Measurement source"
            options={sourceOptions}
            value={sourceId}
            noSelectionPlaceholder={t('autoeq.selectSourcePlaceholder')}
            handleChange={(newValue) =>
              setSourceId(newValue as IEqSource['id'])
            }
            isDisabled={isBlockingError}
            filterPlaceholder={t('autoeq.searchSources')}
            isFilterable
          />
        </div>
        <div className="autoeq-field autoeq-field--model">
          <span className="autoeq-field__title">{t('autoeq.model')}</span>
          <Dropdown
            name="Audio Device"
            options={deviceOptions}
            value={currentDevice}
            handleChange={handleDeviceChange}
            isDisabled={isBlockingError || !sourceId}
            noSelectionPlaceholder={NO_DEVICE_SELECTION}
            emptyOptionsPlaceholder={t('autoeq.noModel')}
            filterPlaceholder={t('autoeq.searchModels')}
            isFilterable
          />
        </div>
        <div className="autoeq-field autoeq-field--target">
          <span className="autoeq-field__title">{t('autoeq.target')}</span>
          <Dropdown
            name="Target Frequency Response"
            options={responseOptions}
            value={currentResponse}
            handleChange={(newValue) => setCurrentResponse(newValue)}
            isDisabled={isBlockingError || responses.length === 0}
            emptyOptionsPlaceholder={NO_RESPONSES}
            noSelectionPlaceholder={NO_RESPONSE_SELECTION}
          />
        </div>
        {/* Says so once it has been. Applying is the one action here with no
            visible effect inside this panel — the result lands in the bands
            below — so without this it was impossible to tell whether the click
            had registered. */}
        <Button
          className={isApplied ? 'small is-applied' : 'small'}
          ariaLabel={t('autoeq.applyAria')}
          isDisabled={
            isBlockingError ||
            isApplied ||
            currentDevice === '' ||
            currentResponse === ''
          }
          handleChange={applyAutoEQ}
        >
          {isApplied ? t('convolution.isApplied') : t('autoeq.apply')}
        </Button>
      </div>
      <div className="autoeq-update">
        {sourceId === 'autoeq' && (
          <>
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
          </>
        )}
      </div>
    </SidebarSection>
  );
};

export default AutoEQ;
