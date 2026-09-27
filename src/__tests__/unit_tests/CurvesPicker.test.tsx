import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultFilterWithId,
} from 'common/constants';
import CurvesPicker from 'renderer/components/CurvesPicker';
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
const mockSetTone = jest.fn();

jest.mock('renderer/utils/equalizerApi', () => ({
  clearConvolution: jest.fn(),
  clearGains: (...args: unknown[]) => mockClearGains(...args),
  setDriver: jest.fn(),
  setHeadphone: jest.fn(),
  setLayerBypass: jest.fn(),
  setSmartEq: jest.fn(),
  setTone: (...args: unknown[]) => mockSetTone(...args),
  setVoicing: (...args: unknown[]) => mockSetVoicing(...args),
  writeApoConfigFile: (...args: unknown[]) => mockWriteApoConfigFile(...args),
}));

const MENU = 'Also shaping this output';

const curves = () => screen.queryByRole('button', { name: 'Curves' });

/** The chips live in the Curves menu; this opens it unless it is open. */
const openCurves = () => {
  if (!screen.queryByRole('menu', { name: MENU })) {
    fireEvent.click(screen.getByRole('button', { name: 'Curves' }));
  }
  return screen.getByRole('menu', { name: MENU });
};

const shapedBand = (gain = 4) => ({ ...getDefaultFilterWithId(), gain });

const smartEqLayer = (intensity: number) => {
  const filter = getDefaultFilterWithId();
  filter.type = FilterTypeEnum.PK;
  filter.frequency = 1000;
  filter.gain = 3;
  return { filters: { [filter.id]: filter }, intensity };
};

const renderCurves = (value: IFluidEqContext) =>
  render(
    <FluidEqProviderWrapper value={value}>
      <CurvesPicker />
    </FluidEqProviderWrapper>,
  );

