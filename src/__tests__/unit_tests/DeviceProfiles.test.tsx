import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import DeviceProfiles from 'renderer/DeviceProfiles';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import {
  getAudioDevices,
  getDeviceProfileSettings,
} from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  getAudioDevices: jest.fn(),
  getDeviceProfileSettings: jest.fn(),
  setDefaultAudioDevice: jest.fn(),
}));

const missingApoDevice = {
  id: 'speakers',
  name: 'USB Speakers',
  guid: '{SPEAKERS}',
  isDefault: true,
  isActive: true,
  isEqualizerApoAttached: false,
};

const renderProfiles = (onConfigureApo = jest.fn(async () => true)) => {
  (getAudioDevices as jest.Mock).mockResolvedValue([missingApoDevice]);
  (getDeviceProfileSettings as jest.Mock).mockResolvedValue({
    version: 1,
    assignments: {},
  });
  render(
    <FluidEqProviderWrapper value={defaultFluidEqContext}>
      <DeviceProfiles onConfigureApo={onConfigureApo} />
    </FluidEqProviderWrapper>,
  );
  return onConfigureApo;
};

describe('DeviceProfiles Equalizer APO attachment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the missing badge but lets Cancel dismiss the device notice', async () => {
    renderProfiles();

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'USB Speakers',
    );
    expect(screen.getAllByText('APO OFF')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('APO OFF')).toBeInTheDocument();
  });

  it('opens the Device Selector and dismisses the notice after it starts', async () => {
    const onConfigureApo = renderProfiles();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Enable in Device Selector' }),
    );

    await waitFor(() => expect(onConfigureApo).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
  });

  it('does not guess when endpoint attachment could not be read', async () => {
    (getAudioDevices as jest.Mock).mockResolvedValue([
      { ...missingApoDevice, isEqualizerApoAttached: null },
    ]);
    (getDeviceProfileSettings as jest.Mock).mockResolvedValue({
      version: 1,
      assignments: {},
    });

    render(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <DeviceProfiles onConfigureApo={jest.fn(async () => true)} />
      </FluidEqProviderWrapper>,
    );

    await screen.findByText('USB Speakers');
    expect(screen.queryByText('APO OFF')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
