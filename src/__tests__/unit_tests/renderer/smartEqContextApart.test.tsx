/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import {
  FilterTypeEnum,
  getDefaultState,
  type ISmartEqSettings,
} from 'common/constants';
import { DEFAULT_VOICING } from 'common/voicing';
import { getEqualizerState } from 'renderer/utils/equalizerApi';
import {
  FluidEqProvider,
  type IFluidEqShell,
  useFluidEqContext,
  useFluidEqLayers,
  useFluidEqShell,
} from 'renderer/utils/FluidEqContext';
import { useFluidEqSmartEq } from 'renderer/utils/fluidEqSmartEq';

/**
 * A step of Smart correction redraws what reads the Smart layer, and nothing
 * else (`fluidEqSmartEq.ts`).
 *
 * The correction comes in while it is measured, up to twice a second, and
 * carried in the layers' context every step redrew the side bar, the EQ
 * page's bands, the presets and — through the song memory's host in the
 * window's root — the whole window: 50 to 80 ms each in the dev window
 * (2026-11-27). Each reader below counts its own renders; the control
 * changes a layer that IS in the layers' context, to show the counters see a
 * change when there is one to see.
 */

jest.mock('renderer/utils/audioEngineApi', () => ({
  ...jest.requireActual('renderer/utils/audioEngineApi'),
  setSystemDspChain: jest.fn(() => Promise.resolve('not-fluid')),
}));

jest.mock('renderer/utils/equalizerApi', () => ({
  getEqualizerState: jest.fn(),
}));

const mockedGetEqualizerState = getEqualizerState as jest.Mock;

const renders = { shell: 0, layers: 0, whole: 0, smart: 0 };
let shell: IFluidEqShell | undefined;
let smartSeen: ISmartEqSettings | undefined;

const ShellReader = () => {
  shell = useFluidEqShell();
  renders.shell += 1;
  return null;
};
const LayersReader = () => {
  useFluidEqLayers();
  renders.layers += 1;
  return null;
};
const WholeReader = () => {
  useFluidEqContext();
  renders.whole += 1;
  return null;
};
const SmartReader = () => {
  smartSeen = useFluidEqSmartEq();
  renders.smart += 1;
  return null;
};

const layer = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      type: FilterTypeEnum.PK,
      frequency: 1000,
      gain,
      quality: 1,
    },
  },
});

const mount = async () => {
  mockedGetEqualizerState.mockResolvedValue(getDefaultState());
  await act(async () => {
    render(
      <FluidEqProvider>
        <ShellReader />
        <LayersReader />
        <WholeReader />
        <SmartReader />
      </FluidEqProvider>,
    );
  });
};

const counted = () => ({ ...renders });

describe('the Smart layer, a context of its own', () => {
  beforeEach(() => {
    Object.assign(renders, { shell: 0, layers: 0, whole: 0, smart: 0 });
    shell = undefined;
    smartSeen = undefined;
    mockedGetEqualizerState.mockReset();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      get: () => ({ ipcRenderer: { on: () => () => {} } }),
    });
  });

  it('redraws only its own readers at each step of the correction', async () => {
    await mount();
    const before = counted();

    // Three steps, one at a time, as the correction coming in writes them.
    const step = async (gain: number) => {
      const write = shell?.setSmartEq;
      await act(async () => {
        write?.(layer(gain));
      });
      expect(smartSeen).toEqual(layer(gain));
    };
    await step(0.5);
    await step(1);
    await step(1.5);

    const after = counted();
    expect(after.smart - before.smart).toBe(3);
    expect(after.shell).toBe(before.shell);
    expect(after.layers).toBe(before.layers);
    expect(after.whole).toBe(before.whole);
  });

  it('control: a layer the layers carry does redraw their readers', async () => {
    await mount();
    const before = counted();

    await act(async () => {
      shell?.setVoicing({ ...DEFAULT_VOICING, intensity: 0.5 });
    });

    const after = counted();
    expect(after.layers).toBeGreaterThan(before.layers);
    expect(after.whole).toBeGreaterThan(before.whole);
    // And the Smart layer's readers are not woken by it.
    expect(after.smart).toBe(before.smart);
  });
});
