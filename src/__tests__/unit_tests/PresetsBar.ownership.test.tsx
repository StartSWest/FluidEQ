import '@testing-library/jest-dom';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAudioDevice, IDeviceProfileSettings } from 'common/constants';
import PresetsBar from 'renderer/PresetsBar';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { readOutputEditor } from 'renderer/utils/outputEditor';
import {
  activateAudioDeviceProfile,
  getDeviceProfileSettings,
  getPresetBaselineNames,
  restorePresetBaseline,
  setDefaultAudioDevice,
} from 'renderer/utils/equalizerApi';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  deferred,
  mainOutput,
  secondOutput,
  showOutputEditor,
} from '__tests__/utils/outputEditorFixture';

jest.mock('renderer/utils/equalizerApi', () => ({
  activateAudioDeviceProfile: jest.fn(),
  getDeviceProfileSettings: jest.fn(),
  getPresetBaselineNames: jest.fn(),
  restorePresetBaseline: jest.fn(),
  setDefaultAudioDevice: jest.fn(),
}));
jest.mock('renderer/audio/songSoundSession', () => ({
  keepSongSound: async () => undefined,
  yieldSongSound: async () => undefined,
}));

interface ICatalogue {
  device: IAudioDevice;
  names: string[];
  assigned: string;
  baselines: string[];
}

const fetchPresets = jest.fn<Promise<string[]>, [string?]>();
const loadPreset = jest.fn<Promise<void>, [string, string?]>();
const savePreset = jest.fn<Promise<void>, [string, string?]>();
const createPreset = jest.fn<Promise<string>, [string, string?]>();
const renamePreset = jest.fn<Promise<void>, [string, string, string?]>();
const deletePreset = jest.fn<Promise<void>, [string, string?]>();
const activate = jest.mocked(activateAudioDeviceProfile);
const readSettings = jest.mocked(getDeviceProfileSettings);
const readBaselines = jest.mocked(getPresetBaselineNames);
const restore = jest.mocked(restorePresetBaseline);
let catalogues: Record<string, ICatalogue>;
let main: IAudioDevice;
let editor: IAudioDevice;
const refreshState = jest.fn(async () => {
  showOutputEditor(main, editor);
});
const setGlobalError = jest.fn();
const catalogue = (id?: string) => {
  const result = id ? catalogues[id] : undefined;
  if (!result) {
    throw new Error(`A profile operation must name its output: ${id}`);
  }
  return result;
};
const settings = (): IDeviceProfileSettings => ({
  version: 1,
  assignments: Object.fromEntries(
    Object.values(catalogues).map((entry) => [
      entry.device.id,
      {
        deviceId: entry.device.id,
        deviceGuid: entry.device.guid,
        deviceName: entry.device.name,
        presetName: entry.assigned,
      },
    ]),
  ),
});
const renderBar = () => {
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, refreshState, setGlobalError }}
    >
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
};
const mount = async () => {
  renderBar();
  await screen.findByRole('menuitem', { name: 'Main sound' });
};
const switchMain = async () => {
  main = secondOutput;
  editor = secondOutput;
  await act(async () => {
    showOutputEditor(main, editor, 2);
  });
  await screen.findByRole('menuitem', { name: 'Second sound' });
};
const clickAction = async (action: string) => {
  const user = userEvent.setup();
  if (action === 'load') {
    await user.click(screen.getByRole('menuitem', { name: 'Shared' }));
  } else if (action === 'create') {
    await user.click(
      screen.getByLabelText('Start a new profile from the current EQ'),
    );
  } else if (action === 'save') {
    await user.click(screen.getByLabelText('Save settings to this profile'));
  } else if (action === 'restore') {
    await user.click(
      screen.getByLabelText(
        'Restore the last manually saved version of this profile',
      ),
    );
  } else {
    const row = screen.getByRole('menuitem', { name: 'Main sound' });
    await user.click(
      within(row).getByLabelText(action === 'rename' ? 'Edit' : 'Delete'),
    );
    if (action === 'rename') {
      const field = screen.getByLabelText('Edit profile name');
      await user.clear(field);
      await user.type(field, 'Renamed main');
    }
    await user.click(screen.getByLabelText('Accept'));
  }
};

