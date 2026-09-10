import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import type { TAudioEngine } from 'common/audioEngine';
import en from 'common/i18n/en';
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

const attached = { ok: true, declined: false, endpoints: [] };

interface IRenderOptions {
  engine?: TAudioEngine | null;
  device?: Record<string, unknown>;
  onConfigureApo?: jest.Mock;
  onAttachFluidEngine?: jest.Mock;
}

const renderProfiles = ({
  engine = 'apo',
  device = missingApoDevice,
  onConfigureApo = jest.fn(async () => true),
  onAttachFluidEngine = jest.fn(async () => attached),
}: IRenderOptions = {}) => {
  (getAudioDevices as jest.Mock).mockResolvedValue([device]);
  (getDeviceProfileSettings as jest.Mock).mockResolvedValue({
    version: 1,
    assignments: {},
  });
  render(
    <FluidEqProviderWrapper value={defaultFluidEqContext}>
      <DeviceProfiles
        engine={engine}
        onConfigureApo={onConfigureApo}
        onAttachFluidEngine={onAttachFluidEngine}
      />
    </FluidEqProviderWrapper>,
  );
  return { onConfigureApo, onAttachFluidEngine };
};

describe('DeviceProfiles Equalizer APO attachment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the missing badge but lets Not now dismiss the device notice', async () => {
    renderProfiles();

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'USB Speakers',
    );
    expect(screen.getAllByText(en['output.off'])).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: en['output.notNow'] }));

    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByText(en['output.off'])).toBeInTheDocument();
  });

  it('opens the Device Selector and dismisses the notice after it starts', async () => {
    const { onConfigureApo } = renderProfiles();

    fireEvent.click(
      await screen.findByRole('button', { name: en['output.apoConfigure'] }),
    );

    await waitFor(() => expect(onConfigureApo).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
  });

  it('does not guess when endpoint attachment could not be read', async () => {
    renderProfiles({
      device: { ...missingApoDevice, isEqualizerApoAttached: null },
    });

    await screen.findByText('USB Speakers');
    expect(screen.queryByText(en['output.off'])).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('DeviceProfiles under the FluidEQ Engine', () => {
  const detachedDevice = {
    ...missingApoDevice,
    isEqualizerApoAttached: undefined,
    isFluidEngineAttached: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks to enable the engine rather than to open the Device Selector', async () => {
    renderProfiles({ engine: 'fluid', device: detachedDevice });

    const notice = await screen.findByRole('alertdialog');
    expect(notice).toHaveTextContent(en['output.engineMissingTitle']);
    expect(notice).toHaveTextContent('USB Speakers');
    expect(
      screen.queryByRole('button', { name: en['output.apoConfigure'] }),
    ).not.toBeInTheDocument();

    // Emphasis follows recommendation: enabling is the suggested action.
    const enable = screen.getByRole('button', { name: en['output.enable'] });
    expect(enable).toHaveClass('button', 'small');
    expect(enable).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: en['output.notNow'] }),
    ).toHaveClass('subtle');
  });

  it('attaches the output it is showing, and dismisses when it worked', async () => {
    const { onAttachFluidEngine } = renderProfiles({
      engine: 'fluid',
      device: detachedDevice,
    });

    fireEvent.click(
      await screen.findByRole('button', { name: en['output.enable'] }),
    );

    await waitFor(() =>
      expect(onAttachFluidEngine).toHaveBeenCalledWith('{SPEAKERS}'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
  });

  it('says so when the Windows prompt was declined, and stays open', async () => {
    renderProfiles({
      engine: 'fluid',
      device: detachedDevice,
      onAttachFluidEngine: jest.fn(async () => ({
        ok: false,
        declined: true,
        endpoints: [],
      })),
    });

    fireEvent.click(
      await screen.findByRole('button', { name: en['output.enable'] }),
    );

    expect(await screen.findByText(en['engine.declined'])).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('ignores the Equalizer APO endpoint answer entirely', async () => {
    renderProfiles({
      engine: 'fluid',
      device: { ...missingApoDevice, isFluidEngineAttached: true },
    });

    await screen.findByText('USB Speakers');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText(en['output.off'])).not.toBeInTheDocument();
  });

  it('does not guess when the engine endpoint could not be read', async () => {
    renderProfiles({
      engine: 'fluid',
      device: { ...detachedDevice, isFluidEngineAttached: null },
    });

    await screen.findByText('USB Speakers');
    expect(screen.queryByText(en['output.off'])).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  // While the engine status has not answered yet, neither flag is the right
  // one to read: showing Equalizer APO's notice for a machine that turns out
  // to be running the FluidEQ Engine sends someone to repair a program that
  // is not carrying their audio.
  it('shows no notice at all while the engine is not known yet', async () => {
    renderProfiles({
      engine: null,
      device: { ...detachedDevice, isEqualizerApoAttached: false },
    });

    await screen.findByText('USB Speakers');
    expect(screen.queryByText(en['output.off'])).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
