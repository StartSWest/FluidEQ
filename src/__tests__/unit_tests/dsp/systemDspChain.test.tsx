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
import type {
  IAudioEngineStatus,
  TSystemDspChainResult,
} from '../../../common/audioEngine';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import { encodeChainSettings } from '../../../common/dsp/chainWire';
import { FluidEqProviderWrapper } from '../../../renderer/utils/FluidEqContext';
import DspPanel from '../../../renderer/dsp/DspPanel';
import {
  applyDspSettings,
  readDspOutputSafetyEnabled,
  setDspNativeState,
  setDspRackGate,
} from '../../../renderer/dsp/store';
import { resetRackGate } from '../../../renderer/dsp/rackPlacement';
import en from '../../../common/i18n/en';
import {
  resetSystemDspChain,
  sendSystemDspChain,
} from '../../../renderer/dsp/systemChain';
import { notifyAudioEngineChanged } from '../../../renderer/utils/audioEngineEvents';
import {
  claimPlayback,
  stopAllPlayback,
} from '../../../renderer/audio/playbackOwner';

type TChannelHandler = (values: unknown[]) => unknown;

/** Everything sent on `SET_SYSTEM_DSP_CHAIN`, in order. */
let chainsSent: number[][] = [];
/**
 * What the bridge answers the next `SET_SYSTEM_DSP_CHAIN` with. Almost every
 * case wants `'written'`; the cases about a refused send set this first.
 */
let chainAnswer: TSystemDspChainResult = 'written';
/** How many times `GET_AUDIO_ENGINE_STATUS` has actually been asked. */
let statusFetches = 0;
/** Every `SET_ENABLE` asked for — FluidEQ's own switch. */
let switchedTo: boolean[] = [];
/** What `getAudioEngineStatus` answers with for the case being rendered. */
let engineStatus: IAudioEngineStatus;

