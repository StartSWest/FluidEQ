import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultFilterWithId,
} from 'common/constants';
import ActiveLayers from 'renderer/components/ActiveLayers';
import { holdRackForApo, rackHeldForApo } from 'renderer/dsp/rackHeldForApo';
import { applyDspSettings, readDspSettings } from 'renderer/dsp/store';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const mockWriteApoConfigFile = jest.fn();
const mockClearGains = jest.fn();
const mockRefreshState = jest.fn();
const mockSetVoicing = jest.fn();

jest.mock('renderer/utils/equalizerApi', () => ({
  clearConvolution: jest.fn(),
  clearGains: (...args: unknown[]) => mockClearGains(...args),
  setDriver: jest.fn(),
  setHeadphone: jest.fn(),
  setLayerBypass: jest.fn(),
  setSmartEq: jest.fn(),
  setVoicing: (...args: unknown[]) => mockSetVoicing(...args),
  writeApoConfigFile: (...args: unknown[]) => mockWriteApoConfigFile(...args),
}));

describe('Custom FX active layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteApoConfigFile.mockResolvedValue(undefined);
    mockClearGains.mockResolvedValue(undefined);
    mockRefreshState.mockResolvedValue(undefined);
  });

  it('clears the user config filter file without clearing generated EQ', async () => {
    const fileName = 'fluideq-0123456789ab-custom.txt';
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      customFx: { fileName, preAmp: 0, filters: {} },
      refreshState: mockRefreshState,
    };

    render(
      <FluidEqProviderWrapper value={context}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Clear custom FX filters and text',
        }),
      );
      await Promise.resolve();
    });

    expect(mockWriteApoConfigFile).toHaveBeenCalledWith(fileName, '');
    expect(mockClearGains).not.toHaveBeenCalled();
    expect(mockRefreshState).toHaveBeenCalled();
  });

  it('clears the EQ bands chip without touching neighbouring layers', async () => {
    const filter = getDefaultFilterWithId();
    filter.gain = 4;
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      isFlat: false,
      filters: { [filter.id]: filter },
      refreshState: mockRefreshState,
    };

    render(
      <FluidEqProviderWrapper value={context}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Reset every band to 0 dB',
        }),
      );
      await Promise.resolve();
    });

    expect(mockClearGains).toHaveBeenCalledTimes(1);
    expect(mockWriteApoConfigFile).not.toHaveBeenCalled();
    expect(mockRefreshState).toHaveBeenCalled();
  });

  /*
   * A preset's tone plays as a voicing named `dsp:<preset>`. Its chip says the
   * preset's own name, as the picker that put it there does — it used to fall
   * through to "Equalizer APO edit" — and a saved chain deleted since, whose
   * curve still plays, is called Custom.
   */
  it.each([
    ['dsp:metal', 'Metal'],
    ['dsp:gaming-room', 'Gaming · Room'],
    ['dsp:user-chain:gone', 'Custom'],
  ])('names the Preset layer %s after its preset', (profileId, name) => {
    render(
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          voicing: { profileId, intensity: 1, apoOverride: { filters: {} } },
        }}
      >
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );
    expect(screen.getByTitle(name)).toHaveClass('active-layer__name');
    expect(screen.queryByText('Equalizer APO edit')).not.toBeInTheDocument();
  });

  it('keeps the Smart EQ chip and strength control visible at zero', () => {
    const filter = getDefaultFilterWithId();
    filter.type = FilterTypeEnum.PK;
    filter.frequency = 1000;
    filter.gain = 3;
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      smartEq: {
        filters: { [filter.id]: filter },
        intensity: 0,
      },
      refreshState: mockRefreshState,
    };

    render(
      <FluidEqProviderWrapper value={context}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );

    expect(screen.getAllByText('Smart EQ')).toHaveLength(2);
    expect(screen.getByRole('slider', { name: 'Strength' })).toHaveValue('0');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('uses the current sampled EQ rather than dormant parametric gains', () => {
    const filter = { ...getDefaultFilterWithId(), gain: 8 };
    const view = (gain: number) => (
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          eqFormat: AutoEqFormat.GRAPHIC,
          filters: { [filter.id]: filter },
          graphicEq: [{ frequency: 100, gain }],
        }}
      >
        <ActiveLayers />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(view(0));
    expect(
      screen.queryByRole('button', { name: 'Reset every band to 0 dB' }),
    ).not.toBeInTheDocument();
    rerender(view(0.01));
    expect(
      screen.getByRole('button', { name: 'Reset every band to 0 dB' }),
    ).toBeInTheDocument();
  });

  it('names the EQ by its selected design, with a band-count fallback', () => {
    const filter = { ...getDefaultFilterWithId(), gain: 4 };
    const context = {
      ...defaultFluidEqContext,
      filters: { [filter.id]: filter },
      eqBandDesign: {
        id: 'design',
        name: 'My bass layout',
        bands: [{ frequency: filter.frequency, quality: filter.quality }],
      },
    };
    const { rerender } = render(
      <FluidEqProviderWrapper value={context}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );
    expect(screen.getByText('My bass layout')).toBeInTheDocument();
    rerender(
      <FluidEqProviderWrapper value={{ ...context, eqBandDesign: undefined }}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );
    expect(screen.getByText('1 bands')).toBeInTheDocument();
  });

  /*
   * The chip is the EQ's only switch. Hidden with the gains, a switched-off
   * EQ whose bands had all reached 0 dB had no way back on, and nothing on
   * screen said why its bands were greyed out. The same flat bands with the
   * EQ on are the control: no chip, as on every first launch.
   */
  it('keeps the EQ chip while the EQ is switched off, even with no band shaped', () => {
    const filter = { ...getDefaultFilterWithId(), gain: 0 };
    const view = (bypassed: IFluidEqContext['bypassed']) => (
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          filters: { [filter.id]: filter },
          bypassed,
        }}
      >
        <ActiveLayers />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(view(['eq']));
    expect(
      screen.getByRole('button', { name: 'Reset every band to 0 dB' }),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Switch EQ back on')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    rerender(view([]));
    expect(
      screen.queryByRole('button', { name: 'Reset every band to 0 dB' }),
    ).not.toBeInTheDocument();
  });

  /*
   * A Preset pill is the whole preset: its curve here, its rack on the DSP
   * page. Taking the curve alone left the rack playing a preset nothing on the
   * EQ page named any more — and a rack Equalizer APO was holding off would
   * have come back at the next switch to the FluidEQ Engine. Any other
   * voicing's pill is that layer only, and is the control: the rack stays.
   */
  it.each([
    ['a preset', 'dsp:pop', false, undefined],
    ['any other voicing', 'music', true, 'pop'],
  ])(
    'takes the DSP rack off with %s only',
    async (_what, profileId, rackStaysOn, holdAfter) => {
      mockSetVoicing.mockResolvedValue(undefined);
      applyDspSettings({
        ...readDspSettings(),
        enabled: true,
        presetId: 'pop',
      });
      holdRackForApo('pop');
      render(
        <FluidEqProviderWrapper
          value={{
            ...defaultFluidEqContext,
            voicing: { profileId, intensity: 1, apoOverride: { filters: {} } },
            refreshState: mockRefreshState,
          }}
        >
          <ActiveLayers />
        </FluidEqProviderWrapper>,
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Remove the Preset layer' }),
        );
      });

      expect(mockSetVoicing).toHaveBeenCalledWith('', 1);
      expect(readDspSettings().enabled).toBe(rackStaysOn);
      expect(rackHeldForApo()).toBe(holdAfter);
      expect(mockRefreshState).toHaveBeenCalled();
    },
  );

  it('hides cleared bands even with editing enabled, and returns on a gain edit', async () => {
    const filter = { ...getDefaultFilterWithId(), gain: 4 };
    const context = {
      ...defaultFluidEqContext,
      isFlat: false,
      filters: { [filter.id]: filter },
      refreshState: mockRefreshState,
      setPreAmp: jest.fn(),
    };
    const view = (gain: number) => (
      <FluidEqProviderWrapper
        value={{ ...context, filters: { [filter.id]: { ...filter, gain } } }}
      >
        <ActiveLayers />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(view(4));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Reset every band to 0 dB' }),
      );
    });
    expect(mockClearGains).toHaveBeenCalledTimes(1);
    expect(context.setPreAmp).not.toHaveBeenCalled();
    rerender(view(0));
    expect(
      screen.queryByRole('button', { name: 'Reset every band to 0 dB' }),
    ).not.toBeInTheDocument();
    rerender(view(-2));
    expect(
      screen.getByRole('button', { name: 'Reset every band to 0 dB' }),
    ).toBeInTheDocument();
  });
});
