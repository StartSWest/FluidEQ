import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import DeviceProfiles from 'renderer/DeviceProfiles';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { readOutputEditor } from 'renderer/utils/outputEditor';
import {
  activateAudioDeviceProfile,
  getAudioDevices,
  getDeviceProfileSettings,
  setDefaultAudioDevice,
} from 'renderer/utils/equalizerApi';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  deferred,
  mainOutput,
  secondOutput,
  showOutputEditor,
} from '__tests__/utils/outputEditorFixture';

jest.mock('renderer/utils/equalizerApi', () => {
  const getAudioDevices = jest.fn();
  return {
    getAudioDevices,
    readKnownAudioDevices: () => getAudioDevices(),
    getDeviceProfileSettings: jest.fn(),
    activateAudioDeviceProfile: jest.fn(),
    setDefaultAudioDevice: jest.fn(),
    subscribeAudioDevices: () => () => undefined,
  };
});

const activate = jest.mocked(activateAudioDeviceProfile);
const readDevices = jest.mocked(getAudioDevices);
const setDefault = jest.mocked(setDefaultAudioDevice);
let main = mainOutput;
let editor = secondOutput;
const refreshState = jest.fn(async () => {
  showOutputEditor(main, editor);
});
const setGlobalError = jest.fn();
const mount = async () => {
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, refreshState, setGlobalError }}
    >
      <DeviceProfiles
        engine="fluid"
        onConfigureApo={jest.fn()}
        onAttachFluidEngine={jest.fn()}
      >
        <span>Main profiles</span>
      </DeviceProfiles>
    </FluidEqProviderWrapper>,
  );
  const picker = screen.getByRole('menu', { name: 'Output device' });
  await waitFor(() => expect(picker).toHaveAttribute('aria-disabled', 'false'));
  return picker;
};

beforeEach(() => {
  jest.resetAllMocks();
  main = mainOutput;
  editor = secondOutput;
  showOutputEditor(main, editor);
  readDevices.mockImplementation(async () =>
    [mainOutput, secondOutput].map((device) => ({
      ...device,
      isDefault: device.id === main.id,
    })),
  );
  jest
    .mocked(getDeviceProfileSettings)
    .mockResolvedValue({ version: 1, assignments: {} });
  refreshState.mockImplementation(async () => {
    showOutputEditor(main, editor);
  });
  activate.mockImplementation(async () => {
    editor = main;
  });
  setDefault.mockImplementation(async (id) => {
    main = id === secondOutput.id ? secondOutput : mainOutput;
    editor = main;
  });
});

it('opening the main selector returns the editor to main without swapping playback', async () => {
  const picker = await mount();
  const activation = deferred<void>();
  activate.mockImplementation(async () => {
    await activation.promise;
    editor = mainOutput;
  });
  fireEvent.click(picker);
  expect(activate).toHaveBeenCalledWith(mainOutput.id);
  expect(setDefault).not.toHaveBeenCalled();
  expect(picker).toHaveTextContent(mainOutput.name);
  await act(async () => {
    activation.resolve();
  });
  expect(readOutputEditor().editor?.device.id).toBe(mainOutput.id);
  expect(readOutputEditor().main?.id).toBe(mainOutput.id);
  expect(setDefault).not.toHaveBeenCalled();
  expect(setGlobalError).not.toHaveBeenCalled();
});

it('still changes main when an output is selected, after returning the editor', async () => {
  const picker = await mount();
  const activation = deferred<void>();
  activate.mockImplementation(async () => {
    await activation.promise;
    editor = mainOutput;
  });
  fireEvent.click(picker);
  fireEvent.click(screen.getByRole('menuitem', { name: secondOutput.name }));
  expect(activate).toHaveBeenCalledTimes(1);
  expect(setDefault).not.toHaveBeenCalled();
  await act(async () => {
    activation.resolve();
  });
  await waitFor(() => expect(setDefault).toHaveBeenCalledWith(secondOutput.id));
  expect(setDefault).toHaveBeenCalledTimes(1);
  expect(picker).toHaveTextContent(secondOutput.name);
  expect(readOutputEditor().main?.id).toBe(secondOutput.id);
  expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
});
