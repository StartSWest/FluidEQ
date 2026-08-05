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
import {
  AUTOEQ_SOURCE_ID,
  IAutoEqUpdateStatus,
  IEqSource,
} from 'common/constants';
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
  clearHeadset,
  updateAutoEqDatabase,
} from './utils/equalizerApi';

const EQ_SOURCES: IEqSource[] = [
  {
    id: AUTOEQ_SOURCE_ID,
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
 * The source picker option that stands for an applied reference.
 *
 * A profile can name a Squiglink database this build does not offer — the list
 * used to be the whole manifest and is now curated down to two — and selecting
 * an id with no option behind it leaves the picker blank with no way back. In
 * that case, and for profiles saved before the source was recorded at all, the
 * caller's fallback keeps the model reachable by name under whatever source is
 * already showing.
 */
const getAppliedSourceOption = (
  appliedSource: string | undefined,
  fallback: IEqSource['id'] | '',
): IEqSource['id'] | '' =>
  EQ_SOURCES.some((source) => source.id === appliedSource)
    ? (appliedSource as IEqSource['id'])
    : fallback;

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

/**
 * A device row, built on demand rather than up front.
 *
 * The combined catalogue runs to roughly six thousand devices and the dropdown
 * mounts a hundred of them at a time, so an element tree per entry cost several
 * times more memory than the device list it was built from — all of it held for
 * as long as the panel is open.
 */
const deviceOptionDisplay = (device: IDeviceEntry) => () => (
  <div className="eq-device-option">
    <strong>{device.name}</strong>
    <small>{device.sourceName}</small>
  </div>
);

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
  const NO_DEVICE_SELECTION = t('autoeq.pickDevice');
  const NO_RESPONSES = t('autoeq.noResponses');
  const NO_RESPONSE_SELECTION = t('autoeq.pickResponse');
  const [devices, setDevices] = useState<IDeviceEntry[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentDevice, setCurrentDevice] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('');
  // Seeded from the applied reference rather than always starting on "All
  // databases", so a panel that mounts with the state already loaded — every
  // workspace tab switch — needs no second device fetch to end up on the right
  // source. The effect below covers the other order, where the panel mounts
  // first and the state arrives after.
  const [sourceId, setSourceId] = useState<IEqSource['id'] | ''>(() =>
    getAppliedSourceOption(headsetSource, ALL_SOURCE_ID),
  );
  // Two curated databases rather than every Squiglink site there is. The full
  // manifest ran to dozens of sources of wildly varying quality and coverage,
  // which made picking one a chore and made "All databases" slow and noisy.
  const squigSources = useMemo(() => EQ_SOURCES.slice(1), []);
  const [updateStatus, setUpdateStatus] = useState<IAutoEqUpdateStatus>();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  // Held from the click until the last band has been drawn, because applying
  // is the one action here whose result lands somewhere else on the page.
  const [isApplying, setIsApplying] = useState(false);
  const applyRunRef = useRef(0);

  // Switching workspace tab unmounts this panel while an apply may still be
  // animating. The reveal itself stops on its own — it is guarded by the band
  // set, not by this component — but the run counter has to move so the run's
  // finally does not write state into a panel that is gone.
  useEffect(
    () => () => {
      applyRunRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    const clearSelection = () => {
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
      // Clear EQ drops the attribution along with the bands, but it replies
      // with the new filters instead of pushing a state change, so nothing
      // else here would hear about it. Without this re-read the summary above
      // keeps naming a reference whose bands have just been thrown away.
      refreshState();
    };

    window.addEventListener(CLEAR_SELECTION_EVENT, clearSelection);
    return () =>
      window.removeEventListener(CLEAR_SELECTION_EVENT, clearSelection);
  }, [CLEAR_SELECTION_EVENT, refreshState]);

  // Read inside fetchDeviceNames without making them dependencies: the device
  // list depends on the source picker, not on what happens to be applied.
  // Depending on the applied reference would rebuild the whole list the moment
  // Apply landed, wiping the selection that had just been applied.
  const appliedRef = useRef(headset);
  const appliedTargetRef = useRef(headsetTarget);
  const appliedSourceRef = useRef(headsetSource);
  useEffect(() => {
    appliedRef.current = headset;
    appliedTargetRef.current = headsetTarget;
    appliedSourceRef.current = headsetSource;
  }, [headset, headsetSource, headsetTarget]);

  const allSource = useAllSource(t);
  const allSources = useMemo(
    () => [EQ_SOURCES[0], ...squigSources],
    [squigSources],
  );
  const currentSource =
    sourceId === ALL_SOURCE_ID
      ? allSource
      : allSources.find((source) => source.id === sourceId);

  // Only the newest run may write the selection. Overlapping runs were always
  // possible — a source change, the startup sync broadcast and a database
  // update each start one — and restoring the measurement adds a second await,
  // which is long enough for an older run to finish last and put back a
  // selection that has already been moved on from.
  const fetchRunRef = useRef(0);

  const fetchDeviceNames = useCallback(async () => {
    fetchRunRef.current += 1;
    const runId = fetchRunRef.current;
    const isCurrentRun = () => fetchRunRef.current === runId;

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
            source.id === AUTOEQ_SOURCE_ID
              ? await getAutoEqDeviceList()
              : await getSquiglinkDeviceList(source.id),
        })),
      );
      if (!isCurrentRun()) {
        return;
      }
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

      // Put the applied reference back into all three pickers if this source
      // has it. The selection is local state and the applied reference is not,
      // so without this the combos reset to "pick a device" every time the
      // panel remounts or the output changes, while the bands stayed exactly
      // where they were.
      //
      // Matched on source and name together. Under "All databases" a model
      // measured by both would otherwise resolve to whichever sorted first,
      // credit the tuning to the wrong database, and then look for the applied
      // measurement in a list that cannot contain it. Name alone is the right
      // answer only when the source is not something this build can show:
      // profiles written before it was recorded, and databases no longer
      // offered.
      const appliedName = appliedRef.current;
      const appliedSource = appliedSourceRef.current;
      const isKnownSource = EQ_SOURCES.some(
        (source) => source.id === appliedSource,
      );
      const applied = appliedName
        ? entries.find(
            (entry) =>
              entry.name === appliedName &&
              (!isKnownSource || entry.sourceId === appliedSource),
          )
        : undefined;
      if (!applied) {
        setCurrentDevice('');
        setCurrentResponse('');
        setResponses([]);
        return;
      }
      setCurrentDevice(applied.value);

      // The target picker stays empty and disabled until the model's
      // measurement list is loaded, so restoring the model without this
      // restored two thirds of a selection. Same call the model picker makes,
      // and the source is already loaded by the time we get here, so it costs
      // a lookup rather than a fetch.
      const nextResponses =
        applied.sourceId === AUTOEQ_SOURCE_ID
          ? await getAutoEqResponseList(applied.name)
          : await getSquiglinkResponseList(applied.sourceId, applied.name);
      if (!isCurrentRun()) {
        return;
      }
      setResponses(nextResponses);
      // Left blank rather than guessed when the applied measurement is not in
      // the list any more — the databases do get re-cut, and quietly selecting
      // a neighbour would name a tuning that is not the one in the bands.
      const appliedTarget = appliedTargetRef.current;
      setCurrentResponse(
        appliedTarget && nextResponses.includes(appliedTarget)
          ? appliedTarget
          : '',
      );
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [allSources, setGlobalError, sourceId]);

  // What is applied, as one string, so a change to any part of it is a single
  // event rather than three that arrive in whatever order React renders them.
  const appliedIdentity = [headsetSource, headset, headsetTarget].join('::');
  const seededIdentityRef = useRef(appliedIdentity);

  // The applied reference seeds the source picker; it does not pin it.
  //
  // Keyed on what is applied and on nothing else. Changing the source by hand
  // does not change what is applied, so this never fires in response to the
  // user and can never undo their choice — from the first paint on, the picker
  // is theirs. It cannot loop either: everything it writes is downstream of
  // the identity and nothing downstream feeds back into it (the identity comes
  // from the main process), and the ref makes a re-run with an unchanged
  // identity a no-op — which is exactly what the re-runs caused by its own
  // setSourceId are.
  useEffect(() => {
    if (seededIdentityRef.current === appliedIdentity) {
      return;
    }
    seededIdentityRef.current = appliedIdentity;

    if (!headset) {
      // Nothing applied any more: cleared from here or from the layer chip, or
      // an output switched to a profile that never had a reference. Clearing
      // now also clears the bands, so leaving the model and measurement on
      // screen would name a tuning that no longer exists. The source stays put,
      // the way Clear EQ leaves it — it is where you are browsing, not what is
      // applied.
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
      return;
    }

    const nextSourceId = getAppliedSourceOption(headsetSource, sourceId);
    if (nextSourceId !== sourceId) {
      // The fetch effect below reacts to the source change and restores all
      // three pickers from the refs.
      setSourceId(nextSourceId);
    } else {
      // Already showing the right source, so nothing downstream would notice
      // on its own — the applied model or measurement changed underneath it.
      fetchDeviceNames();
    }
  }, [appliedIdentity, fetchDeviceNames, headset, headsetSource, sourceId]);

  // Fetch supported devices from the selected source.
  useEffect(() => {
    fetchDeviceNames();
    if (sourceId === AUTOEQ_SOURCE_ID) {
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
        if (sourceId === AUTOEQ_SOURCE_ID && result?.autoeq) {
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
      // Reloading the list puts the applied reference back with it. This used
      // to blank the pickers afterwards, which made sense while a reload could
      // not restore the measurement; now it would throw away a selection that
      // is still true.
      await fetchDeviceNames();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsUpdating(false);
    }
  };

  // When user changes the current selected device, fetch the supported responses
  const handleDeviceChange = async (newValue: string) => {
    // Claims the run counter so a device list reload still in flight cannot
    // finish last and put the applied model back over this pick.
    fetchRunRef.current += 1;
    const runId = fetchRunRef.current;
    try {
      const selected = devices.find((device) => device.value === newValue);
      if (!selected) {
        return;
      }
      const nextResponses =
        selected.sourceId === AUTOEQ_SOURCE_ID
          ? await getAutoEqResponseList(selected.name)
          : await getSquiglinkResponseList(selected.sourceId, selected.name);
      if (fetchRunRef.current !== runId) {
        return;
      }
      setResponses(nextResponses);
      setCurrentDevice(newValue);
      // Pick the first available measurement so every model starts with a
      // usable tone instead of leaving the target selector blank.
      setCurrentResponse(nextResponses[0] ?? '');
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const selectedDevice = devices.find(
    (device) => device.value === currentDevice,
  );

  // The exact thing driving the bands: database, model AND measurement. Most
  // models have several measurements — different rigs, different target
  // curves — and they do not sound alike, so matching on the model alone
  // called two quite different tunings the same thing and claimed one was
  // applied when the other was. The database matters for the same reason: the
  // popular models are measured by more than one of them.
  //
  // Compared by name because that is what the applied reference records; the
  // picker's value is source-qualified and would never match it.
  const isApplied =
    !!headset &&
    !!selectedDevice &&
    selectedDevice.name === headset &&
    // Tolerant of an unknown source. Profiles saved before it was recorded
    // carry only the model name, and refusing to call those applied would turn
    // a correct "Applied" back into "Apply" for everyone holding one.
    (!headsetSource || selectedDevice.sourceId === headsetSource) &&
    currentResponse === headsetTarget;

  const applyAutoEQ = async () => {
    // Only the newest apply owns the button. Applying is deliberately not
    // blocked while one is in flight — see the button below — and without this
    // the first run's finally would clear the label a second run had just set.
    applyRunRef.current += 1;
    const runId = applyRunRef.current;
    setIsApplying(true);
    try {
      const selected = selectedDevice;
      if (!selected) {
        return;
      }
      const profileName = formatPresetName(
        `${selected.name} - ${currentResponse}`,
      );
      if (selected.sourceId === AUTOEQ_SOURCE_ID) {
        await loadAutoEqPreset(selected.name, currentResponse, profileName);
      } else {
        await loadSquiglinkPreset(
          selected.sourceId,
          selected.name,
          currentResponse,
          profileName,
        );
      }
      // Sent before the reveal rather than after it: the profile is on disk
      // the moment the call above resolves, and the presets bar has no reason
      // to wait out an animation it is not part of.
      window.dispatchEvent(new Event('fluideq-presets-changed'));
      // One config write has already happened; this only draws its result. The
      // bands walk in from the bottom of the spectrum instead of the whole
      // tuning appearing in a single commit, and the promise runs until the
      // last one lands so the button can say so meanwhile.
      await refreshState({ revealBands: true });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      if (applyRunRef.current === runId) {
        setIsApplying(false);
      }
    }
  };

  let applyLabel = t('autoeq.apply');
  if (isApplying) {
    applyLabel = t('autoeq.applying');
  } else if (isApplied) {
    applyLabel = t('convolution.isApplied');
  }

  const deviceOptions: IOptionEntry[] = useMemo(
    () =>
      devices.map((device) => {
        return {
          value: device.value,
          label: `${device.name} · ${device.sourceName}`,
          display: deviceOptionDisplay(device),
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
              ? t('autoeq.applied', {
                  name: headsetTarget
                    ? `${headset} · ${getResponseDisplayName(headsetTarget)}`
                    : headset,
                })
              : t('autoeq.notApplied')}
          </span>
          {/* Same shape as the convolution panel's clear: what is applied,
              then the way to be rid of it. It takes the bands with it. The
              reference is not a label sitting beside the tuning, it is where
              the tuning came from, and dropping only the name left a curve on
              screen that nothing on screen accounted for. */}
          {headset && (
            <button
              type="button"
              className="autoeq-applied__clear"
              title={t('eq.layers.clearReference')}
              aria-label={t('eq.layers.clearReference')}
              disabled={isBlockingError}
              onClick={(event) => {
                // The summary sits inside the section header's click target.
                event.stopPropagation();
                clearHeadset()
                  // Called through a lambda: clearHeadset resolves with the
                  // new filters, and handing those straight to refreshState
                  // would be passing a band map where its options go.
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
      {/* Inside the fold, not in the summary. Whose measurements these are
          matters while you are choosing one and not at all once the section is
          closed, where it was just a stray line of text under the header.
          Positioned into the header's right-hand corner from the stylesheet —
          it is first in the DOM so it reads in order, and takes no row of its
          own on screen. */}
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
          // Not disabled when applied, and not while applying either.
          // Re-applying is a real thing to want — after tweaking bands and
          // deciding the reference was better — and a button that refuses is a
          // worse answer than one that just does it. Changing your mind
          // half-way through the reveal is the same thing: the new tuning
          // replaces the band set, which is what stops the old animation.
          isDisabled={
            isBlockingError || currentDevice === '' || currentResponse === ''
          }
          handleChange={applyAutoEQ}
        >
          {applyLabel}
        </Button>
      </div>
      <div className="autoeq-update">
        {sourceId === AUTOEQ_SOURCE_ID && (
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
