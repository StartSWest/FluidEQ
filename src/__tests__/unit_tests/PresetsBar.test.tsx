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
import userEvent from '@testing-library/user-event';
import PresetsBar, { PresetErrorEnum } from 'renderer/PresetsBar';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import { clearAndType, setup } from '__tests__/utils/userEventUtils';

describe('PresetListItem', () => {
  const samplePresetNames = ['Apple', 'Banana', 'Oranges'];
  const newPresetButtonLabel = 'Start a new profile from the current EQ';
  const savePresetButtonLabel = 'Save settings to preset';
  const editIconLabel = 'Edit';
  const editModeLabel = 'Edit Preset Name';
  const caseSensitiveContext = {
    ...defaultFluidEqContext,
    isCaseSensitiveFs: true,
  };

  const fetchPresets = jest.fn();
  const loadPreset = jest.fn();
  const savePreset = jest.fn();
  const createPreset = jest.fn();
  const renamePreset = jest.fn();
  const deletePreset = jest.fn();

  beforeEach(() => {
    fetchPresets.mockClear();
    loadPreset.mockClear();
    savePreset.mockClear();
    createPreset.mockClear();
    renamePreset.mockClear();
    deletePreset.mockClear();
  });

  it('should be empty', async () => {
    fetchPresets.mockResolvedValue([]);
    setup(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <PresetsBar
          fetchPresets={fetchPresets}
          loadPreset={loadPreset}
          savePreset={savePreset}
          createPreset={createPreset}
          renamePreset={renamePreset}
          deletePreset={deletePreset}
        />
      </FluidEqProviderWrapper>,
    );

    expect(
      await screen.findByText('No profiles yet. Create your first sound.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(samplePresetNames[0])).not.toBeInTheDocument();
    expect(fetchPresets).toHaveBeenCalledTimes(1);
  });

  it('should list the presets', async () => {
    fetchPresets.mockReturnValue(samplePresetNames);
    await act(async () => {
      setup(
        <FluidEqProviderWrapper value={defaultFluidEqContext}>
          <PresetsBar
            fetchPresets={fetchPresets}
            loadPreset={loadPreset}
            savePreset={savePreset}
            createPreset={createPreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </FluidEqProviderWrapper>,
      );
    });

    expect(screen.getByText(samplePresetNames[0])).toBeInTheDocument();
    expect(screen.getByText(samplePresetNames[1])).toBeInTheDocument();
    expect(screen.getByText(samplePresetNames[2])).toBeInTheDocument();
    expect(fetchPresets).toHaveBeenCalledTimes(1);
  });

  // Selecting a profile in the list is what attaches it to the active output;
  // there is no separate "load" button.
  it('should support loading a preset', async () => {
    fetchPresets.mockReturnValue(samplePresetNames);
    const { user } = await act(async () =>
      setup(
        <FluidEqProviderWrapper value={defaultFluidEqContext}>
          <PresetsBar
            fetchPresets={fetchPresets}
            loadPreset={loadPreset}
            savePreset={savePreset}
            createPreset={createPreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </FluidEqProviderWrapper>,
      ),
    );

    await user.click(screen.getByLabelText(samplePresetNames[0]));
    expect(loadPreset).toHaveBeenCalledTimes(1);
    expect(loadPreset).toHaveBeenCalledWith(samplePresetNames[0]);
  });

  it('updates the profile that is selected', async () => {
    fetchPresets.mockReturnValue(samplePresetNames);
    const { user } = await act(async () =>
      setup(
        <FluidEqProviderWrapper value={defaultFluidEqContext}>
          <PresetsBar
            fetchPresets={fetchPresets}
            loadPreset={loadPreset}
            savePreset={savePreset}
            createPreset={createPreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </FluidEqProviderWrapper>,
      ),
    );

    // Nothing selected yet, so there is nothing to update.
    const saveButton = screen.getByLabelText(savePresetButtonLabel);
    expect(saveButton).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByLabelText(samplePresetNames[1]));
    expect(saveButton).toHaveAttribute('aria-disabled', 'false');

    await user.click(saveButton);
    expect(savePreset).toHaveBeenCalledTimes(1);
    expect(savePreset).toHaveBeenCalledWith(samplePresetNames[1]);
  });

  it('creates a numbered profile rather than asking for a name', async () => {
    // "New profile" is the only way to make one now, so it has to produce a
    // usable name by itself instead of clearing a box for the user to fill.
    fetchPresets.mockReturnValue(samplePresetNames);
    const { user } = await act(async () =>
      setup(
        <FluidEqProviderWrapper value={defaultFluidEqContext}>
          <PresetsBar
            fetchPresets={fetchPresets}
            loadPreset={loadPreset}
            savePreset={savePreset}
            createPreset={createPreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </FluidEqProviderWrapper>,
      ),
    );

    await user.click(screen.getByLabelText(newPresetButtonLabel));
    expect(createPreset).toHaveBeenCalledTimes(1);
    expect(createPreset).toHaveBeenCalledWith('Untitled profile 1');
    // Never the update call: that one overwrites whatever it is given.
    expect(savePreset).not.toHaveBeenCalled();
  });

  it('should disallow invalid renamed presets for case sensitive systems', async () => {
    fetchPresets.mockReturnValue(samplePresetNames);
    const user = userEvent.setup();

    await act(async () => {
      setup(
        <FluidEqProviderWrapper value={caseSensitiveContext}>
          <PresetsBar
            fetchPresets={fetchPresets}
            loadPreset={loadPreset}
            savePreset={savePreset}
            createPreset={createPreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </FluidEqProviderWrapper>,
      );
    });

    // Assume we click the edit icon of the first preset which is Apple
    const editIcon = screen.getAllByLabelText(editIconLabel)[0];
    await user.click(editIcon);
    const editInput = screen.getByLabelText(editModeLabel);
    expect(editInput).toBeInTheDocument();

    // Restricted preset name
    await clearAndType(user, editInput, 'COM1');
    await user.keyboard('{Enter}');
    expect(screen.getByText(PresetErrorEnum.RESTRICTED)).toBeInTheDocument();

    // Exact duplicate exists
    await clearAndType(user, editInput, 'Banana');
    await user.keyboard('{Enter}');
    expect(screen.getByText(PresetErrorEnum.DUPLICATE)).toBeInTheDocument();

    // Allow name that differs by case only
    await clearAndType(user, editInput, 'bAnAnA');
    await user.keyboard('{Enter}');
    expect(screen.getByText('bAnAnA')).toBeInTheDocument();

    // Refetch editIcon and editInput because the elemnts were rerendered
    await user.click(screen.getAllByLabelText(editIconLabel)[0]);
    // Allow rename to the same name that differs by case only
    await clearAndType(user, screen.getByLabelText(editModeLabel), 'aPpLe');
    await user.keyboard('{Enter}');
    expect(screen.getByText('aPpLe')).toBeInTheDocument();
  });

  it('should disallow invalid renamed presets for case insensitive systems', async () => {
    fetchPresets.mockReturnValue(samplePresetNames);
    const user = userEvent.setup();

    await act(async () => {
      setup(
        <FluidEqProviderWrapper value={defaultFluidEqContext}>
          <PresetsBar
            fetchPresets={fetchPresets}
            loadPreset={loadPreset}
            savePreset={savePreset}
            createPreset={createPreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </FluidEqProviderWrapper>,
      );
    });

    // Assume we click the edit icon of the first preset which is Apple
    const editIcon = screen.getAllByLabelText(editIconLabel)[0];
    await user.click(editIcon);
    const editInput = screen.getByLabelText(editModeLabel);
    expect(editInput).toBeInTheDocument();

    // Restricted preset name
    await clearAndType(user, editInput, 'COM1');
    await user.keyboard('{Enter}');
    expect(screen.getByText(PresetErrorEnum.RESTRICTED)).toBeInTheDocument();

    // Exact duplicate exists
    await clearAndType(user, editInput, 'Banana');
    await user.keyboard('{Enter}');
    expect(screen.getByText(PresetErrorEnum.DUPLICATE)).toBeInTheDocument();

    // Duplicate that differs only by case exists
    await clearAndType(user, editInput, 'bAnAnA');
    await user.keyboard('{Enter}');
    expect(screen.getByText(PresetErrorEnum.DUPLICATE)).toBeInTheDocument();

    // Allow rename to the same name that differs by case only
    await clearAndType(user, editInput, 'aPpLe');
    await user.keyboard('{Enter}');
    expect(screen.getByText('aPpLe')).toBeInTheDocument();
  });
});
