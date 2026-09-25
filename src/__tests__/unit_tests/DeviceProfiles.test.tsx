import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import type { TAudioEngine } from 'common/audioEngine';
import en from 'common/i18n/en';
import DeviceProfiles from 'renderer/DeviceProfiles';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { notifyAudioEngineChanged } from 'renderer/utils/audioEngineEvents';
import {
  getAudioDevices,
  getDeviceProfileSettings,
} from 'renderer/utils/equalizerApi';

// What main pushes when Windows says the outputs moved (`outputWatch.ts`).
let mockPushOutputs:
  ((reading: Promise<Record<string, unknown>[]>) => void) | undefined;

jest.mock('renderer/utils/equalizerApi', () => {
  const getAudioDevices = jest.fn();
  return {
    getAudioDevices,
    // Open-time readers take the kept list; here it is the same answer.
    readKnownAudioDevices: () => getAudioDevices(),
    getDeviceProfileSettings: jest.fn(),
    setDefaultAudioDevice: jest.fn(),
    subscribeAudioDevices: (
      listener: (reading: Promise<Record<string, unknown>[]>) => void,
    ) => {
      mockPushOutputs = listener;
      return () => {
        mockPushOutputs = undefined;
      };
    },
  };
});

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

  it('defers its notice without dismissing it while maintenance owns the spot', async () => {
    (getAudioDevices as jest.Mock).mockResolvedValue([missingApoDevice]);
    (getDeviceProfileSettings as jest.Mock).mockResolvedValue({
      version: 1,
      assignments: {},
    });
    const profiles = (isNoticeHidden: boolean) => (
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <DeviceProfiles
          engine="apo"
          isNoticeHidden={isNoticeHidden}
          onConfigureApo={jest.fn()}
          onAttachFluidEngine={jest.fn()}
        />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(profiles(false));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    rerender(profiles(true));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    rerender(profiles(false));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('holds its notice from the moment the engine changes until the list is re-read', async () => {
    // Switching engines puts the other engine's effect back on every output,
    // and the list still described the outputs as the engine being left had
    // them: "Equalizer APO is not enabled for this output" showed for a few
    // seconds after every switch to Equalizer APO, then went away by itself.
    let release!: () => void;
    (getAudioDevices as jest.Mock)
      .mockResolvedValueOnce([missingApoDevice])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () =>
              resolve([{ ...missingApoDevice, isEqualizerApoAttached: true }]);
          }),
      );
    (getDeviceProfileSettings as jest.Mock).mockResolvedValue({
      version: 1,
      assignments: {},
    });
    render(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <DeviceProfiles
          engine="apo"
          onConfigureApo={jest.fn()}
          onAttachFluidEngine={jest.fn()}
        />
      </FluidEqProviderWrapper>,
    );
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    act(() => notifyAudioEngineChanged());
    // Away at once, on the old list, and still away while the read runs.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await act(async () => {
      release();
    });
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    // Positive control: the same read answering "still not attached" brings
    // the notice back.
    (getAudioDevices as jest.Mock).mockResolvedValue([missingApoDevice]);
    await act(async () => {
      notifyAudioEngineChanged();
    });
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
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
  // Picked in the list but not the one Windows is playing through, so
  // nothing is enabled until somebody asks.
  const idleDetachedDevice = { ...detachedDevice, isDefault: false };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks to enable the engine rather than to open the Device Selector', async () => {
    renderProfiles({ engine: 'fluid', device: idleDetachedDevice });

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
      device: idleDetachedDevice,
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
      device: idleDetachedDevice,
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

  // The app used to enable the output Windows plays through by itself, and
  // every change of output — or an output unplugged — put an administrator
  // prompt up with nobody having asked. The notice asks; only a press acts.
  it('never enables the output Windows is playing through by itself', async () => {
    const onAttachFluidEngine = jest.fn(async () => attached);
    renderProfiles({
      engine: 'fluid',
      device: detachedDevice,
      onAttachFluidEngine,
    });

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      en['output.engineMissingTitle'],
    );
    // The device list refreshes while the window is open; a change of
    // default output arrives the same way.
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByText('USB Speakers');
    expect(onAttachFluidEngine).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: en['output.enable'] }),
    ).not.toHaveClass('is-running');

    // Positive control: the press is what asks.
    fireEvent.click(screen.getByRole('button', { name: en['output.enable'] }));
    await waitFor(() =>
      expect(onAttachFluidEngine).toHaveBeenCalledWith('{SPEAKERS}'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(onAttachFluidEngine).toHaveBeenCalledTimes(1);
  });

  it('keeps the notice away while maintenance owns the spot, and asks nothing when it is back', async () => {
    (getAudioDevices as jest.Mock).mockResolvedValue([detachedDevice]);
    (getDeviceProfileSettings as jest.Mock).mockResolvedValue({
      version: 1,
      assignments: {},
    });
    const onAttachFluidEngine = jest.fn(async () => attached);
    const profiles = (isNoticeHidden: boolean) => (
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <DeviceProfiles
          engine="fluid"
          isNoticeHidden={isNoticeHidden}
          onConfigureApo={jest.fn()}
          onAttachFluidEngine={onAttachFluidEngine}
        />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(profiles(true));
    await screen.findByText('USB Speakers');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onAttachFluidEngine).not.toHaveBeenCalled();

    rerender(profiles(false));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(onAttachFluidEngine).not.toHaveBeenCalled();
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

// Remote Desktop's audio is listed as an output, reads "not attached" under
// both engines — it has no effect slots at all — and used to be offered a
// repair that failed with "there is no output with the id…".
describe('DeviceProfiles on an output Windows runs no effects on', () => {
  const remoteAudio = {
    id: 'remote',
    name: 'Remote Audio',
    guid: '{6C26BA7D-F0B2-4225-B422-8168C5261E45}',
    isDefault: true,
    isActive: true,
    isEqualizerApoAttached: false,
    isFluidEngineAttached: false,
    canHostEffects: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each<TAudioEngine>(['fluid', 'apo'])(
    'says no EQ can reach it, and offers no repair, under %s',
    async (engine) => {
      const { onAttachFluidEngine, onConfigureApo } = renderProfiles({
        engine,
        device: remoteAudio,
      });

      const notice = await screen.findByRole('alertdialog');
      expect(notice).toHaveTextContent(en['output.noEffectsTitle']);
      expect(notice).toHaveTextContent('Remote Audio');
      expect(
        screen.queryByRole('button', { name: en['output.enable'] }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: en['output.apoConfigure'] }),
      ).not.toBeInTheDocument();
      // The EQ is not on this output, so the picker still says OFF.
      expect(screen.getAllByText(en['output.off'])).toHaveLength(2);

      fireEvent.click(screen.getByRole('button', { name: en['output.gotIt'] }));
      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      );
      expect(onAttachFluidEngine).not.toHaveBeenCalled();
      expect(onConfigureApo).not.toHaveBeenCalled();
    },
  );

  it('keeps the repair for an output whose answer could not be read', async () => {
    renderProfiles({
      engine: 'fluid',
      device: { ...remoteAudio, name: 'USB Speakers', canHostEffects: null },
      // Still working on it, so the notice is there to read.
      onAttachFluidEngine: jest.fn(
        () =>
          new Promise(() => {
            // Never settles: the Windows prompt is still up.
          }),
      ),
    });

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      en['output.engineMissingTitle'],
    );
    expect(
      screen.getByRole('button', { name: en['output.enable'] }),
    ).toBeInTheDocument();
  });
});