describe('Curves, the applied layers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteApoConfigFile.mockResolvedValue(undefined);
    mockClearGains.mockResolvedValue(undefined);
    mockRefreshState.mockResolvedValue(undefined);
  });

  it('is not there while nothing is applied, and is once something is', () => {
    const band = shapedBand(0);
    const view = (gain: number) => (
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          filters: { [band.id]: { ...band, gain } },
        }}
      >
        <CurvesPicker />
      </FluidEqProviderWrapper>
    );
    const { container, rerender } = render(view(0));
    expect(container).toBeEmptyDOMElement();
    rerender(view(2));
    expect(curves()).toBeInTheDocument();
  });

  /*
   * The button names the lines the graph draws without being opened: a dot
   * per layer in its colour, and a layer switched off keeps its dot, hollow,
   * so the dots and the menu's rows never disagree about how many there are.
   */
  it('shows a dot of each layer, hollow for one switched off', () => {
    const band = shapedBand();
    renderCurves({
      ...defaultFluidEqContext,
      filters: { [band.id]: band },
      smartEq: smartEqLayer(1),
      bypassed: ['eq'],
    });

    const dots = Array.from(
      curves()?.querySelectorAll<HTMLElement>('.active-layers__dots > i') ?? [],
    );
    expect(dots).toHaveLength(2);
    expect(dots.filter((dot) => dot.classList.contains('is-off'))).toHaveLength(
      1,
    );
    const colours = dots.map((dot) => dot.style.color);
    expect(colours.every(Boolean)).toBe(true);
    expect(new Set(colours).size).toBe(2);

    const menu = openCurves();
    expect(menu.querySelectorAll('.active-layer')).toHaveLength(dots.length);
  });

  it('closes on Escape and on a press elsewhere, not on a press inside', () => {
    const band = shapedBand();
    renderCurves({ ...defaultFluidEqContext, filters: { [band.id]: band } });

    const menu = openCurves();
    fireEvent.mouseDown(menu.querySelector('.active-layer') as Element);
    expect(screen.getByRole('menu', { name: MENU })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: MENU })).not.toBeInTheDocument();

    openCurves();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu', { name: MENU })).not.toBeInTheDocument();
    expect(curves()).toHaveAttribute('aria-expanded', 'false');
  });

  /*
   * Removing the last layer from the open menu takes the button away. The
   * next layer applied brings it back closed: a menu springing open by
   * itself, over whatever was being done, reads as a fault.
   */
  it('comes back closed after the last layer was removed from it', () => {
    const band = shapedBand(0);
    const view = (gain: number) => (
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          filters: { [band.id]: { ...band, gain } },
        }}
      >
        <CurvesPicker />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(view(3));
    openCurves();
    rerender(view(0));
    expect(curves()).not.toBeInTheDocument();
    rerender(view(3));
    expect(curves()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu', { name: MENU })).not.toBeInTheDocument();
  });

  it('clears the user config filter file without clearing generated EQ', async () => {
    const fileName = 'fluideq-0123456789ab-custom.txt';
    renderCurves({
      ...defaultFluidEqContext,
      customFx: { fileName, preAmp: 0, filters: {} },
      refreshState: mockRefreshState,
    });
    openCurves();

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
    const band = shapedBand();
    renderCurves({
      ...defaultFluidEqContext,
      isFlat: false,
      filters: { [band.id]: band },
      refreshState: mockRefreshState,
    });
    openCurves();

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
   * The Tone is a layer of its own, so a chip of its own, named by the dials
   * away from zero. Its × resets the dials and leaves the bands; the EQ
   * chip's × resets the bands and leaves the dials.
   */
  it('gives the Tone a chip of its own, cleared apart from the bands', async () => {
    const band = shapedBand();
    mockSetTone.mockResolvedValue(undefined);
    renderCurves({
      ...defaultFluidEqContext,
      isFlat: false,
      filters: { [band.id]: band },
      tone: { bass: 3, mid: 0, treble: -2 },
      refreshState: mockRefreshState,
    });
    openCurves();
    expect(screen.getByText(/Bass \+3.*Treble -2/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Reset every band to 0 dB' }),
      );
      await Promise.resolve();
    });
    expect(mockClearGains).toHaveBeenCalledTimes(1);
    expect(mockSetTone).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Reset Bass, Mid and Treble to 0 dB',
        }),
      );
      await Promise.resolve();
    });
    expect(mockSetTone).toHaveBeenCalledWith(null);
    expect(mockClearGains).toHaveBeenCalledTimes(1);
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
    renderCurves({
      ...defaultFluidEqContext,
      voicing: { profileId, intensity: 1, apoOverride: { filters: {} } },
    });
    openCurves();
    expect(screen.getByTitle(name)).toHaveClass('active-layer__name');
    expect(screen.queryByText('Equalizer APO edit')).not.toBeInTheDocument();
  });

  it('keeps the Smart EQ chip and strength control visible at zero', () => {
    renderCurves({
      ...defaultFluidEqContext,
      smartEq: smartEqLayer(0),
      refreshState: mockRefreshState,
    });
    openCurves();

    expect(screen.getAllByText('Smart EQ')).toHaveLength(2);
    expect(screen.getByRole('slider', { name: 'Strength' })).toHaveValue('0');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('uses the current sampled EQ rather than dormant parametric gains', () => {
    const band = shapedBand(8);
    const view = (gain: number) => (
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          eqFormat: AutoEqFormat.GRAPHIC,
          filters: { [band.id]: band },
          graphicEq: [{ frequency: 100, gain }],
        }}
      >
        <CurvesPicker />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(view(0));
    expect(curves()).not.toBeInTheDocument();
    rerender(view(0.01));
    openCurves();
    expect(
      screen.getByRole('button', { name: 'Reset every band to 0 dB' }),
    ).toBeInTheDocument();
  });

  it('names the EQ by its selected design, with a band-count fallback', () => {
    const band = shapedBand();
    const context = {
      ...defaultFluidEqContext,
      filters: { [band.id]: band },
      eqBandDesign: {
        id: 'design',
        name: 'My bass layout',
        bands: [{ frequency: band.frequency, quality: band.quality }],
      },
    };
    const { rerender } = renderCurves(context);
    openCurves();
    expect(screen.getByText('My bass layout')).toBeInTheDocument();
    rerender(
      <FluidEqProviderWrapper value={{ ...context, eqBandDesign: undefined }}>
        <CurvesPicker />
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
    const band = shapedBand(0);
    const view = (bypassed: IFluidEqContext['bypassed']) => (
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          filters: { [band.id]: band },
          bypassed,
        }}
      >
        <CurvesPicker />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(view(['eq']));
    openCurves();
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
      renderCurves({
        ...defaultFluidEqContext,
        voicing: { profileId, intensity: 1, apoOverride: { filters: {} } },
        refreshState: mockRefreshState,
      });
      openCurves();

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
    const band = shapedBand();
    const context = {
      ...defaultFluidEqContext,
      isFlat: false,
      filters: { [band.id]: band },
      refreshState: mockRefreshState,
      setPreAmp: jest.fn(),
    };
    const view = (gain: number) => (
      <FluidEqProviderWrapper
        value={{ ...context, filters: { [band.id]: { ...band, gain } } }}
      >
        <CurvesPicker />
      </FluidEqProviderWrapper>
    );
    const { rerender } = render(view(4));
    openCurves();
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
    openCurves();
    expect(
      screen.getByRole('button', { name: 'Reset every band to 0 dB' }),
    ).toBeInTheDocument();
  });
});
