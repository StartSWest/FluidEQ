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

import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import {
  FilterTypeEnum,
  NO_GAIN_FILTER_TYPES,
  getDefaultFilterWithId,
} from 'common/constants';
import FrequencyBand from 'renderer/components/FrequencyBand';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import { setup } from '../utils/userEventUtils';

describe('FrequencyBand', () => {
  const filter = getDefaultFilterWithId();
  const filterTypeDropdownLabel = `${filter.frequency}-filter-type`;
  const filterGainNumberLabel = `${filter.frequency}-gain-number`;
  const filterGainRangeLabel = `${filter.frequency}-gain-range`;
  const trashIconLabel = 'Trash Icon';
  const handleSubmit = jest.fn();

  beforeEach(() => {
    handleSubmit.mockClear();
  });

  it('should render with name', () => {
    setup(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <FrequencyBand filter={filter} isMinSliderCount={false} />
      </FluidEqProviderWrapper>,
    );
    expect(screen.getByLabelText(filterTypeDropdownLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(trashIconLabel)).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('should enable gain when filter type is affected by gain', () => {
    setup(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        {Object.values(FilterTypeEnum)
          .filter(
            (filterType) =>
              !NO_GAIN_FILTER_TYPES.some(
                (noGainFilterType) => noGainFilterType === filterType,
              ),
          )
          .map((filterType) => {
            return (
              <FrequencyBand
                key={filterType}
                filter={{ ...filter, type: filterType }}
                isMinSliderCount={false}
              />
            );
          })}
      </FluidEqProviderWrapper>,
    );
    const gainNumberInputs = screen.getAllByLabelText(filterGainNumberLabel);
    gainNumberInputs.forEach((input) => expect(input).not.toBeDisabled());
    const gainRangeInputs = screen.getAllByLabelText(filterGainRangeLabel);
    gainRangeInputs.forEach((input) => expect(input).not.toBeDisabled());
  });

  it('should disable gain when filter type is not affected by gain', () => {
    setup(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        {NO_GAIN_FILTER_TYPES.map((filterType) => (
          <FrequencyBand
            key={filterType}
            filter={{ ...filter, type: filterType }}
            isMinSliderCount={false}
          />
        ))}
      </FluidEqProviderWrapper>,
    );
    const gainNumberInputs = screen.getAllByLabelText(filterGainNumberLabel);
    gainNumberInputs.forEach((input) => expect(input).toBeDisabled());
    const gainRangeInputs = screen.getAllByLabelText(filterGainRangeLabel);
    gainRangeInputs.forEach((input) => expect(input).toBeDisabled());
  });

  it('should prevent deleting when min slider count is met', () => {
    setup(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <FrequencyBand filter={filter} isMinSliderCount />
      </FluidEqProviderWrapper>,
    );
    expect(screen.getByLabelText(trashIconLabel)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('keeps the gain slider usable in dense layouts without wide inputs', () => {
    const { container } = setup(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <FrequencyBand
          filter={filter}
          isMinSliderCount={false}
          density="dense"
          flatLayout
        />
      </FluidEqProviderWrapper>,
    );

    expect(container.querySelector('.bandWrapper--dense')).toBeInTheDocument();
    expect(screen.getByLabelText(filterGainRangeLabel)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(filterGainNumberLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(filterTypeDropdownLabel),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(trashIconLabel)).not.toBeInTheDocument();
  });
});