/*
 * The panel read every output on the machine every three seconds while the
 * window was on screen — an IPC round trip and a PowerShell run each time —
 * and main, which learned of a new output only through that read, never
 * followed one while the window was hidden. Main now hears Windows itself and
 * pushes the list it read; the panel reads for itself only when mounted and
 * when the window is come back to.
 */
describe('DeviceProfiles reading the outputs', () => {
  const speakers = {
    ...missingApoDevice,
    name: 'Desk Speakers',
    isEqualizerApoAttached: true,
  };
  const headset = {
    ...speakers,
    id: 'headset',
    name: 'Gaming Headset',
    guid: '{HEADSET}',
  };

  const mount = (setGlobalError = jest.fn()) => {
    (getAudioDevices as jest.Mock).mockResolvedValue([speakers]);
    (getDeviceProfileSettings as jest.Mock).mockResolvedValue({
      version: 1,
      assignments: {},
    });
    render(
      <FluidEqProviderWrapper
        value={{ ...defaultFluidEqContext, setGlobalError }}
      >
        <DeviceProfiles
          engine="apo"
          onConfigureApo={jest.fn()}
          onAttachFluidEngine={jest.fn()}
        />
      </FluidEqProviderWrapper>,
    );
    return { setGlobalError };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads once when mounted and never again on a clock', async () => {
    jest.useFakeTimers();
    mount();
    expect(await screen.findByText('Desk Speakers')).toBeInTheDocument();
    expect(getAudioDevices).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    expect(getAudioDevices).toHaveBeenCalledTimes(1);

    // Positive control: the window being come back to is what reads.
    await act(async () => {
      window.dispatchEvent(new FocusEvent('focus'));
    });
    expect(getAudioDevices).toHaveBeenCalledTimes(2);
  });

  it('shows the list main pushed, without reading it a second time', async () => {
    mount();
    await screen.findByText('Desk Speakers');
    const changes: unknown[] = [];
    const heard = (event: Event) =>
      changes.push((event as CustomEvent<unknown>).detail);
    window.addEventListener('fluideq-output-changed', heard);

    await act(async () => {
      mockPushOutputs?.(
        Promise.resolve([headset, { ...speakers, isDefault: false }]),
      );
    });

    expect(await screen.findByText('Gaming Headset')).toBeInTheDocument();
    expect(getAudioDevices).toHaveBeenCalledTimes(1);
    expect(changes).toEqual([{ deviceId: 'headset' }]);

    // Null beside it: a push that moves nothing announces nothing.
    await act(async () => {
      mockPushOutputs?.(
        Promise.resolve([headset, { ...speakers, isDefault: false }]),
      );
    });
    expect(changes).toHaveLength(1);
    window.removeEventListener('fluideq-output-changed', heard);
  });

  it('reads once for a window shown and focused together', async () => {
    mount();
    await screen.findByText('Desk Speakers');
    expect(getAudioDevices).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new FocusEvent('focus'));
    });
    expect(getAudioDevices).toHaveBeenCalledTimes(2);

    // Positive control: a later return is a read of its own.
    await act(async () => {
      window.dispatchEvent(new FocusEvent('focus'));
    });
    expect(getAudioDevices).toHaveBeenCalledTimes(3);
  });

  it('keeps the list when a control inside the window takes focus', async () => {
    mount();
    await screen.findByText('Desk Speakers');
    const control = document.createElement('button');
    document.body.append(control);

    await act(async () => {
      control.dispatchEvent(new FocusEvent('focus'));
    });

    expect(getAudioDevices).toHaveBeenCalledTimes(1);
    control.remove();
  });

  it("shows main's refusal, then asks for the list it still owes", async () => {
    const { setGlobalError } = mount();
    await screen.findByText('Desk Speakers');
    (getAudioDevices as jest.Mock).mockResolvedValue([
      headset,
      { ...speakers, isDefault: false },
    ]);
    const refusal = { shortError: 'cannot adopt', action: '', code: 0 };

    await act(async () => {
      mockPushOutputs?.(Promise.reject(refusal));
    });

    expect(setGlobalError).toHaveBeenCalledWith(refusal);
    expect(await screen.findByText('Gaming Headset')).toBeInTheDocument();
    expect(getAudioDevices).toHaveBeenCalledTimes(2);
  });
});
