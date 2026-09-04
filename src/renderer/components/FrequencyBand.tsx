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

import { ErrorDescription } from 'common/errors';
import {
  IFilter,
  MAX_GAIN,
  MIN_GAIN,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import IconButton, { IconName } from 'renderer/widgets/IconButton';
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useThrottleAndExecuteLatest } from 'renderer/utils/utils';
import { removeEqualizerSlider, setGain } from '../utils/equalizerApi';
import { requestBandMenu } from './BandMenu';
import { FilterActionEnum, useFluidEqContext } from '../utils/FluidEqContext';
import Slider from './Slider';
import '../styles/FrequencyBand.scss';

interface IFrequencyBandProps {
  filter: IFilter;
  isMinSliderCount: boolean;
  density?: 'full' | 'compact' | 'dense';
  flatLayout?: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
  onSelect?: (event: {
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }) => void;
  onHover?: (isHovered: boolean) => void;
  colorProgress?: number;
  onGainChange?: (filterId: string, newValue: number) => Promise<void>;
}

const FrequencyBand = forwardRef(
  (
    {
      filter,
      isMinSliderCount,
      density = 'full',
      flatLayout = false,
      isSelected = false,
      isHovered = false,
      onSelect,
      onHover,
      colorProgress = 0,
      onGainChange,
    }: IFrequencyBandProps,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    // How often a drag reaches the store and the engine: twenty times a
    // second. The thumb itself follows the pointer on every event (see
    // RangeInput); this is the cadence at which the response graph redraws
    // and Equalizer APO is told. A hundred milliseconds — ten a second — was
    // audible as steps while a band was dragged with music playing.
    const INTERVAL = 50;
    const { setGlobalError, dispatchFilter } = useFluidEqContext();
    const [isLoading, setIsLoading] = useState(false);
    const isRemoveDisabled = useMemo(
      () => isMinSliderCount || isLoading,
      [isLoading, isMinSliderCount],
    );
    // *** Define functions for updating filter values and obtain throttled versions of them  ***
    const normalSetGain = useCallback(
      async (newValue: number) => {
        /*
      Always dispatch first so that we don't see jitter in the sliders.
      This is because dispatch will trigger the ui rerender and ensure user inputs do not get
      out of order. This means that the backend will be "behind" what the frontend shows, but
      thats okay. In case of a backend error, we will rollback to the last backend snapshot.
      Consider the following case where the user increases the gain twice when we setGain first.
      On the first increase input, slider updates but we are stuck on setGain.
      On the second increase input, slider updates and the 2nd setGain is delayed by this hook.
      Then first setGain finishes and we dispatch. This results in the jitter.
      2nd setGain finishes and we dispatch again. Another jitter occurs.
      Note that the final UI state is correct, but the ui changes are strange.
    */
        if (onGainChange) {
          await onGainChange(filter.id, newValue);
          return;
        }
        dispatchFilter({
          type: FilterActionEnum.GAIN,
          id: filter.id,
          newValue,
        });
        await setGain(filter.id, newValue);
      },
      [dispatchFilter, filter.id, onGainChange],
    );

    const throttleSetGain = useThrottleAndExecuteLatest(
      normalSetGain,
      INTERVAL,
    );

    // *** Define handlers for handling changes in gain, frequency, quality and filter type ***
    const handleGainSubmit = useCallback(
      async (newValue: number) => {
        try {
          await throttleSetGain(newValue);
        } catch (e) {
          setGlobalError(e as ErrorDescription);
        }
      },
      [setGlobalError, throttleSetGain],
    );

    const isGainDisabled = useMemo(
      () =>
        NO_GAIN_FILTER_TYPES.some((filterType) => filterType === filter.type),
      [filter.type],
    );

    const onRemoveEqualizerSlider = async () => {
      if (isRemoveDisabled) {
        return;
      }

      setIsLoading(true);
      try {
        await removeEqualizerSlider(filter.id);
        dispatchFilter({ type: FilterActionEnum.REMOVE, id: filter.id });
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
      setIsLoading(false);
    };

    // Only the fallback: MainContent.scss sets --range-length per density and
    // per window size, which is what actually drives the track length.
    const sliderHeight = '132px';

    return (
      <div
        ref={ref}
        className={`col bandWrapper bandWrapper--${density}${isSelected ? ' is-selected' : ''}${isHovered ? ' is-hovered' : ''}`}
        data-filter-id={filter.id}
        title={`${filter.frequency} Hz / ${filter.gain.toFixed(2)} dB / Q ${filter.quality.toFixed(2)}`}
        // Select before the browser starts a slider drag so any interaction
        // with this band's controls updates the selected-band editor.
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect?.(event);
        }}
        // The same menu the band's handle on the graph opens.
        onContextMenu={(event) => {
          event.preventDefault();
          requestBandMenu(filter.id, event.clientX, event.clientY);
        }}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
      >
        {!flatLayout && (
          <IconButton
            icon={IconName.TRASH}
            className="removeFilter"
            handleClick={onRemoveEqualizerSlider}
            isDisabled={isRemoveDisabled}
          />
        )}
        {/* ONE SHAPE AT EVERY BAND COUNT.

            This used to render three different bands. At six it carried a type
            dropdown, a frequency number input, a gain input inside the slider
            and a quality input; at fifteen the two number inputs went; at
            thirty-one the dropdown went too. Four stacked controls against two,
            so the strip's height changed with the band count — and because the
            editor is content-sized, choosing 15 bands instead of 10 moved the
            whole panel and the graph underneath it. Picking a band count is a
            question about frequency resolution, and answering it should not
            rearrange the page.

            The narrowest form is the one kept, because it is the only one that
            fits at thirty-one and because everything the others added is
            already below: the Selected band editor gives type, frequency, gain
            and Q for whichever band is chosen, at every count, with more room
            than a column an eighth of the panel wide ever had. Inline copies of
            those controls were a second way to do the same thing that existed
            only when there was space for it. */}
        <div className="col band">
          <button
            type="button"
            className="band-frequency-caption"
            aria-label={`Edit ${filter.frequency} Hz band`}
            // Only a keyboard activation: a pointer press already reached the
            // wrapper above, and answering the click as well toggled a
            // Ctrl-click twice, which put the band straight back in the
            // selection it had just left. A click from Enter or Space has no
            // pointer and reports a detail of zero.
            onClick={(event) => {
              if (event.detail === 0) {
                onSelect?.(event);
              }
            }}
          >
            {filter.frequency >= 1000
              ? `${Number((filter.frequency / 1000).toFixed(1))}k`
              : filter.frequency}
          </button>
          <div className="col center slider">
            <Slider
              name={`${filter.frequency}-gain`}
              min={MIN_GAIN}
              max={MAX_GAIN}
              value={filter.gain}
              sliderHeight={sliderHeight}
              setValue={handleGainSubmit}
              isDisabled={isGainDisabled}
              colorProgress={colorProgress}
              showNumberInput={false}
            />
          </div>
          <span className="band-gain-caption">
            {filter.gain > 0 ? '+' : ''}
            {filter.gain.toFixed(1)}
          </span>
        </div>
      </div>
    );
  },
);

export default FrequencyBand;
