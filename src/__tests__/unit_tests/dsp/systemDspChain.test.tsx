/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack reaching the system-wide engine, and the page saying that it did.
 *
 * Two halves of one feature, and each has already been the whole bug on its
 * own: a rack that only travels while the Library player is engaged never
 * reaches an engine that is meant to process everything, and a page that says
 * "Library only" while the rack is running on every output is the reason this
 * feature gets reported as broken by people it is working perfectly for.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import ChannelEnum from '../../../common/channels';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import { encodeChainSettings } from '../../../common/dsp/chainWire';
import { FluidEqProviderWrapper } from '../../../renderer/utils/FluidEqContext';
import DspPanel from '../../../renderer/dsp/DspPanel';
import {
  applyDspSettings,
  readDspOutputSafetyEnabled,
  setDspNativeState,
} from '../../../renderer/dsp/store';
import { resetSystemDspChain } from '../../../renderer/dsp/systemChain';
import {
  claimPlayback,
  stopAllPlayback,
} from '../../../renderer/audio/playbackOwner';

type TChannelHandler = (values: unknown[]) => unknown;

/** Everything sent on `SET_SYSTEM_DSP_CHAIN`, in order. */
let chainsSent: number[][] = [];
/** What `getAudioEngineStatus` answers with for the case being rendered. */
let engineStatus: IAudioEngineStatus;

const FLUID_STATUS: IAudioEngineStatus = {
  engine: 'fluid',
  apo: { installed: false },
  fluid: { installed: true, endpoints: [] },
  fluidSupported: true,
};

const APO_STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
};

/**
 * The preload bridge, answering the three channels this page asks about.
 *
 * Every call in `equalizerApi.ts` sends first and subscribes second, so the
 * answer is computed in `sendMessage` and handed over in `once` — a mock that
 * only replied to handlers already registered would answer nothing at all.
 * The reply lands on the next microtask rather than inside `once` itself,
 * because a synchronous reply would resolve the promise before the caller had
 * one and hide any ordering bug rather than expose it.
 */
const installBridge = () => {
  const answers: Record<string, TChannelHandler> = {
    [ChannelEnum.GET_AUDIO_ENGINE_STATUS]: () => engineStatus,
    [ChannelEnum.GET_AUDIO_DEVICES]: () => [
      {
        id: 'a',
        name: 'Speakers (Realtek)',
        guid: '{A}',
        isDefault: true,
        isActive: true,
      },
    ],
    [ChannelEnum.SET_SYSTEM_DSP_CHAIN]: (values) => {
      chainsSent.push(values[0] as number[]);
      return 'written';
    },
  };
  const results = new Map<string, unknown>();

  window.electron = {
    ipcRenderer: {
      sendMessage: (channel: string, values: unknown[]) => {
        const answer = answers[channel];
        if (answer) {
          results.set(channel, answer(values));
        }
      },
      once: (channel: string, handler: (arg: unknown) => void) => {
        if (results.has(channel)) {
          const result = results.get(channel);
          Promise.resolve().then(() => handler({ result }));
        }
        return () => undefined;
      },
      on: () => () => undefined,
    },
  } as unknown as typeof window.electron;
};

const renderPanel = (settings: IDspSettings = DSP_DEFAULTS) =>
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, isEnabled: true }}
    >
      <DspPanel
        settings={settings}
        onChange={() => undefined}
        onCommit={() => undefined}
        engineState="running"
        onOpenEngineDialog={() => undefined}
      />
    </FluidEqProviderWrapper>,
  );

beforeEach(() => {
  engineStatus = FLUID_STATUS;
  installBridge();
  // The store is a module singleton, so a case that leaves an edited rack
  // behind decides what the next one sends. Put it back to the defaults, then
  // clear what that produced: both the record and the de-duplication, or the
  // reset itself would be the message the next case is looking for.
  act(() => applyDspSettings(DSP_DEFAULTS));
  chainsSent = [];
  resetSystemDspChain();
  // The scope notice reads "play a track" until something is playing, and the
  // side tabs are disabled until the rack is live — both of which would make
  // these checks about the transport rather than about the engine.
  act(() => {
    claimPlayback('library');
    setDspNativeState('engaged');
  });
});

