/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP page keeping still while the engine talks to it.
 *
 * The host publishes its meters a hundred times a second. The whole page used
 * to subscribe to the Master's safety meter, and the Normalizer and Denoise
 * pages to their own meters, at the top: measured in the running window at
 * 90 to 100 renders a second on every page, and on the Normalizer, Denoise
 * and Master pages every dial and switch redrawn with each one to move a few
 * numbers. Share Audio did the same to the whole page four times a second,
 * because the page read the full session value for its role alone.
 *
 * Nothing on screen shows a render that changed nothing, so the renders are
 * counted: the rail stands for the page (it redraws exactly when the page
 * does), and the dials for the processor that is open.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import {
  claimPlayback,
  stopAllPlayback,
} from '../../../renderer/audio/playbackOwner';
import DspPanel from '../../../renderer/dsp/DspPanel';
import {
  IDspDenoiseMeter,
  IDspNormalizerMeter,
  IDspOutputSafetyMeter,
  readDspDenoiseMeter,
  readDspNormalizerMeter,
  readDspOutputSafetyMeter,
  setDspDenoiseMeter,
  setDspNativeState,
  setDspNormalizerMeter,
  setDspOutputSafetyMeter,
  setDspSampleRate,
} from '../../../renderer/dsp/store';
import RemoteAudioContext, {
  RemoteAudioRoleContext,
} from '../../../renderer/remoteAudio/remoteAudioValueContext';
import type { IRemoteAudioValue } from '../../../renderer/remoteAudio/remoteAudioState';
import { getAudioEngineStatus } from '../../../renderer/utils/audioEngineApi';
import { FluidEqProviderWrapper } from '../../../renderer/utils/FluidEqContext';
import { resetAudioEngineStatus } from '../../../renderer/utils/useAudioEngineStatus';

const mockRenders = { rail: 0, dials: 0 };

jest.mock('../../../renderer/dsp/DspSideTabs', () => {
  const { createElement } = jest.requireActual('react');
  const actual = jest.requireActual('../../../renderer/dsp/DspSideTabs');
  return {
    __esModule: true,
    default: (props: object) => {
      mockRenders.rail += 1;
      return createElement(actual.default, props);
    },
  };
});

jest.mock('../../../renderer/dsp/DspControls', () => {
  const { createElement } = jest.requireActual('react');
  const actual = jest.requireActual('../../../renderer/dsp/DspControls');
  return {
    ...actual,
    Dial: (props: object) => {
      mockRenders.dials += 1;
      return createElement(actual.Dial, props);
    },
  };
});

jest.mock('../../../renderer/utils/audioEngineApi', () => ({
  ...jest.requireActual('../../../renderer/utils/audioEngineApi'),
  getAudioEngineStatus: jest.fn(),
}));

const APO_STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
};

const LISTENING: IRemoteAudioValue = {
  connectedCount: 1,
  connectedComputers: [],
  lanOptions: [],
  networkStats: [],
  phase: 'connected',
  role: 'listener',
  startListening: jest.fn(),
  startSending: jest.fn(),
  stop: jest.fn(),
  resumePlayback: jest.fn(),
  setStreamMode: jest.fn(),
  streamMode: 'video',
  subscribeMeter: jest.fn(() => jest.fn()),
};

let idleSafety: IDspOutputSafetyMeter;
let idleNormalizer: IDspNormalizerMeter;
let idleDenoise: IDspDenoiseMeter;
let setRemote: (next: IRemoteAudioValue) => void = () => undefined;

/**
 * Share Audio's two contexts as its provider supplies them, with a way to
 * change the value without re-rendering what is inside — which is the case
 * that matters: a provider whose value moves while its children stay put.
 */
