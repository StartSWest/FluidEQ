import '@testing-library/jest-dom';
import type { ReactElement } from 'react';
import ProfileTestProvider from '__tests__/utils/profileTestProvider';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import OutputEditingNotice from 'renderer/OutputEditingNotice';
import OutputProfileSelect from 'renderer/OutputProfileSelect';
import SecondOutputProfilePicker from 'renderer/SecondOutputProfilePicker';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { readOutputEditor } from 'renderer/utils/outputEditor';
import {
  activateAudioDeviceProfile,
  assignDeviceProfile,
  setDefaultAudioDevice,
} from 'renderer/utils/equalizerApi';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  deferred,
  mainOutput,
  secondOutput,
  showOutputEditor,
} from '__tests__/utils/outputEditorFixture';

const renderProfiles = (view: ReactElement) =>
  render(view, { wrapper: ProfileTestProvider });

jest.mock('renderer/utils/equalizerApi', () => ({
  assignDeviceProfile: jest.fn(),
  activateAudioDeviceProfile: jest.fn(),
  setDefaultAudioDevice: jest.fn(),
}));

interface ICatalogue {
  current: string;
  names: string[];
}
const getProfiles = jest.fn<Promise<ICatalogue>, [string]>();
const assign = jest.mocked(assignDeviceProfile);
const changed = jest.fn<Promise<void>, []>();
let current = 'Warm';
const pickerName = `EQ profile — ${secondOutput.name}`;

beforeEach(() => {
  jest.resetAllMocks();
  current = 'Warm';
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      platform: 'win32',
      ipcRenderer: { getOutputMirrorProfiles: getProfiles },
    },
  });
  showOutputEditor(mainOutput, secondOutput);
  getProfiles.mockImplementation(async () => ({
    current,
    names: ['Warm', 'Clear'],
  }));
  assign.mockResolvedValue(undefined);
  changed.mockResolvedValue(undefined);
});

it('keeps the heading and Second output selector synchronized without swapping outputs', async () => {
  renderProfiles(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, refreshState: changed }}
    >
      <section aria-label="Editor heading">
        <OutputEditingNotice />
      </section>
      <section aria-label="Second output card">
        <SecondOutputProfilePicker
          device={secondOutput}
          engine="fluid"
          presetName="Warm"
          onChanged={changed}
        />
      </section>
    </FluidEqProviderWrapper>,
  );
  const heading = within(
    screen.getByRole('region', { name: 'Editor heading' }),
  ).getByRole('menu', { name: pickerName });
  const sidebar = within(
    screen.getByRole('region', { name: 'Second output card' }),
  ).getByRole('menu', { name: pickerName });
  await waitFor(() =>
    expect(heading).toHaveAttribute('aria-disabled', 'false'),
  );
  expect(sidebar).toHaveTextContent('Warm');
  expect(heading).toHaveTextContent('Warm');
  expect(getProfiles.mock.calls).toEqual([
    [secondOutput.id],
    [secondOutput.id],
  ]);

  const completion = deferred<void>();
  assign.mockReturnValueOnce(completion.promise);
  fireEvent.click(heading);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
  expect(assign).toHaveBeenCalledWith(
    {
      deviceId: secondOutput.id,
      deviceGuid: secondOutput.guid,
      deviceName: secondOutput.name,
      presetName: 'Clear',
    },
    true,
  );
  expect(heading).toHaveAttribute('aria-disabled', 'true');

  current = 'Clear';
  await act(async () => {
    window.dispatchEvent(new Event('fluideq-output-changed'));
    completion.resolve();
  });
  expect(heading).toHaveTextContent('Clear');
  expect(sidebar).toHaveTextContent('Clear');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(readOutputEditor().main?.id).toBe(mainOutput.id);
  expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
  expect(activateAudioDeviceProfile).not.toHaveBeenCalled();
  expect(setDefaultAudioDevice).not.toHaveBeenCalled();

  // The other surface is a control too, and receives the same update back.
  assign.mockImplementationOnce(async () => {
    current = 'Warm';
    window.dispatchEvent(new Event('fluideq-output-changed'));
  });
  fireEvent.click(sidebar);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Warm' }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  expect(heading).toHaveTextContent('Warm');
  expect(sidebar).toHaveTextContent('Warm');
  expect(assign).toHaveBeenLastCalledWith(
    expect.objectContaining({ deviceId: secondOutput.id, presetName: 'Warm' }),
    true,
  );
  expect(setDefaultAudioDevice).not.toHaveBeenCalled();
});

it('shows a loading selector until the catalogue can confirm a neutral assignment', async () => {
  const reading = deferred<ICatalogue>();
  getProfiles.mockReturnValueOnce(reading.promise);
  renderProfiles(
    <OutputProfileSelect device={secondOutput} onChanged={changed} />,
  );
  const picker = screen.getByRole('menu', { name: pickerName });
  expect(picker).toHaveAttribute('aria-disabled', 'true');
  expect(picker).not.toHaveTextContent('Neutral');
  expect(picker).not.toHaveTextContent('Warm');
  await act(async () => {
    reading.resolve({ current: '', names: ['Warm'] });
  });
  expect(picker).toHaveAttribute('aria-disabled', 'false');
  expect(picker).toHaveTextContent('Neutral');
  expect(assign).not.toHaveBeenCalled();
});

it('discards a catalogue read that completes behind a newer output-state notification', async () => {
  const old = deferred<ICatalogue>();
  const fresh = deferred<ICatalogue>();
  getProfiles
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(fresh.promise);
  renderProfiles(
    <OutputProfileSelect
      device={secondOutput}
      presetName="Warm"
      onChanged={changed}
    />,
  );
  act(() => {
    window.dispatchEvent(new Event('fluideq-output-changed'));
  });
  await act(async () => {
    fresh.resolve({ current: 'Clear', names: ['Warm', 'Clear'] });
  });
  expect(screen.getByRole('menu', { name: pickerName })).toHaveTextContent(
    'Clear',
  );
  await act(async () => {
    old.resolve({ current: 'Warm', names: ['Warm'] });
  });
  expect(screen.getByRole('menu', { name: pickerName })).toHaveTextContent(
    'Clear',
  );
  expect(assign).not.toHaveBeenCalled();
});

it('cannot publish the old secondary’s catalogue after the editor heading changes output', async () => {
  const old = deferred<ICatalogue>();
  getProfiles.mockReturnValueOnce(old.promise);
  renderProfiles(<OutputEditingNotice />);
  const other = {
    ...secondOutput,
    id: 'receiver',
    guid: '{RECEIVER}',
    name: 'Other receiver',
  };
  getProfiles.mockResolvedValueOnce({
    current: 'Receiver sound',
    names: ['Receiver sound'],
  });
  await act(async () => {
    showOutputEditor(mainOutput, other, 2);
  });
  const picker = screen.getByRole('menu', {
    name: `EQ profile — ${other.name}`,
  });
  expect(picker).toHaveTextContent('Receiver sound');
  await act(async () => {
    old.resolve({ current: 'Warm', names: ['Warm'] });
  });
  expect(picker).toHaveTextContent('Receiver sound');
  expect(
    screen.queryByRole('menu', { name: pickerName }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Warm')).not.toBeInTheDocument();
});