const FLUID_STATUS: IAudioEngineStatus = {
  engine: 'fluid',
  apo: { installed: false },
  fluid: { installed: true, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
};

const APO_STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
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
    [ChannelEnum.GET_AUDIO_ENGINE_STATUS]: () => {
      statusFetches += 1;
      return engineStatus;
    },
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
      return chainAnswer;
    },
    [ChannelEnum.SET_ENABLE]: (values) => {
      switchedTo.push(values[0] as boolean);
      return undefined;
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

/**
 * Let the mocked bridge's queued microtasks settle.
 *
 * `sendSystemDspChain` is fire-and-forget: its `.then` runs two microtask
 * ticks after `installBridge`'s answer is pushed into `chainsSent` (one for
 * the mock's own `Promise.resolve().then(...)`, one for `promisifyResult`'s
 * `resolve` to reach the caller's `.then`). A case that checks the cache was
 * actually forgotten on a refusal has to wait past that, or it can call
 * `sendSystemDspChain` again before the refusal has been processed at all.
 */
const flushBridge = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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
  chainAnswer = 'written';
  statusFetches = 0;
  switchedTo = [];
  // Where the rack may run is module state too; every case starts with the
  // gate the window has before anything has told it otherwise.
  resetRackGate();
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

describe('the rack under the engine with nothing playing at all', () => {
  it('is live, because the engine runs it independent of the Library deck', async () => {
    // The exact situation the pill promises and the controls used to deny:
    // FluidEQ Engine chosen, and nothing whatsoever playing through the
    // Library deck — the ordinary state of a window used purely to process
    // system audio.
    act(() => {
      stopAllPlayback();
      setDspNativeState('idle');
    });
    renderPanel();

    expect(await screen.findByText(/System-wide/)).toBeInTheDocument();
    // "Bypassed" is what an unavailable rack says. The default settings
    // leave the master switch on and the engine is already running the
    // chain, so the readout has to say so rather than wait for a Library
    // track that will never arrive.
    expect(screen.queryByText('Bypassed')).not.toBeInTheDocument();
    // Scoped to the master readout: the normalizer's own `ProcessorCard`
    // power label says "On" too, for a different switch entirely.
    expect(
      screen.getByText('On', { selector: '.dsp-global-power-state' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'DSP' })).not.toBeDisabled();
    // A stage's own rail tab, not only the master switch — the whole page
    // gates on the same flag.
    expect(
      screen.getByRole('button', { name: /Equaliser/i }),
    ).not.toBeDisabled();
  });
});

describe('a send the engine refuses', () => {
  it('is not remembered as delivered, so the identical array is sent again', async () => {
    const values = encodeChainSettings(DSP_DEFAULTS, {
      outputSafetyEnabled: readDspOutputSafetyEnabled(),
    });

    chainAnswer = 'not-fluid';
    sendSystemDspChain(values);
    await waitFor(() => expect(chainsSent).toHaveLength(1));
    await flushBridge();

    // Nothing about the settings changed, only the answer did. If the first,
    // refused send had been cached as if it landed, this second, identical
    // call would be silently swallowed by the de-duplication guarding it.
    chainAnswer = 'written';
    sendSystemDspChain(values);
    await waitFor(() => expect(chainsSent).toHaveLength(2));
    expect(chainsSent[1]).toEqual(values);
  });
});

describe('a refresh that discovers the chosen engine changed', () => {
  it('forgets what it last sent, so a freshly chosen engine gets the rack once', async () => {
    // Prime the cache as though this window had already delivered the
    // defaults — exactly what a first visit to this page under the engine
    // leaves behind.
    sendSystemDspChain(
      encodeChainSettings(DSP_DEFAULTS, {
        outputSafetyEnabled: readDspOutputSafetyEnabled(),
      }),
    );
    await waitFor(() => expect(chainsSent).toHaveLength(1));
    chainsSent = [];

    // The window opens under Equalizer APO while that stale cache is still
    // in memory — main switched engines from somewhere else entirely.
    engineStatus = APO_STATUS;
    renderPanel();
    await screen.findByText(/played from Library only/i);
    expect(chainsSent).toHaveLength(0);

    // Something tells this window to look again — here, the same
    // output-changed event `DspPanel` already answers to re-read the active
    // device — and the engine has become FluidEQ Engine since the last read.
    engineStatus = FLUID_STATUS;
    act(() => {
      window.dispatchEvent(new Event('fluideq-output-changed'));
    });

    await waitFor(() => expect(chainsSent).toHaveLength(1));
    expect(chainsSent[0]).toEqual(
      encodeChainSettings(DSP_DEFAULTS, {
        outputSafetyEnabled: readDspOutputSafetyEnabled(),
      }),
    );
  });
});

describe('where the rack runs, from the engine’s side', () => {
  // The rack switched on, with a stage in it, so switching it off at the root
  // is a different array from the one the page holds.
  const edited: IDspSettings = {
    ...DSP_DEFAULTS,
    enabled: true,
    maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true },
  };
  const encoded = (of: IDspSettings) =>
    encodeChainSettings(of, {
      outputSafetyEnabled: readDspOutputSafetyEnabled(),
    });

  /**
   * The engine holding the rack as the page has it, before anything moves
   * the rack elsewhere — the positive control for every case below.
   */
  const engineHoldsTheRack = async () => {
    act(() => {
      setDspRackGate({ engine: 'fluid' });
      applyDspSettings(edited);
    });
    await waitFor(() =>
      expect(chainsSent[chainsSent.length - 1]).toEqual(encoded(edited)),
    );
    chainsSent = [];
  };

  it('stands aside while the Library plays, and takes it back after', async () => {
    await engineHoldsTheRack();
    // The Library player runs the rack on what it plays; the engine running
    // it again on the player's output was every effect applied twice.
    act(() => setDspRackGate({ libraryAudible: true }));
    await waitFor(() => expect(chainsSent).toHaveLength(1));
    expect(chainsSent[0]).toEqual(encoded({ ...edited, enabled: false }));

    act(() => setDspRackGate({ libraryAudible: false }));
    await waitFor(() => expect(chainsSent).toHaveLength(2));
    expect(chainsSent[1]).toEqual(encoded(edited));
  });

  it('is off while FluidEQ is switched off, and back when it is on', async () => {
    await engineHoldsTheRack();
    act(() => setDspRackGate({ eqEnabled: false }));
    await waitFor(() => expect(chainsSent).toHaveLength(1));
    expect(chainsSent[0]).toEqual(encoded({ ...edited, enabled: false }));

    act(() => setDspRackGate({ eqEnabled: true }));
    await waitFor(() => expect(chainsSent).toHaveLength(2));
    expect(chainsSent[1]).toEqual(encoded(edited));
  });

  it('is off while the engine is not running', async () => {
    await engineHoldsTheRack();
    act(() => setDspRackGate({ engineOff: true }));
    await waitFor(() => expect(chainsSent).toHaveLength(1));
    expect(chainsSent[0]).toEqual(encoded({ ...edited, enabled: false }));
  });

  it('sends nothing for a gate change that leaves its place alone', async () => {
    await engineHoldsTheRack();
    act(() => setDspRackGate({ eqEnabled: true }));
    await flushBridge();
    expect(chainsSent).toHaveLength(0);
  });
});

