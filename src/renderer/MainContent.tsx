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

import {
  CSSProperties,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FilterTypeEnum,
  FilterTypeToLabelMap,
  FixedBandSizeEnum,
  MAX_NUM_FILTERS,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_NUM_FILTERS,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import FrequencyBand from './components/FrequencyBand';
import { FilterActionEnum, useAquaContext } from './utils/AquaContext';
import './styles/MainContent.scss';
import './styles/MultiSelect.scss';
import Spinner from './icons/Spinner';
import { clamp, sortHelper } from './utils/utils';
import Button from './widgets/Button';
import {
  addEqualizerSlider,
  clearGains,
  removeEqualizerSlider,
  setFrequency,
  setFixedBand,
  setGain,
  setQuality,
  setType,
} from './utils/equalizerApi';
import Dropdown from './widgets/Dropdown';
import NumberInput from './widgets/NumberInput';
import Knob from './widgets/Knob';
import { FILTER_OPTIONS } from './icons/FilterTypeIcon';
import { useLiveAudio } from './audio/LiveAudioContext';
import {
  buildBalancedGains,
  describeBalanceProgress,
  describeBalanceResult,
} from './utils/autoBalance';
import { buildVoicingTargetCurve } from './utils/voicingCurve';
import VoicingQuickPick from './components/VoicingQuickPick';

const MainContent = () => {
  const {
    filters,
    isLoading,
    globalError,
    dispatchFilter,
    setGlobalError,
    setPreAmp,
    selectedFilterId,
    setSelectedFilterId,
    selectedFilterIds,
    setSelectedFilterIds,
    toggleFilterSelection,
    hoveredFilterId,
    setHoveredFilterId,
    voicing,
  } = useAquaContext();
  const { captureBalanceProfile, isActive: isLiveOutputActive } =
    useLiveAudio();
  const [balanceStatus, setBalanceStatus] = useState('');
  const [isBalancing, setIsBalancing] = useState(false);
  const [measureFromFlat, setMeasureFromFlat] = useState(false);
  const balanceAbortRef = useRef<AbortController | undefined>(undefined);
  // Bumped whenever a run is superseded, so a late resolution from an
  // abandoned measurement cannot write gains or overwrite the status.
  const balanceRunRef = useRef(0);
  const frequencySortedFilters = useMemo(
    () => Object.values(filters).sort(sortHelper),
    [filters],
  );

  const density = useMemo(() => {
    if (frequencySortedFilters.length <= 6) {
      return 'full';
    }
    if (frequencySortedFilters.length <= 15) {
      return 'compact';
    }
    return 'dense';
  }, [frequencySortedFilters.length]);
  const bandLayout = frequencySortedFilters.length <= 10 ? 'centered' : 'wide';

  const selectedFilter = useMemo(
    () => filters[selectedFilterId] ?? frequencySortedFilters[0] ?? undefined,
    [filters, frequencySortedFilters, selectedFilterId],
  );
  const isSelectedGainDisabled = selectedFilter
    ? NO_GAIN_FILTER_TYPES.includes(selectedFilter.type)
    : true;

  useEffect(() => {
    if (
      (!selectedFilterId || !filters[selectedFilterId]) &&
      frequencySortedFilters[0]
    ) {
      setSelectedFilterId(frequencySortedFilters[0].id);
    }
  }, [filters, frequencySortedFilters, selectedFilterId, setSelectedFilterId]);

  // Leaving the EQ tab unmounts this component; a measurement must not keep
  // running against a component that is gone.
  useEffect(
    () => () => {
      balanceRunRef.current += 1;
      balanceAbortRef.current?.abort();
    },
    [],
  );

  const bandsRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<
    | { startX: number; startY: number; currentX: number; currentY: number }
    | undefined
  >();

  const updateSelectedGroup = useCallback(
    async (field: 'frequency' | 'gain' | 'quality', newValue: number) => {
      if (!selectedFilter) {
        return;
      }
      const ids = selectedFilterIds.includes(selectedFilter.id)
        ? selectedFilterIds
        : [selectedFilter.id];
      const delta = newValue - selectedFilter[field];
      const bounds = {
        frequency: [MIN_FREQUENCY, MAX_FREQUENCY],
        gain: [MIN_GAIN, MAX_GAIN],
        quality: [MIN_QUALITY, MAX_QUALITY],
      }[field];
      let actionType = FilterActionEnum.QUALITY;
      if (field === 'frequency') {
        actionType = FilterActionEnum.FREQUENCY;
      } else if (field === 'gain') {
        actionType = FilterActionEnum.GAIN;
      }
      try {
        await Promise.all(
          ids.map(async (id) => {
            const filter = filters[id];
            if (
              !filter ||
              (field === 'gain' && NO_GAIN_FILTER_TYPES.includes(filter.type))
            ) {
              return;
            }
            const nextValue = clamp(
              filter[field] + delta,
              bounds[0],
              bounds[1],
            );
            if (field === 'frequency') {
              await setFrequency(id, nextValue);
            } else if (field === 'gain') {
              await setGain(id, nextValue);
            } else {
              await setQuality(id, nextValue);
            }
            dispatchFilter({
              type: actionType,
              id,
              newValue: nextValue,
            });
          }),
        );
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [
      dispatchFilter,
      filters,
      selectedFilter,
      selectedFilterIds,
      setGlobalError,
    ],
  );

  const handleBandGainChange = useCallback(
    (filterId: string, newValue: number) => {
      const source = filters[filterId];
      if (!source) {
        return Promise.resolve();
      }
      const primaryValue = selectedFilter?.gain ?? source.gain;
      return updateSelectedGroup(
        'gain',
        primaryValue + (newValue - source.gain),
      );
    },
    [filters, selectedFilter?.gain, updateSelectedGroup],
  );

  const getSelectionPoint = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = bandsRef.current?.getBoundingClientRect();
    if (!bounds) {
      return undefined;
    }
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const handleBandsPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const point = getSelectionPoint(event);
    if (!point) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionBox({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const handleBandsPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!selectionBox) {
      return;
    }
    const point = getSelectionPoint(event);
    if (!point) {
      return;
    }
    setSelectionBox((current) =>
      current ? { ...current, currentX: point.x, currentY: point.y } : current,
    );
  };

  const finishBandSelection = (event: PointerEvent<HTMLDivElement>) => {
    if (!selectionBox) {
      return;
    }
    const bounds = bandsRef.current?.getBoundingClientRect();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const right = Math.max(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const bottom = Math.max(selectionBox.startY, selectionBox.currentY);
    const isClick = right - left < 6 && bottom - top < 6;
    const selectedIds = isClick
      ? []
      : Array.from(
          bandsRef.current?.querySelectorAll<HTMLElement>('[data-filter-id]') ||
            [],
        )
          .filter((element) => {
            if (!bounds) {
              return false;
            }
            const elementBounds = element.getBoundingClientRect();
            return (
              elementBounds.right >= bounds.left + left &&
              elementBounds.left <= bounds.left + right &&
              elementBounds.bottom >= bounds.top + top &&
              elementBounds.top <= bounds.top + bottom
            );
          })
          .map((element) => element.dataset.filterId)
          .filter((id): id is string => !!id);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    setSelectedFilterIds(
      additive
        ? [...new Set([...selectedFilterIds, ...selectedIds])]
        : selectedIds,
    );
    setSelectionBox(undefined);
  };

  const deleteSelectedFilter = async () => {
    if (!selectedFilter || frequencySortedFilters.length <= MIN_NUM_FILTERS) {
      return;
    }
    try {
      await removeEqualizerSlider(selectedFilter.id);
      dispatchFilter({
        type: FilterActionEnum.REMOVE,
        id: selectedFilter.id,
      });
      setSelectedFilterId('');
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  // Clearing restores the default ten-band layout with every band neutral, so
  // the main process owns the new filter set and hands it back.
  const clearFilterGains = async () => {
    try {
      const newFilters = await clearGains();
      setPreAmp(0);
      setSelectedFilterIds([]);
      dispatchFilter({
        type: FilterActionEnum.INIT,
        filters: newFilters,
      });
      window.dispatchEvent(new Event('fluideq-clear-autoeq-selection'));
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  /**
   * Listen to what is actually coming out of the speakers, then flatten the
   * peaks and dips it finds while leaving the music's own spectral tilt alone.
   *
   * There is no fixed duration. The measurement runs until every frequency
   * region has been heard well enough to correct — or reports which range it
   * managed to measure, and leaves the rest alone.
   */
  const autoBalance = async () => {
    if (isBalancing) {
      // The button is a Cancel while a measurement is running.
      balanceAbortRef.current?.abort();
      return;
    }

    balanceRunRef.current += 1;
    const runId = balanceRunRef.current;
    const isCurrentRun = () => balanceRunRef.current === runId;
    const controller = new AbortController();
    balanceAbortRef.current = controller;
    // The band set at the moment of measuring. If the user changes layout
    // mid-capture, the measurement no longer describes these bands.
    const measuredIds = frequencySortedFilters
      .map((filter) => filter.id)
      .join();

    setIsBalancing(true);

    try {
      // Measuring the post-EQ output is normally the right thing — the loop
      // converges and self-corrects any error in the filter model. It has one
      // blind spot: a band already cut hard leaves its region with almost no
      // energy, so the measurement marks it untrustworthy and never touches
      // it. The bad EQ hides the very problem it is causing. Flattening first
      // is the escape hatch for exactly that.
      if (measureFromFlat) {
        setBalanceStatus('Flattening...');
        await Promise.all(
          frequencySortedFilters
            .filter((filter) => filter.gain !== 0)
            .map(async (filter) => {
              await setGain(filter.id, 0);
              dispatchFilter({
                type: FilterActionEnum.GAIN,
                id: filter.id,
                newValue: 0,
              });
            }),
        );
        if (!isCurrentRun()) {
          return;
        }
      }

      setBalanceStatus('Listening 0%');
      const result = await captureBalanceProfile({
        signal: controller.signal,
        onProgress: (progress) => {
          if (isCurrentRun()) {
            setBalanceStatus(describeBalanceProgress(progress));
          }
        },
      });

      if (!isCurrentRun()) {
        return;
      }

      const currentFilters = Object.values(filters).sort(sortHelper);
      if (currentFilters.map((filter) => filter.id).join() !== measuredIds) {
        setBalanceStatus('Bands changed - cancelled');
        return;
      }

      // Steer toward the active voicing rather than merely flattening: the
      // capture already contains the voicing layer, so without this Smart EQ
      // would fight it back out again.
      const gains = buildBalancedGains(result.samples, currentFilters, {
        targetCurve: buildVoicingTargetCurve(voicing),
      });
      const entries = Object.entries(gains);
      if (entries.length === 0) {
        setBalanceStatus('Not enough range to measure');
        return;
      }

      setBalanceStatus('Applying...');
      const pending = entries.filter(
        ([id, gain]) => filters[id] && filters[id].gain !== gain,
      );
      if (pending.length === 0) {
        setBalanceStatus('Already balanced');
        return;
      }

      const applied = await Promise.all(
        pending.map(async ([id, gain]) => {
          try {
            await setGain(id, gain);
            dispatchFilter({ type: FilterActionEnum.GAIN, id, newValue: gain });
            return true;
          } catch {
            return false;
          }
        }),
      );

      if (!isCurrentRun()) {
        return;
      }
      const succeeded = applied.filter(Boolean).length;
      if (succeeded < pending.length) {
        setBalanceStatus(`Applied ${succeeded} of ${pending.length} bands`);
      } else {
        setBalanceStatus(describeBalanceResult(result));
      }
    } catch (e) {
      if (!isCurrentRun()) {
        return;
      }
      // A failed measurement is a normal outcome (nothing playing, cancelled,
      // capture unavailable); report it in place rather than as a global
      // failure that would blank the whole workspace.
      if (e instanceof DOMException && e.name === 'AbortError') {
        setBalanceStatus('Cancelled - nothing changed');
      } else {
        setBalanceStatus(
          e instanceof Error ? e.message : 'Could not measure the output.',
        );
      }
    } finally {
      if (isCurrentRun()) {
        setIsBalancing(false);
        balanceAbortRef.current = undefined;
      }
    }
  };

  const resetSelectedGain = async () => {
    if (!selectedFilter || selectedFilter.gain === 0) {
      return;
    }
    try {
      await setGain(selectedFilter.id, 0);
      dispatchFilter({
        type: FilterActionEnum.GAIN,
        id: selectedFilter.id,
        newValue: 0,
      });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const handleFixedBand = (size: FixedBandSizeEnum) => async () => {
    try {
      const newFilters = await setFixedBand(size);
      dispatchFilter({
        type: FilterActionEnum.INIT,
        filters: newFilters,
      });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const addFilter = async () => {
    if (frequencySortedFilters.length >= MAX_NUM_FILTERS) {
      return;
    }

    const explicitSelectedFilter = selectedFilterIds
      .map((id) => filters[id])
      .find(Boolean);

    if (!explicitSelectedFilter) {
      const occupiedFrequencies = new Set(
        frequencySortedFilters.map((filter) => filter.frequency),
      );
      let frequency = 1000;
      while (occupiedFrequencies.has(frequency) && frequency <= MAX_FREQUENCY) {
        frequency += 1;
      }
      if (frequency > MAX_FREQUENCY) {
        frequency = 999;
        while (
          occupiedFrequencies.has(frequency) &&
          frequency >= MIN_FREQUENCY
        ) {
          frequency -= 1;
        }
        if (frequency < MIN_FREQUENCY) {
          return;
        }
      }
      try {
        const id = await addEqualizerSlider(frequency);
        dispatchFilter({
          type: FilterActionEnum.ADD,
          id,
          frequency,
        });
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
      return;
    }

    const selectedFilterIndex = frequencySortedFilters.findIndex(
      (filter) => filter.id === explicitSelectedFilter.id,
    );
    if (selectedFilterIndex === -1) {
      return;
    }

    const shouldAddToRight = explicitSelectedFilter.frequency >= 1000;
    const leftBoundary =
      frequencySortedFilters[
        shouldAddToRight ? selectedFilterIndex : selectedFilterIndex - 1
      ]?.frequency ?? MIN_FREQUENCY;
    const rightBoundary =
      frequencySortedFilters[
        shouldAddToRight ? selectedFilterIndex + 1 : selectedFilterIndex
      ]?.frequency ?? MAX_FREQUENCY;

    if (leftBoundary + 1 >= rightBoundary) {
      return;
    }

    const frequency = clamp(
      Math.round(Math.sqrt(leftBoundary * rightBoundary)),
      MIN_FREQUENCY,
      MAX_FREQUENCY,
    );

    const boundedFrequency = clamp(
      frequency,
      leftBoundary + 1,
      rightBoundary - 1,
    );

    try {
      const id = await addEqualizerSlider(boundedFrequency);
      dispatchFilter({
        type: FilterActionEnum.ADD,
        id,
        frequency: boundedFrequency,
      });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  return isLoading ? (
    <div className="center full row">
      <Spinner />
    </div>
  ) : (
    <>
      <div className="main-content-title">
        <div>
          <span className="eyebrow">FINE TUNE</span>
          <h4>Parametric EQ</h4>
        </div>
        <div className="eq-toolbar">
          <VoicingQuickPick />
          <Button
            ariaLabel={
              isBalancing
                ? 'Cancel Smart EQ measurement'
                : 'Smart EQ from live output'
            }
            isDisabled={!isBalancing && !isLiveOutputActive}
            className="small"
            handleChange={autoBalance}
          >
            {isBalancing ? 'Cancel' : 'Smart EQ'}
          </Button>
          {/* Off by default: the closed loop is the better answer almost
              always, and this throws away the user's tuning. */}
          <label className="eq-toolbar__option" htmlFor="smart-eq-from-flat">
            <input
              id="smart-eq-from-flat"
              type="checkbox"
              checked={measureFromFlat}
              disabled={isBalancing}
              onChange={(event) => setMeasureFromFlat(event.target.checked)}
            />
            <span title="Zero every band before listening. Use this when an existing cut is hiding the region it affects - the measurement cannot see through its own correction.">
              From flat
            </span>
          </label>
          {balanceStatus && (
            <span className="eq-toolbar__status" role="status">
              {balanceStatus}
            </span>
          )}
          <Button
            ariaLabel="Clear EQ"
            isDisabled={false}
            className="small subtle"
            handleChange={clearFilterGains}
          >
            Clear EQ
          </Button>
          <Button
            ariaLabel="Add EQ band"
            isDisabled={frequencySortedFilters.length >= MAX_NUM_FILTERS}
            className="small subtle"
            handleChange={addFilter}
          >
            Add band
          </Button>
          <div className="quick-layouts">
            <span>Quick layouts</span>
            {Object.values(FixedBandSizeEnum)
              .filter((s) => !Number.isNaN(Number(s)))
              .map((size) => (
                <Button
                  key={`${size}-band`}
                  ariaLabel={`${size} Band`}
                  isDisabled={false}
                  className="small"
                  handleChange={handleFixedBand(size as FixedBandSizeEnum)}
                >
                  {`${size} Band`}
                </Button>
              ))}
          </div>
        </div>
      </div>
      <div className={`main-content main-content--${density}`}>
        <div className="eq-scale" aria-hidden="true">
          <span>+20</span>
          <span>0 dB</span>
          <span>-20</span>
        </div>
        <div
          ref={bandsRef}
          className={`bands bands--${density} bands--${bandLayout}`}
          onPointerDown={handleBandsPointerDown}
          onPointerMove={handleBandsPointerMove}
          onPointerUp={finishBandSelection}
          onPointerCancel={finishBandSelection}
          style={
            { '--band-count': frequencySortedFilters.length } as CSSProperties
          }
        >
          {selectionBox && (
            <div
              className="bands__selection-box"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY),
              }}
            />
          )}
          {frequencySortedFilters.map((filter, index) => (
            <FrequencyBand
              key={filter.id}
              filter={filter}
              colorProgress={
                frequencySortedFilters.length > 1
                  ? index / (frequencySortedFilters.length - 1)
                  : 0
              }
              density={density}
              flatLayout
              isSelected={selectedFilterIds.includes(filter.id)}
              onSelect={(event) =>
                toggleFilterSelection(
                  filter.id,
                  event.ctrlKey || event.metaKey || event.shiftKey,
                )
              }
              isHovered={hoveredFilterId === filter.id}
              onHover={(isHovered) =>
                setHoveredFilterId(isHovered ? filter.id : '')
              }
              isMinSliderCount={
                frequencySortedFilters.length <= MIN_NUM_FILTERS
              }
              onGainChange={handleBandGainChange}
            />
          ))}
        </div>
        {selectedFilter && (
          <div className="eq-flat-editor">
            <div className="eq-flat-editor__identity">
              <span>Selected band</span>
              <strong>
                {selectedFilter.frequency >= 1000
                  ? `${Number((selectedFilter.frequency / 1000).toFixed(1))} kHz`
                  : `${selectedFilter.frequency} Hz`}
              </strong>
            </div>
            <div className="eq-flat-editor__control">
              <span>Filter</span>
              <Dropdown
                name="selected-band-filter-type"
                value={selectedFilter.type}
                options={FILTER_OPTIONS}
                isDisabled={!!globalError}
                placement="up"
                handleChange={async (newValue) => {
                  try {
                    await setType(selectedFilter.id, newValue);
                    dispatchFilter({
                      type: FilterActionEnum.TYPE,
                      id: selectedFilter.id,
                      newValue: newValue as FilterTypeEnum,
                    });
                  } catch (e) {
                    setGlobalError(e as ErrorDescription);
                  }
                }}
              />
            </div>
            <div className="eq-flat-editor__control">
              <span>Frequency</span>
              <NumberInput
                name="selected-band-frequency"
                value={selectedFilter.frequency}
                min={MIN_FREQUENCY}
                max={MAX_FREQUENCY}
                isDisabled={false}
                showArrows
                handleSubmit={(newValue) =>
                  updateSelectedGroup('frequency', newValue)
                }
              />
            </div>
            <div className="eq-flat-editor__control">
              <span>{isSelectedGainDisabled ? 'Gain · n/a' : 'Gain'}</span>
              {/* Band pass, notch, low pass and high pass have no gain
                  parameter in Equalizer APO at all — they shape by frequency
                  and Q alone. Showing the band's stale gain in a greyed-out
                  box read as "this value is set but ignored", so the field is
                  replaced by an explicit note instead. */}
              {isSelectedGainDisabled ? (
                <div
                  className="eq-flat-editor__gain-na"
                  title={`A ${FilterTypeToLabelMap[selectedFilter.type]} has no gain in Equalizer APO. Use Frequency and Q to shape it, or switch to a Peak or Shelf filter to set a level.`}
                >
                  Set by Q
                </div>
              ) : (
                <div className="eq-flat-editor__input-row">
                  <NumberInput
                    name="selected-band-gain"
                    value={selectedFilter.gain}
                    min={MIN_GAIN}
                    max={MAX_GAIN}
                    isDisabled={false}
                    floatPrecision={2}
                    showArrows
                    handleSubmit={(newValue) =>
                      updateSelectedGroup('gain', newValue)
                    }
                  />
                  <button
                    type="button"
                    className="eq-flat-editor__reset-gain"
                    aria-label="Reset selected gain to 0 dB"
                    title="Reset selected gain to 0 dB"
                    disabled={!!globalError || selectedFilter.gain === 0}
                    onClick={resetSelectedGain}
                  >
                    ↺
                  </button>
                </div>
              )}
            </div>
            <div className="eq-flat-editor__control">
              <span>Quality (Q)</span>
              <Knob
                name="selected-band-quality"
                value={selectedFilter.quality}
                min={MIN_QUALITY}
                max={MAX_QUALITY}
                isDisabled={false}
                step={0.01}
                handleChange={(newValue) =>
                  updateSelectedGroup('quality', newValue)
                }
              />
            </div>
            <button
              type="button"
              aria-label="Delete selected EQ band"
              className="eq-flat-editor__delete"
              disabled={frequencySortedFilters.length <= MIN_NUM_FILTERS}
              onClick={deleteSelectedFilter}
            >
              Delete band
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default MainContent;