beforeEach(() => {
  jest.resetAllMocks();
  main = mainOutput;
  editor = mainOutput;
  catalogues = {
    [mainOutput.id]: {
      device: mainOutput,
      names: ['Main sound', 'Shared'],
      assigned: 'Main sound',
      baselines: ['Main sound'],
    },
    [secondOutput.id]: {
      device: secondOutput,
      names: ['Second sound', 'Shared'],
      assigned: 'Shared',
      baselines: [],
    },
  };
  showOutputEditor(main, editor);
  refreshState.mockImplementation(async () => {
    showOutputEditor(main, editor);
  });
  activate.mockImplementation(async (id) => {
    editor = catalogue(id).device;
  });
  fetchPresets.mockImplementation(async (id) => [...catalogue(id).names]);
  readSettings.mockImplementation(async () => settings());
  readBaselines.mockImplementation(async (id) => [...catalogue(id).baselines]);
  loadPreset.mockImplementation(async (name, id) => {
    catalogue(id).assigned = name;
  });
  savePreset.mockResolvedValue(undefined);
  restore.mockResolvedValue(undefined);
  createPreset.mockImplementation(async (name, id) => {
    catalogue(id).names.push(name);
    catalogue(id).assigned = name;
    return name;
  });
  renamePreset.mockImplementation(async (oldName, name, id) => {
    const entry = catalogue(id);
    entry.names = entry.names.map((existing) =>
      existing === oldName ? name : existing,
    );
    if (entry.assigned === oldName) {
      entry.assigned = name;
    }
  });
  deletePreset.mockImplementation(async (name, id) => {
    const entry = catalogue(id);
    entry.names = entry.names.filter((existing) => existing !== name);
    if (entry.assigned === name) {
      entry.assigned = '';
    }
  });
});

it('keeps main profiles, its ON marker and its saved baseline while a secondary is edited', async () => {
  editor = secondOutput;
  showOutputEditor(main, editor);
  await mount();
  expect(fetchPresets).toHaveBeenCalledWith(mainOutput.id);
  expect(readBaselines).toHaveBeenCalledWith(mainOutput.id);
  expect(
    screen.getByRole('menuitem', { name: 'Main sound' }),
  ).toHaveTextContent('ON');
  expect(
    screen.getByRole('menuitem', { name: 'Shared' }),
  ).not.toHaveTextContent('ON');
  expect(screen.queryByText('Second sound')).not.toBeInTheDocument();
  expect(
    screen.getByLabelText(
      'Restore the last manually saved version of this profile',
    ),
  ).toHaveAttribute('aria-disabled', 'false');
  expect(activate).not.toHaveBeenCalled();
  expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
});

it.each(['load', 'create', 'save', 'restore', 'rename', 'delete'])(
  'returns to main before the %s action can mutate a profile',
  async (action) => {
    editor = secondOutput;
    showOutputEditor(main, editor);
    const entered = deferred<void>();
    activate.mockImplementation(async () => {
      await entered.promise;
      editor = mainOutput;
    });
    await mount();
    await clickAction(action);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(mainOutput.id);
    const mutations = [
      loadPreset,
      createPreset,
      savePreset,
      restore,
      renamePreset,
      deletePreset,
    ];
    mutations.forEach((mutation) => expect(mutation).not.toHaveBeenCalled());
    await act(async () => {
      entered.resolve();
      await entered.promise;
    });
    const mutation =
      mutations[
        ['load', 'create', 'save', 'restore', 'rename', 'delete'].indexOf(
          action,
        )
      ];
    await waitFor(() => expect(mutation).toHaveBeenCalled());
    const call = mutation.mock.calls[0];
    expect(call[call.length - 1]).toBe(mainOutput.id);
    expect(readOutputEditor().editor?.device.id).toBe(mainOutput.id);
    expect(readOutputEditor().main?.id).toBe(mainOutput.id);
    expect(setDefaultAudioDevice).not.toHaveBeenCalled();
    expect(setGlobalError).not.toHaveBeenCalled();
  },
);

