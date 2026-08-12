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
import { act, screen } from '@testing-library/react';
import { setup } from '../utils/userEventUtils';
import Dropdown from '../../renderer/widgets/Dropdown';
import { FILTER_OPTIONS } from '../../renderer/icons/FilterTypeIcon';
import { FilterTypeEnum, FilterTypeToLabelMap } from '../../common/constants';

describe('Dropdown', () => {
  const name = 'dropdown';
  const handleChange = jest.fn();

  beforeEach(() => {
    handleChange.mockClear();
  });

  it('should render the dropdown and click on an item', async () => {
    const filterType = FilterTypeEnum.PK;
    const { user } = setup(
      <Dropdown
        name={name}
        value={filterType}
        options={FILTER_OPTIONS}
        isDisabled={false}
        handleChange={handleChange}
      />,
    );

    const value = screen.getByTitle(FilterTypeToLabelMap[filterType]);
    expect(value).toBeInTheDocument();
    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    expect(screen.getByLabelText(`${name}-items`)).toBeInTheDocument();

    const newFilterType = FilterTypeEnum.LSC;
    const newValue = screen.getByLabelText(FilterTypeToLabelMap[newFilterType]);
    expect(newValue).toBeInTheDocument();
    await user.click(newValue);
    expect(handleChange).toHaveBeenCalledWith(newFilterType);
  });

  it('should render the dropdown and select an item using keys', async () => {
    const filterType = FilterTypeEnum.LSC;
    const { user } = setup(
      <Dropdown
        name={name}
        value={filterType}
        options={FILTER_OPTIONS}
        isDisabled={false}
        handleChange={handleChange}
      />,
    );

    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    const item = screen.getByLabelText(FilterTypeToLabelMap[filterType]);
    expect(item).toHaveFocus();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(handleChange).toHaveBeenCalledWith(FilterTypeEnum.HSC);
  });

  it('should render the dropdown and select an item using tab', async () => {
    const filterType = FilterTypeEnum.LSC;
    const { user } = setup(
      <Dropdown
        name={name}
        value={filterType}
        options={FILTER_OPTIONS}
        isDisabled={false}
        handleChange={handleChange}
      />,
    );

    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    const item = screen.getByLabelText(FilterTypeToLabelMap[filterType]);
    expect(item).toHaveFocus();

    await user.keyboard('{Tab}{Enter}');
    expect(handleChange).toHaveBeenCalledWith(FilterTypeEnum.HSC);
  });

  it('should prevent using arrow keys to leave the dropdown menu', async () => {
    const { user } = setup(
      <div>
        <button type="button">Above</button>
        <Dropdown
          name={name}
          value={FILTER_OPTIONS[0].value}
          options={FILTER_OPTIONS}
          isDisabled={false}
          handleChange={handleChange}
        />
        <button type="button">Below</button>
      </div>,
    );
    // Open the dropdown menu
    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    const firstItem = screen.getByLabelText(FILTER_OPTIONS[0].label);
    expect(firstItem).toHaveFocus();

    // Use tab to navigate above the dropdown menu
    await user.keyboard('{Shift>}{ArrowUp}{ArrowUp}{/Shift}'); // Hold Shift down when pressing Tab
    expect(firstItem).toHaveFocus();

    // Use tab to navigate below the dropdown menu
    const tabInstructions = Array(FILTER_OPTIONS.length)
      .fill('{ArrowDown}')
      .join('');
    await user.keyboard(tabInstructions);
    const lastItem = screen.getByLabelText(
      FILTER_OPTIONS[FILTER_OPTIONS.length - 1].label,
    );
    expect(lastItem).toHaveFocus();
  });

  it('should allow using tab to leave the dropdown menu', async () => {
    const { user } = setup(
      <div>
        <button type="button">Above</button>
        <Dropdown
          name={name}
          value={FILTER_OPTIONS[0].value}
          options={FILTER_OPTIONS}
          isDisabled={false}
          handleChange={handleChange}
        />
        <button type="button">Below</button>
      </div>,
    );
    // Open the dropdown menu
    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    let menuItem = screen.getByLabelText(FILTER_OPTIONS[0].label);
    expect(menuItem).toHaveFocus();
    // Use tab to navigate above the dropdown menu
    await user.keyboard('{Shift>}{Tab}{Tab}{/Shift}'); // Hold Shift down when pressing Tab
    expect(screen.getByText('Above')).toHaveFocus();
    expect(menuItem).not.toBeInTheDocument();

    // Open the dropdown menu
    await user.click(dropdown);
    menuItem = screen.getByLabelText(FILTER_OPTIONS[0].label);
    expect(menuItem).toHaveFocus();
    // Use tab to navigate below the dropdown menu
    const tabInstructions = Array(FILTER_OPTIONS.length).fill('{Tab}').join('');
    await user.keyboard(tabInstructions);
    expect(screen.getByText('Below')).toHaveFocus();
    expect(menuItem).not.toBeInTheDocument();
  });

  it('should disable the dropdown', async () => {
    const filterType = FilterTypeEnum.LSC;
    const { user } = setup(
      <Dropdown
        name={name}
        value={filterType}
        options={FILTER_OPTIONS}
        isDisabled
        handleChange={handleChange}
      />,
    );

    const value = screen.getByTitle(FilterTypeToLabelMap[filterType]);
    expect(value).toBeInTheDocument();
    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    expect(
      screen.queryByLabelText(FilterTypeToLabelMap[filterType]),
    ).not.toBeInTheDocument();
  });

  it('should close the dropdown when clicking outside', async () => {
    const filterType = FilterTypeEnum.PK;
    const { user } = setup(
      <div>
        <Dropdown
          name={name}
          value={filterType}
          options={FILTER_OPTIONS}
          isDisabled={false}
          handleChange={handleChange}
        />
        <div>Outside</div>
      </div>,
    );

    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    const item = screen.getByLabelText(FilterTypeToLabelMap[filterType]);
    expect(item).toHaveFocus();

    await user.click(screen.getByText('Outside'));
    expect(item).not.toBeInTheDocument();
  });

  it('should close the dropdown when focus moves outside', async () => {
    const filterType = FilterTypeEnum.PK;
    const { user } = setup(
      <div>
        <Dropdown
          name={name}
          value={filterType}
          options={FILTER_OPTIONS}
          isDisabled={false}
          handleChange={handleChange}
        />
        <button type="button">Outside</button>
      </div>,
    );

    const dropdown = screen.getByLabelText(name);
    await user.click(dropdown);
    const item = screen.getByLabelText(FilterTypeToLabelMap[filterType]);
    expect(item).toHaveFocus();

    // Need this because the focus triggers a state update and so we need to wait
    act(() => {
      screen.getByText('Outside').focus();
    });
    expect(item).not.toBeInTheDocument();
  });

  it('should show user set placeholder text when value matches no existing option', async () => {
    setup(
      <div>
        <Dropdown
          name={name}
          value=""
          options={FILTER_OPTIONS}
          isDisabled={false}
          handleChange={handleChange}
          noSelectionPlaceholder="NO SELECTION"
        />
        <button type="button">Outside</button>
      </div>,
    );

    const dropdown = screen.getByLabelText(name);
    expect(dropdown.textContent).toBe('NO SELECTION');
  });

  it('should show user set placeholder text when there are no options', async () => {
    const filterType = FilterTypeEnum.PK;
    setup(
      <div>
        <Dropdown
          name={name}
          value={filterType}
          options={[]}
          isDisabled={false}
          handleChange={handleChange}
          emptyOptionsPlaceholder="NO OPTIONS"
        />
        <button type="button">Outside</button>
      </div>,
    );

    const dropdown = screen.getByLabelText(name);
    expect(dropdown.textContent).toBe('NO OPTIONS');
  });

  it('should find options by any word, regardless of order or case', async () => {
    const options = [
      {
        value: 'Razer Kraken V3 Pro',
        label: 'Razer Kraken V3 Pro',
        display: <div>Razer Kraken V3 Pro</div>,
      },
      {
        value: 'Razer BlackShark V2 Pro',
        label: 'Razer BlackShark V2 Pro',
        display: <div>Razer BlackShark V2 Pro</div>,
      },
    ];
    const { user } = setup(
      <Dropdown
        name={name}
        value=""
        options={options}
        isDisabled={false}
        isFilterable
        handleChange={handleChange}
      />,
    );

    await user.click(screen.getByLabelText(name));
    const search = screen.getByLabelText('Filter audio devices');
    expect(search).toHaveFocus();
    await user.type(search, 'pro KRAKEN');

    expect(screen.getByLabelText('Razer Kraken V3 Pro')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Razer BlackShark V2 Pro'),
    ).not.toBeInTheDocument();
  });

  it('should find partial model names without the brand prefix', async () => {
    const options = [
      {
        value: 'Razer Kraken Ultimate',
        label: 'Razer Kraken Ultimate',
        display: <div>Razer Kraken Ultimate</div>,
      },
    ];
    const { user } = setup(
      <Dropdown
        name={name}
        value=""
        options={options}
        isDisabled={false}
        isFilterable
        handleChange={handleChange}
      />,
    );

    await user.click(screen.getByLabelText(name));
    await user.type(screen.getByLabelText('Filter audio devices'), 'krak');

    expect(screen.getByLabelText('Razer Kraken Ultimate')).toBeInTheDocument();
  });

  it('offers recent searches and records the query used for a selection', async () => {
    const options = [
      {
        value: 'Sennheiser HD 600',
        label: 'Sennheiser HD 600',
        display: <div>Sennheiser HD 600</div>,
      },
      {
        value: 'Razer Kraken Ultimate',
        label: 'Razer Kraken Ultimate',
        display: <div>Razer Kraken Ultimate</div>,
      },
    ];
    const commitSearch = jest.fn();
    const clearHistory = jest.fn();
    const { user } = setup(
      <Dropdown
        name={name}
        value=""
        options={options}
        isDisabled={false}
        isFilterable
        searchHistory={['HD 600', 'Kraken']}
        onSearchCommit={commitSearch}
        onClearSearchHistory={clearHistory}
        handleChange={handleChange}
      />,
    );

    await user.click(screen.getByLabelText(name));
    expect(screen.getByText('Recent searches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'HD 600' }));
    expect(screen.getByLabelText('Sennheiser HD 600')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Razer Kraken Ultimate'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Sennheiser HD 600'));
    expect(commitSearch).toHaveBeenCalledWith('HD 600');
    expect(handleChange).toHaveBeenCalledWith('Sennheiser HD 600');
  });

  it('can clear recent searches from the filter menu', async () => {
    const clearHistory = jest.fn();
    const { user } = setup(
      <Dropdown
        name={name}
        value=""
        options={FILTER_OPTIONS}
        isDisabled={false}
        isFilterable
        searchHistory={['headphones']}
        onClearSearchHistory={clearHistory}
        handleChange={handleChange}
      />,
    );

    await user.click(screen.getByLabelText(name));
    await user.click(
      screen.getByRole('button', { name: 'Clear recent searches' }),
    );
    expect(clearHistory).toHaveBeenCalledTimes(1);
  });
});