function RemoteAudioHarness({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(LISTENING);
  setRemote = setValue;
  return (
    <RemoteAudioContext.Provider value={value}>
      <RemoteAudioRoleContext.Provider value={value.role}>
        {children}
      </RemoteAudioRoleContext.Provider>
    </RemoteAudioContext.Provider>
  );
}

const renderPanel = (settings: IDspSettings = DSP_DEFAULTS) =>
  render(
    <RemoteAudioHarness>
      <FluidEqProviderWrapper
        value={{ ...defaultFluidEqContext, isEnabled: true }}
      >
        <DspPanel
          settings={settings}
          onChange={() => undefined}
          onCommit={() => undefined}
          engineState="running"
        />
      </FluidEqProviderWrapper>
    </RemoteAudioHarness>,
  );

/** Twenty updates, each a new object, as the engine or the session sends them. */
const hostFrames = (publish: (frame: number) => void) => {
  for (let frame = 1; frame <= 20; frame += 1) {
    act(() => publish(frame));
  }
};

beforeAll(() => {
  idleSafety = readDspOutputSafetyMeter();
  idleNormalizer = readDspNormalizerMeter();
  idleDenoise = readDspDenoiseMeter();
});

beforeEach(() => {
  resetAudioEngineStatus();
  jest.mocked(getAudioEngineStatus).mockResolvedValue(APO_STATUS);
  act(() => {
    claimPlayback('library');
    setDspNativeState('engaged');
  });
});

afterEach(() =>
  act(() => {
    setDspOutputSafetyMeter(idleSafety);
    setDspNormalizerMeter(idleNormalizer);
    setDspDenoiseMeter(idleDenoise);
    stopAllPlayback();
    setDspNativeState('idle');
  }),
);

describe('the DSP page while the engine publishes meters', () => {
  it('does not redraw for the safety meter on a page that does not show it', async () => {
    renderPanel();
    await screen.findByText(/played from Library only/i);
    const before = mockRenders.rail;

    hostFrames((frame) =>
      setDspOutputSafetyMeter({ ...idleSafety, gainReductionDb: -frame / 10 }),
    );
    expect(mockRenders.rail).toBe(before);

    // POSITIVE CONTROL: something the page does show still redraws it.
    act(() => setDspSampleRate(44_100));
    expect(mockRenders.rail).toBeGreaterThan(before);
  });

  it('updates the Master readouts without redrawing its dials', async () => {
    renderPanel();
    await screen.findByText(/played from Library only/i);
    fireEvent.click(screen.getByRole('button', { name: /Master/i }));
    const { rail } = mockRenders;
    const { dials } = mockRenders;

    hostFrames((frame) =>
      setDspOutputSafetyMeter({
        ...idleSafety,
        postFilterNormalizer: {
          gainReductionDb: -frame / 10,
          inputTruePeakDb: -6,
        },
      }),
    );

    expect(screen.getByText(/Auto headroom -2\.0 dB/)).toBeInTheDocument();
    expect(mockRenders.dials).toBe(dials);
    expect(mockRenders.rail).toBe(rail);
  });

  it('moves the Normalizer meter without redrawing its dials', async () => {
    const { container } = renderPanel();
    await screen.findByText(/played from Library only/i);
    const { dials } = mockRenders;

    hostFrames((frame) =>
      setDspNormalizerMeter({
        ...idleNormalizer,
        inputPeaks: [0.5, 0.5],
        outputPeaks: [0.4, 0.4],
        appliedGainDb: frame / 10,
      }),
    );

    expect(
      container.querySelector('.dsp-normalizer-live .dsp-dev-safety-spec'),
    ).toHaveTextContent('2.0 dB');
    expect(mockRenders.dials).toBe(dials);
  });

  it('moves the Denoise readings without redrawing its dials', async () => {
    renderPanel({
      ...DSP_DEFAULTS,
      denoise: { ...DSP_DEFAULTS.denoise, enabled: true },
    });
    await screen.findByText(/played from Library only/i);
    fireEvent.click(screen.getByRole('button', { name: /Denoise/i }));
    const { dials } = mockRenders;

    hostFrames((frame) =>
      setDspDenoiseMeter({ ...idleDenoise, reductionDb: -frame / 5 }),
    );

    expect(screen.getByText('-4.0 dB')).toBeInTheDocument();
    expect(mockRenders.dials).toBe(dials);

    // POSITIVE CONTROL: the one change the page's controls depend on does
    // redraw it — the Voice module becoming usable.
    act(() =>
      setDspDenoiseMeter({ ...readDspDenoiseMeter(), voiceModelLoaded: true }),
    );
    expect(mockRenders.dials).toBeGreaterThan(dials);
  });
});

describe('the DSP page while Share Audio is connected', () => {
  it('does not redraw for network samples, only for a change of role', async () => {
    renderPanel();
    await screen.findByText(/played from Library only/i);
    const before = mockRenders.rail;

    // A fresh value for every sample, the way the provider builds one.
    hostFrames(() => setRemote({ ...LISTENING, networkStats: [] }));
    expect(mockRenders.rail).toBe(before);

    act(() => setRemote({ ...LISTENING, role: undefined }));
    expect(mockRenders.rail).toBeGreaterThan(before);
  });
});
