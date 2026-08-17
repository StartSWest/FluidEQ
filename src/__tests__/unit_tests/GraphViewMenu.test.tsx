import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import GraphViewMenu from 'renderer/graph/GraphViewMenu';
import type { TGraphCurve } from 'renderer/utils/graphStyle';

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
});
