import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SecondOutputProfilePicker from '../../renderer/SecondOutputProfilePicker';
import { assignDeviceProfile } from '../../renderer/utils/equalizerApi';

jest.mock('../../renderer/utils/equalizerApi', () => ({
  assignDeviceProfile: jest.fn(),
}));
const device = {
  id: 'speakers',
  guid: '{speakers}',
  name: 'Speakers',
  isDefault: false,
  isActive: true,
};
const getProfiles = jest.fn();
const assign = jest.mocked(assignDeviceProfile);
beforeEach(() => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { getOutputMirrorProfiles: getProfiles } },
  });
  getProfiles
    .mockReset()
    .mockResolvedValue({ current: 'Warm', names: ['Warm', 'Clear'] });
  assign.mockReset().mockResolvedValue(undefined);
});

it('shows this output’s saved profile and changes only this output', async () => {
  const changed = jest.fn().mockResolvedValue(undefined);
  render(
    <SecondOutputProfilePicker
      device={device}
      presetName="Warm"
      onChanged={changed}
    />,
  );
  const picker = screen.getByRole('menu');
  await waitFor(() => expect(picker).toHaveAttribute('aria-disabled', 'false'));
  expect(getProfiles).toHaveBeenCalledWith('speakers');
  expect(picker).toHaveTextContent('Warm');
  fireEvent.click(picker);
  getProfiles.mockResolvedValue({ current: 'Clear', names: ['Warm', 'Clear'] });
  fireEvent.click(screen.getByText('Clear'));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(assign).toHaveBeenCalledWith(
    {
      deviceId: 'speakers',
      deviceGuid: '{speakers}',
      deviceName: 'Speakers',
      presetName: 'Clear',
    },
    true,
  );
  expect(picker).toHaveTextContent('Clear');
});

it('keeps an unassigned output neutral instead of claiming the first saved profile', async () => {
  getProfiles.mockResolvedValue({ current: '', names: ['Warm'] });
  render(
    <SecondOutputProfilePicker
      device={device}
      presetName=""
      onChanged={jest.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('menu')).toHaveAttribute('aria-disabled', 'false'),
  );
  expect(screen.getByRole('menu')).toHaveTextContent('Neutral');
  expect(assign).not.toHaveBeenCalled();
});
