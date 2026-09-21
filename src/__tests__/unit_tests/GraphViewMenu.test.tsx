import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import GraphViewMenu from 'renderer/graph/GraphViewMenu';
import type { TGraphCurve } from 'renderer/utils/graphStyle';

const renderMenuForSizing = (
  overrides: Partial<ComponentProps<typeof GraphViewMenu>> = {},
) =>
  render(
    <GraphViewMenu
      view="normal"
      onChangeView={jest.fn()}
      onCycleLook={jest.fn()}
      isWaveHidden={false}
      onToggleWave={jest.fn()}
      curveToggles={[]}
      hiddenCurves={[]}
      onToggleCurve={jest.fn()}
      contents="everything"
      onCycleContents={jest.fn()}
      isGridHidden={false}
      onToggleGrid={jest.fn()}
      isCoverageHidden={false}
      onToggleCoverage={jest.fn()}
      isMeterHidden={false}
      onToggleMeter={jest.fn()}
      isTitlebarWaveHidden={false}
      onToggleTitlebarWave={jest.fn()}
      waveHeight={1}
      onChangeWaveHeight={jest.fn()}
      wavePosition={0}
      onChangeWavePosition={jest.fn()}
      waveOrientation="up"
      onCycleOrientation={jest.fn()}
      overlayOpacity={1}
      onChangeOverlayOpacity={jest.fn()}
      overlayBlur={0}
      onChangeOverlayBlur={jest.fn()}
      minOverlayOpacity={0}
      maxOverlayBlur={40}
      hasTopBar
      onToggleTopBar={jest.fn()}
      // eslint-disable-next-line react/jsx-props-no-spreading -- a test's overrides of a thirty-prop component
      {...overrides}
    />,
  );

describe('GraphViewMenu curve toggles', () => {
  it('shows every active curve in APO application order', () => {
    const onToggleCurve = jest.fn();
    const curveToggles: { curve: TGraphCurve; label: string }[] = [
      { curve: 'convolution', label: 'Headset convolution' },
      { curve: 'driver', label: 'Driver' },
      { curve: 'headphone', label: 'Headphone' },
      { curve: 'eq', label: 'EQ response' },
      { curve: 'voicing', label: 'Preset' },
      { curve: 'smart', label: 'Smart EQ' },
      { curve: 'custom', label: 'Custom FX' },
      { curve: 'total', label: 'Final output' },
    ];

    render(
      <GraphViewMenu
        view="normal"
        onChangeView={jest.fn()}
        onCycleLook={jest.fn()}
        isWaveHidden={false}
        onToggleWave={jest.fn()}
        curveToggles={curveToggles}
        hiddenCurves={['driver']}
        onToggleCurve={onToggleCurve}
        contents="everything"
        onCycleContents={jest.fn()}
        isGridHidden={false}
        onToggleGrid={jest.fn()}
        isCoverageHidden={false}
        onToggleCoverage={jest.fn()}
        isMeterHidden={false}
        onToggleMeter={jest.fn()}
        isTitlebarWaveHidden={false}
        onToggleTitlebarWave={jest.fn()}
        waveHeight={1}
        onChangeWaveHeight={jest.fn()}
        wavePosition={0}
        onChangeWavePosition={jest.fn()}
        waveOrientation="up"
        onCycleOrientation={jest.fn()}
        overlayOpacity={1}
        onChangeOverlayOpacity={jest.fn()}
        overlayBlur={0}
        onChangeOverlayBlur={jest.fn()}
        minOverlayOpacity={0}
        maxOverlayBlur={40}
        hasTopBar
        onToggleTopBar={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const menu = screen.getByRole('menu');
    const checkboxRows = within(menu).getAllByRole('menuitemcheckbox');
    const curveRows = checkboxRows.slice(0, curveToggles.length);
    expect(curveRows.map((row) => row.textContent)).toEqual([
      'Hide Headset convolution',
      'Show Driver',
      'Hide Headphone',
      'Hide EQ response',
      'Hide Preset',
      'Hide Smart EQ',
      'Hide Custom FX',
      'Hide Final output',
    ]);
    expect(checkboxRows[curveToggles.length]).toHaveTextContent(
      'Hide the wave',
    );
    expect(checkboxRows[curveToggles.length + 1]).toHaveTextContent(
      'Hide top wave',
    );

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Show Driver' }),
    );
    expect(onToggleCurve).toHaveBeenCalledWith('driver');
  });

  it('uses the menu natural height when the viewport has room', () => {
    const height = jest
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(240);
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1080,
    });

    renderMenuForSizing();
    const trigger = screen.getByRole('button', { name: 'View' });
    jest
      .spyOn(trigger.parentElement as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({
        bottom: 80,
        height: 30,
        left: 0,
        right: 240,
        top: 50,
        width: 240,
        x: 0,
        y: 50,
        toJSON: () => ({}),
      });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toHaveStyle({
      maxHeight: 'none',
      overflowY: 'visible',
    });

    height.mockRestore();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
    });
  });

  it('caps and scrolls the menu only when neither side has enough room', () => {
    const height = jest
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(600);
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 300,
    });

    renderMenuForSizing();
    const trigger = screen.getByRole('button', { name: 'View' });
    jest
      .spyOn(trigger.parentElement as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({
        bottom: 130,
        height: 30,
        left: 0,
        right: 240,
        top: 100,
        width: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toHaveStyle({
      maxHeight: '158px',
      overflowY: 'auto',
    });

    height.mockRestore();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
    });
  });
});

describe('GraphViewMenu wave sliders', () => {
  it('keeps the pane a measurement: no wave sliders without a Plus scene', () => {
    renderMenuForSizing({ view: 'normal' });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(screen.queryByLabelText('Wave height')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Wave position')).not.toBeInTheDocument();
  });

  it('offers both sliders in the pane while a Plus scene is on the plot', () => {
    const onChangeWaveHeight = jest.fn();
    const onChangeWavePosition = jest.fn();
    renderMenuForSizing({
      view: 'normal',
      sceneLookId: 'premium:aurora',
      onChangeWaveHeight,
      onChangeWavePosition,
    });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    const height = screen.getByLabelText('Wave height');
    const position = screen.getByLabelText('Wave position');
    expect(height).toBeEnabled();
    expect(position).toBeEnabled();

    fireEvent.change(height, { target: { value: '50' } });
    fireEvent.change(position, { target: { value: '40' } });
    expect(onChangeWaveHeight).toHaveBeenCalledWith(0.5);
    expect(onChangeWavePosition).toHaveBeenCalledWith(0.4);
  });
});

describe('GraphViewMenu listening bands', () => {
  it('greys the listening bands while a Plus scene is on the plot, which never draws them', () => {
    renderMenuForSizing({
      sceneLookId: 'premium:alpine',
      isCoverageHidden: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(
      screen.getByRole('menuitemcheckbox', { name: /listening bands/ }),
    ).toBeDisabled();
  });

  it('keeps them a switch on the graph itself', () => {
    const onToggleCoverage = jest.fn();
    renderMenuForSizing({ onToggleCoverage });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const bands = screen.getByRole('menuitemcheckbox', {
      name: /listening bands/,
    });
    expect(bands).toBeEnabled();
    fireEvent.click(bands);
    expect(onToggleCoverage).toHaveBeenCalledTimes(1);
  });
});
