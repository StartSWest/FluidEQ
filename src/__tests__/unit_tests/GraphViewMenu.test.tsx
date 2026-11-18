import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import GraphViewMenu from 'renderer/graph/GraphViewMenu';
import KaraokeSceneAppearanceControls from 'renderer/karaoke/KaraokeSceneAppearanceControls';
import {
  setKaraokeSceneBlur,
  setKaraokeSceneOpacity,
} from 'renderer/karaoke/karaokeSceneAppearance';
import type { TGraphCurve } from 'renderer/utils/graphStyle';
import {
  readScenePerformance,
  resetScenePerformanceForTesting,
} from 'renderer/utils/scenePerformanceStore';

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
      isGridHidden={false}
      onToggleGrid={jest.fn()}
      isMeterHidden={false}
      onToggleMeter={jest.fn()}
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
      // eslint-disable-next-line react/jsx-props-no-spreading -- a test's overrides of a thirty-prop component
      {...overrides}
    />,
  );

describe('GraphViewMenu curve toggles', () => {
  it('offers independent Karaoke appearance controls in normal View without editing the graph', () => {
    act(() => {
      setKaraokeSceneOpacity(1);
      setKaraokeSceneBlur(0);
    });
    const graphOpacity = jest.fn();
    const graphBlur = jest.fn();
    renderMenuForSizing({
      view: 'normal',
      sceneLookId: 'premium:aurora',
      hasPlaybackBackdrop: true,
      backdropControls: <KaraokeSceneAppearanceControls />,
      onChangeOverlayOpacity: graphOpacity,
      onChangeOverlayBlur: graphBlur,
    });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.change(screen.getByRole('slider', { name: 'See through' }), {
      target: { value: '75' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Blur' }), {
      target: { value: '12' },
    });
    expect(window.localStorage.getItem('fluideq-karaoke-scene-opacity')).toBe(
      '0.25',
    );
    expect(window.localStorage.getItem('fluideq-karaoke-scene-blur')).toBe(
      '12',
    );
    expect(graphOpacity).not.toHaveBeenCalled();
    expect(graphBlur).not.toHaveBeenCalled();
  });
  it('offers see-through and blur for a Plus graph over Karaoke', () => {
    const opacity = jest.fn();
    const blur = jest.fn();
    renderMenuForSizing({
      view: 'fullscreen',
      sceneLookId: 'premium:aurora',
      hasPlaybackBackdrop: true,
      onChangeOverlayOpacity: opacity,
      onChangeOverlayBlur: blur,
    });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.change(screen.getByRole('slider', { name: 'See through' }), {
      target: { value: '75' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Blur' }), {
      target: { value: '12' },
    });
    expect(opacity).toHaveBeenCalledWith(0.25);
    expect(blur).toHaveBeenCalledWith(12);
  });
  it('offers drawing controls for a Standard visualizer and saves them separately from Plus', () => {
    window.localStorage.removeItem('fluideq.standardPerformance');
    resetScenePerformanceForTesting();
    const plus = readScenePerformance('plus');
    const { unmount } = renderMenuForSizing();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(
      screen.getByRole('menuitem', { name: 'Resolution Full' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Scaler Plain' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Smooth edges Off' }));
    expect(
      screen.getByRole('menuitem', { name: 'Smooth edges Fast' }),
    ).toBeInTheDocument();
    expect(readScenePerformance('standard').smoothing).toBe('fast');
    expect(readScenePerformance('plus')).toEqual(plus);
    unmount();
    window.localStorage.removeItem('fluideq.standardPerformance');
    resetScenePerformanceForTesting();
  });

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
        isGridHidden={false}
        onToggleGrid={jest.fn()}
        isMeterHidden={false}
        onToggleMeter={jest.fn()}
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const menu = screen.getByRole('menu');
    // Every drawing is a named switch since 2026-11-16, its state on the
    // switch rather than a "Hide …"/"Show …" label; the top wave has none,
    // as it always shows.
    const switches = within(menu).getAllByRole('checkbox');
    const name = (row: HTMLElement) => row.getAttribute('aria-label');
    expect(switches.slice(0, curveToggles.length + 4).map(name)).toEqual([
      'Headset convolution',
      'Driver',
      'Headphone',
      'EQ response',
      'Preset',
      'Smart EQ',
      'Custom FX',
      'Final output',
      'EQ labels',
      'Legend',
      'Wave',
      'Grid',
    ]);
    expect(
      switches
        .slice(0, curveToggles.length)
        .map((row) => (row as HTMLInputElement).checked),
    ).toEqual(curveToggles.map(({ curve }) => curve !== 'driver'));
    expect(within(menu).queryByRole('checkbox', { name: /top wave/i })).toBe(
      null,
    );

    fireEvent.click(within(menu).getByRole('checkbox', { name: 'Driver' }));
    expect(onToggleCurve).toHaveBeenCalledWith('driver');
    expect(onToggleCurve).toHaveBeenCalledTimes(1);
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
      maxHeight: '154px',
      overflowY: 'auto',
    });

    height.mockRestore();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
    });
  });

  // The cap was measured only as the menu opened, so a group unfolded in a
  // list that had fitted ran its last rows off the bottom of the window.
  it('caps the list again when a group is unfolded, on the side it opened on', () => {
    let wanted = 90;
    const height = jest
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(() => wanted);
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 400,
    });

    renderMenuForSizing();
    const trigger = screen.getByRole('button', { name: 'View' });
    jest
      .spyOn(trigger.parentElement as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({
        bottom: 280,
        height: 30,
        left: 0,
        right: 240,
        top: 250,
        width: 240,
        x: 0,
        y: 250,
        toJSON: () => ({}),
      });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ maxHeight: 'none', overflowY: 'visible' });

    const [, group] = Array.from(
      menu.querySelectorAll<HTMLElement>('.graph-view-menu__group'),
    );
    fireEvent.click(group);
    wanted = 300;
    fireEvent.click(group);

    // 104 px below the button and 234 above: the list stays below, where the
    // pointer that unfolded it is, and scrolls in the room it has there.
    expect(menu).not.toHaveClass('is-above');
    expect(menu).toHaveStyle({ maxHeight: '120px', overflowY: 'auto' });

    window.localStorage.removeItem('fluideq.graphMenuFold');
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

// The listening bands left the graph on 2026-11-16 (01afe84f6): no shaded
// columns over the plot, and no switch for them in this menu.
describe('GraphViewMenu listening bands', () => {
  it('offers no switch for them any more', () => {
    renderMenuForSizing();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    // The menu is open and has its switches, so the absence below is the
    // row's and not a menu that never opened.
    expect(screen.getByRole('checkbox', { name: 'Grid' })).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /listening bands/i }),
    ).toBeNull();
    expect(screen.queryByText(/listening bands/i)).toBeNull();
  });
});
