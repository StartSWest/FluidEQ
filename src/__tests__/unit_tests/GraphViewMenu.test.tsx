import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import GraphViewMenu from 'renderer/graph/GraphViewMenu';
import type { TGraphCurve } from 'renderer/utils/graphStyle';

const renderMenuForSizing = () =>
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
      waveSize="normal"
      onToggleStretch={jest.fn()}
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

describe('GraphViewMenu curve toggles', () => {
  it('shows every active curve in APO application order', () => {
    const onToggleCurve = jest.fn();
    const curveToggles: { curve: TGraphCurve; label: string }[] = [
      { curve: 'convolution', label: 'Headset convolution' },
      { curve: 'driver', label: 'Driver' },
      { curve: 'headphone', label: 'Headphone' },
      { curve: 'eq', label: 'EQ response' },
      { curve: 'voicing', label: 'Voicing' },
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
        waveSize="normal"
        onToggleStretch={jest.fn()}
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
      'Hide Voicing',
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