it('publishes catalogue, assignment and baselines together and discards an older main reply', async () => {
  const oldNames = deferred<string[]>();
  const oldSettings = deferred<IDeviceProfileSettings>();
  const oldBaselines = deferred<string[]>();
  fetchPresets.mockReturnValueOnce(oldNames.promise);
  readSettings.mockReturnValueOnce(oldSettings.promise);
  readBaselines.mockReturnValueOnce(oldBaselines.promise);
  renderBar();
  const newBaselines = deferred<string[]>();
  readBaselines.mockReturnValueOnce(newBaselines.promise);
  main = secondOutput;
  editor = secondOutput;
  await act(async () => {
    showOutputEditor(main, editor, 2);
  });
  expect(
    screen.queryByRole('menuitem', { name: 'Second sound' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('menuitem', { name: 'Main sound' }),
  ).not.toBeInTheDocument();
  await act(async () => {
    newBaselines.resolve([]);
  });
  expect(await screen.findByRole('menuitem', { name: 'Shared' })).toHaveClass(
    'selected',
  );
  expect(screen.getByRole('menuitem', { name: 'Shared' })).toHaveTextContent(
    'ON',
  );
  expect(
    screen.getByLabelText(
      'Restore the last manually saved version of this profile',
    ),
  ).toHaveAttribute('aria-disabled', 'true');
  await act(async () => {
    oldNames.resolve(['Main sound']);
    oldSettings.resolve(settings());
    oldBaselines.resolve(['Main sound']);
  });
  expect(screen.queryByText('Main sound')).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Shared' })).toHaveClass(
    'selected',
  );
});

it('selects the new main’s assigned row even when both outputs use the same profile name', async () => {
  catalogues[mainOutput.id].assigned = 'Shared';
  await mount();
  const pendingLoad = deferred<void>();
  loadPreset.mockReturnValueOnce(pendingLoad.promise);
  await userEvent
    .setup()
    .click(screen.getByRole('menuitem', { name: 'Main sound' }));
  expect(screen.getByRole('menuitem', { name: 'Main sound' })).toHaveClass(
    'selected',
  );
  await switchMain();
  expect(screen.getByRole('menuitem', { name: 'Shared' })).toHaveClass(
    'selected',
  );
  expect(screen.getByRole('menuitem', { name: 'Shared' })).toHaveTextContent(
    'ON',
  );
  await act(async () => {
    pendingLoad.resolve();
  });
});

it.each(['create', 'delete', 'rename'] as const)(
  'ignores a late %s completion after main changes',
  async (action) => {
    const completion = deferred<void>();
    if (action === 'create') {
      createPreset.mockImplementationOnce(async () => {
        await completion.promise;
        return 'Old created';
      });
    } else if (action === 'delete') {
      deletePreset.mockReturnValueOnce(completion.promise);
    } else {
      renamePreset.mockReturnValueOnce(completion.promise);
    }
    await mount();
    await clickAction(action);
    const mutation = {
      create: createPreset,
      delete: deletePreset,
      rename: renamePreset,
    }[action];
    expect(mutation).toHaveBeenCalledTimes(1);
    await switchMain();
    const readsBeforeCompletion = fetchPresets.mock.calls.length;
    await act(async () => {
      completion.resolve();
      await completion.promise;
    });
    expect(fetchPresets).toHaveBeenCalledTimes(readsBeforeCompletion);
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByRole('menuitem', { name: 'Shared' })).toHaveClass(
      'selected',
    );
    expect(screen.getByRole('menuitem', { name: 'Shared' })).toHaveTextContent(
      'ON',
    );
    expect(screen.queryByText('Old created')).not.toBeInTheDocument();
    expect(screen.queryByText('Renamed main')).not.toBeInTheDocument();
    expect(loadPreset).not.toHaveBeenCalled();
    expect(setGlobalError).not.toHaveBeenCalled();
  },
);

it('does not select a created name when main changes during its catalogue refresh', async () => {
  await mount();
  const refreshed = deferred<string[]>();
  fetchPresets.mockReturnValueOnce(refreshed.promise);
  await clickAction('create');
  expect(createPreset).toHaveBeenCalledWith(
    'Untitled profile 1',
    mainOutput.id,
  );
  await switchMain();
  const refreshesBeforeReply = refreshState.mock.calls.length;
  await act(async () => {
    refreshed.resolve(['Main sound', 'Shared', 'Untitled profile 1']);
  });
  expect(screen.queryByText('Untitled profile 1')).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Shared' })).toHaveClass(
    'selected',
  );
  expect(refreshState).toHaveBeenCalledTimes(refreshesBeforeReply);
});
