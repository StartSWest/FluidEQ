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

import { CSSProperties, useEffect, useMemo } from 'react';
import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  MAX_NUM_FILTERS,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_NUM_FILTERS,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import FrequencyBand from './components/FrequencyBand';
import { FilterActionEnum, useAquaContext } from './utils/AquaContext';
import './styles/MainContent.scss';
import Spinner from './icons/Spinner';
import { sortHelper } from './utils/utils';
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
    hoveredFilterId,
    setHoveredFilterId,
  } = useAquaContext();
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

  const selectedFilter = useMemo(
    () => filters[selectedFilterId] ?? frequencySortedFilters[0] ?? undefined,
    [filters, frequencySortedFilters, selectedFilterId],
  );

  useEffect(() => {
    if (
      (!selectedFilterId || !filters[selectedFilterId]) &&
      frequencySortedFilters[0]
    ) {
      setSelectedFilterId(frequencySortedFilters[0].id);
    }
  }, [filters, frequencySortedFilters, selectedFilterId, setSelectedFilterId]);

  const updateSelectedFilter = async (
    action: () => Promise<void>,
    dispatchAction: Parameters<typeof dispatchFilter>[0],
  ) => {
    try {
      await action();
      dispatchFilter(dispatchAction);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
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

  const clearFilterGains = async () => {
    try {
      await clearGains();
      setPreAmp(0);
      dispatchFilter({
        type: FilterActionEnum.CLEAR_GAINS,
      });
      window.dispatchEvent(new Event('fluideq-clear-autoeq-selection'));
    } catch (e) {
      setGlobalError(e as ErrorDescription);
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

    const boundaries = [
      { frequency: 20 },
      ...frequencySortedFilters,
      { frequency: 20000 },
    ];
    let widestGapIndex = 0;
    let widestRatio = 0;
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const ratio =
        boundaries[index + 1].frequency / boundaries[index].frequency;
      if (ratio > widestRatio) {
        widestRatio = ratio;
        widestGapIndex = index;
      }
    }
    const frequency = Math.round(
      Math.sqrt(
        boundaries[widestGapIndex].frequency *
          boundaries[widestGapIndex + 1].frequency,
      ),
    );

    try {
      const id = await addEqualizerSlider(frequency);
      dispatchFilter({ type: FilterActionEnum.ADD, id, frequency });
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
          className={`bands bands--${density}`}
          style={
            { '--band-count': frequencySortedFilters.length } as CSSProperties
          }
        >
          {frequencySortedFilters.map((filter) => (
            <FrequencyBand
              key={filter.id}
              filter={filter}
              density={density}
              flatLayout
              isSelected={selectedFilter?.id === filter.id}
              onSelect={() => setSelectedFilterId(filter.id)}
              isHovered={hoveredFilterId === filter.id}
              onHover={(isHovered) =>
                setHoveredFilterId(isHovered ? filter.id : '')
              }
              isMinSliderCount={
                frequencySortedFilters.length <= MIN_NUM_FILTERS
              }
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
                handleChange={(newValue) =>
                  updateSelectedFilter(
                    () => setType(selectedFilter.id, newValue),
                    {
                      type: FilterActionEnum.TYPE,
                      id: selectedFilter.id,
                      newValue: newValue as FilterTypeEnum,
                    },
                  )
                }
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
                  updateSelectedFilter(
                    () => setFrequency(selectedFilter.id, newValue),
                    {
                      type: FilterActionEnum.FREQUENCY,
                      id: selectedFilter.id,
                      newValue,
                    },
                  )
                }
              />
            </div>
            <div className="eq-flat-editor__control">
              <span>Gain</span>
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
                    updateSelectedFilter(
                      () => setGain(selectedFilter.id, newValue),
                      {
                        type: FilterActionEnum.GAIN,
                        id: selectedFilter.id,
                        newValue,
                      },
                    )
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
                  updateSelectedFilter(
                    () => setQuality(selectedFilter.id, newValue),
                    {
                      type: FilterActionEnum.QUALITY,
                      id: selectedFilter.id,
                      newValue,
                    },
                  )
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