afterEach(() =>
  act(() => {
    stopAllPlayback();
    setDspNativeState('idle');
  }),
);

describe('the rack on its way to the system-wide engine', () => {
  it('sends exactly what the host is sent, once per edit', async () => {
    const edited: IDspSettings = {
      ...DSP_DEFAULTS,
      maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true },
    };
    act(() => applyDspSettings(edited));

    await waitFor(() => expect(chainsSent).toHaveLength(1));
    // Byte for byte the array the Library player's host receives. Two
    // encoders would agree until a field was added to one of them, and the
    // failure mode of that is not a crash — it is every band shifted by one.
    expect(chainsSent[0]).toEqual(
      encodeChainSettings(edited, {
        outputSafetyEnabled: readDspOutputSafetyEnabled(),
      }),
    );
  });

  it('does not send the same rack twice', async () => {
    const edited: IDspSettings = {
      ...DSP_DEFAULTS,
      maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true },
    };
    act(() => applyDspSettings(edited));
    await waitFor(() => expect(chainsSent).toHaveLength(1));

    // The store emits on every pointer move of a drag, and the engine reloads
    // its whole chain on every write it sees in the config directory.
    act(() => applyDspSettings(edited));
    act(() => applyDspSettings({ ...edited }));
    expect(chainsSent).toHaveLength(1);

    act(() =>
      applyDspSettings({
        ...edited,
        maximizer: { ...edited.maximizer, ceilingDb: -3 },
      }),
    );
    await waitFor(() => expect(chainsSent).toHaveLength(2));
  });
});

describe('what the DSP page says its scope is', () => {
  /**
   * The rack file survives between sessions, so it is usually already right —
   * but "usually" is not "always", and a rack the engine never received is a
   * page whose controls do nothing on a machine where everything looks fine.
   */
  it('makes sure the engine has the rack when the page opens', async () => {
    renderPanel();
    await waitFor(() => expect(chainsSent).toHaveLength(1));
    expect(chainsSent[0]).toEqual(
      encodeChainSettings(DSP_DEFAULTS, {
        outputSafetyEnabled: readDspOutputSafetyEnabled(),
      }),
    );
  });

  it('sends nothing on open under Equalizer APO', async () => {
    engineStatus = APO_STATUS;
    renderPanel();
    await screen.findByText(/played from Library only/i);
    expect(chainsSent).toHaveLength(0);
  });

  it('says system-wide, and names the output, under FluidEQ Engine', async () => {
    renderPanel();
    expect(
      await screen.findByText(/System-wide · Speakers \(Realtek\)/),
    ).toBeInTheDocument();
    // The Library-only sentence is not merely joined by the pill — it would
    // contradict it.
    expect(
      screen.queryByText(/played from Library only/i),
    ).not.toBeInTheDocument();
    // And neither is the "play a track to use DSP" prompt: the rack applies
    // to everything, so there is nothing to wait for.
    expect(
      screen.queryByText(/Play an audio track from Library/i),
    ).not.toBeInTheDocument();
  });

  it('prints the delay only when linear phase is actually running', async () => {
    renderPanel();
    expect(await screen.findByText(/System-wide/)).toBeInTheDocument();
    expect(screen.queryByText(/171 ms delay/)).not.toBeInTheDocument();

    renderPanel({
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, phase: 'linear' },
    });
    expect(await screen.findByText(/171 ms delay/)).toBeInTheDocument();
  });

  it('keeps the Library-only notice, and offers the engine, under APO', async () => {
    engineStatus = APO_STATUS;
    renderPanel();
    expect(
      await screen.findByText(/played from Library only/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use FluidEQ Engine' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/System-wide/)).not.toBeInTheDocument();
  });

  it('says Denoise is Library-only only where the rest is not', async () => {
    renderPanel();
    expect(await screen.findByText(/System-wide/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Denoise/i }));
    expect(screen.getByText('Library playback only')).toBeInTheDocument();
  });
});