describe('the DSP page while the rack runs nowhere', () => {
  const renderSwitchedOff = (setIsEnabled = jest.fn()) => {
    render(
      <FluidEqProviderWrapper
        value={{ ...defaultFluidEqContext, isEnabled: false, setIsEnabled }}
      >
        <DspPanel
          settings={DSP_DEFAULTS}
          onChange={() => undefined}
          onCommit={() => undefined}
          engineState="running"
          onOpenEngineDialog={() => undefined}
        />
      </FluidEqProviderWrapper>,
    );
    return setIsEnabled;
  };

  it('says FluidEQ is off, and every control with it', async () => {
    act(() => setDspRackGate({ engine: 'fluid', eqEnabled: false }));
    renderSwitchedOff();

    expect(await screen.findByRole('status')).toHaveTextContent(
      en['dspOff.switchedOff'],
    );
    // In place of the scope, not beside it: the rack has none while off.
    expect(screen.queryByText(/System-wide/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Equaliser/i })).toBeDisabled();
  });

  it('turns FluidEQ back on from the line that says it is off', async () => {
    act(() => setDspRackGate({ engine: 'fluid', eqEnabled: false }));
    const setIsEnabled = renderSwitchedOff();

    fireEvent.click(
      await screen.findByRole('button', { name: en['dspOff.turnOn'] }),
    );

    await waitFor(() => expect(setIsEnabled).toHaveBeenCalledWith(true));
    expect(switchedTo).toEqual([true]);
  });

  it('says the engine is not running, with no way to turn it on from here', async () => {
    act(() => setDspRackGate({ engine: 'fluid', engineOff: true }));
    renderPanel();

    expect(await screen.findByRole('status')).toHaveTextContent(
      en['dspOff.engineOff'],
    );
    expect(
      screen.queryByRole('button', { name: en['dspOff.turnOn'] }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeDisabled();
  });

  it('stays the Library player’s page under Equalizer APO', async () => {
    // FluidEQ's switch is about APO's EQ there; the rack is the player's.
    engineStatus = APO_STATUS;
    act(() => setDspRackGate({ engine: 'apo', eqEnabled: false }));
    renderSwitchedOff();

    expect(
      await screen.findByText(/played from Library only/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(en['dspOff.switchedOff']),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'DSP' })).not.toBeDisabled();
  });
});

describe('the module-level nudge a future engine dialog will use', () => {
  it('causes exactly one status re-fetch per notification', async () => {
    renderPanel();
    await waitFor(() => expect(statusFetches).toBeGreaterThan(0));
    const before = statusFetches;

    act(() => {
      notifyAudioEngineChanged();
    });

    await waitFor(() => expect(statusFetches).toBe(before + 1));
    // Not two, and not left at `before`: exactly the one fetch this
    // notification is for.
    expect(statusFetches).toBe(before + 1);
  });
});
