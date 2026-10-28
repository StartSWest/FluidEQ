/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import KaraokeGraphBackground from '../../../renderer/karaoke/KaraokeGraphBackground';
import KaraokeBackdrop from '../../../renderer/karaoke/KaraokeBackdrop';
import { createKaraokeLiveValue } from '../../../renderer/karaoke/karaokeLiveValue';
import {
  setGraphContents,
  setGraphView,
} from '../../../renderer/utils/graphStyle';
import { setOverlayBlur } from '../../../renderer/utils/graphOverlay';
import { resetSettings } from '../../../renderer/utils/settingsReset';
import {
  readKaraokeBackground,
  writeKaraokeBackground,
} from '../../../renderer/karaoke/karaokeWorkspacePrefs';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/player/useGraphScenePack', () => ({
  __esModule: true,
  default: () => ({ state: 'none' }),
}));
jest.mock('../../../renderer/graph/LiveTraceCanvas', () => ({
  __esModule: true,
  default: ({ hasKey }: { hasKey: boolean }) => (
    <canvas data-testid="background-trace" data-has-key={String(hasKey)} />
  ),
}));

const originalObserver = global.ResizeObserver;
beforeEach(() => {
  global.ResizeObserver = jest
    .fn()
    .mockImplementation((callback: ResizeObserverCallback) => {
      const observer: ResizeObserver = {
        observe: () =>
          callback(
            [
              {
                contentRect: { width: 800, height: 500 },
              } as ResizeObserverEntry,
            ],
            observer,
          ),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
      return observer;
    });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  jest.restoreAllMocks();
  global.ResizeObserver = originalObserver;
  setGraphContents('everything');
  setGraphView('normal');
});

it('keeps the normal graph separate while the background comes and goes', () => {
  const { container, rerender } = render(
    <>
      <aside data-testid="regular-graph" />
      <KaraokeGraphBackground />
    </>,
  );
  const backdrop = container.querySelector('.karaoke-graph-background');
  expect(backdrop).not.toContainElement(screen.getByTestId('regular-graph'));
  expect(backdrop).toHaveAttribute('inert');
  expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByTestId('background-trace')).toHaveAttribute(
    'data-has-key',
    'false',
  );
  expect(backdrop?.querySelector('svg, button, [role="slider"]')).toBeNull();
  expect(screen.getByTestId('regular-graph')).toBeInTheDocument();

  rerender(<aside data-testid="regular-graph" />);
  expect(screen.getByTestId('regular-graph')).toBeInTheDocument();
  expect(container.querySelector('.karaoke-graph-background')).toBeNull();
});

it('keeps scenery visible when the graph contents are set to Clean', () => {
  setGraphContents('clean');
  render(<KaraokeGraphBackground />);
  expect(screen.getByTestId('background-trace')).toBeInTheDocument();
});

it('unmounts the ambient lights when a visualizer is selected, and restores them alone', () => {
  const playhead = createKaraokeLiveValue(0);
  const { container, rerender } = render(
    <KaraokeBackdrop
      background="none"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay={false}
    />,
  );
  expect(container.querySelectorAll('.karaoke-stage-media')).toHaveLength(1);
  expect(container.querySelector('.karaoke-ambient')).toBeInTheDocument();
  rerender(
    <KaraokeBackdrop
      background="graph"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay={false}
    />,
  );
  expect(container.querySelector('.karaoke-ambient')).toBeNull();
  expect(screen.getByTestId('background-trace')).toBeInTheDocument();
  rerender(
    <KaraokeBackdrop
      background="cover"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay={false}
    />,
  );
  expect(container.querySelector('.karaoke-ambient')).toBeInTheDocument();
  expect(screen.queryByTestId('background-trace')).toBeNull();
});

it('applies the graph blur to scenery only while it is behind an overlay', () => {
  setGraphView('expanded');
  setOverlayBlur(16);
  const playhead = createKaraokeLiveValue(0);
  const { container, rerender } = render(
    <KaraokeBackdrop
      background="none"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay
    />,
  );
  expect(
    (container.firstChild as HTMLElement).style.getPropertyValue(
      '--karaoke-backdrop-filter',
    ),
  ).toBe('blur(16px)');
  rerender(
    <KaraokeBackdrop
      background="none"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay={false}
    />,
  );
  expect(
    (container.firstChild as HTMLElement).style.getPropertyValue(
      '--karaoke-backdrop-filter',
    ),
  ).toBe('none');
});

it.each(['cover', 'graph', 'none'] as const)(
  'remembers the %s background',
  (mode) => {
    writeKaraokeBackground(mode);
    expect(readKaraokeBackground()).toBe(mode);
  },
);

it('resets the background preference and legacy art choice without clearing song progress', () => {
  writeKaraokeBackground('graph');
  window.localStorage.setItem('fluideq-karaoke-stage-art-visible', 'false');
  window.localStorage.setItem('fluideq.karaoke.current-progress.v1', 'saved');
  resetSettings(window.localStorage);
  expect(readKaraokeBackground()).toBe('cover');
  expect(
    window.localStorage.getItem('fluideq.karaoke.current-progress.v1'),
  ).toBe('saved');
});

it('keeps the old art visibility preference until a background is selected', () => {
  expect(readKaraokeBackground()).toBe('cover');
  window.localStorage.setItem('fluideq-karaoke-stage-art-visible', 'false');
  expect(readKaraokeBackground()).toBe('none');
  writeKaraokeBackground('graph');
  expect(readKaraokeBackground()).toBe('graph');
});

it('ignores an invalid saved background and handles unavailable storage', () => {
  window.localStorage.setItem('fluideq-karaoke-stage-background', 'invalid');
  expect(readKaraokeBackground()).toBe('cover');
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage is unavailable');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage is unavailable');
  });
  expect(readKaraokeBackground()).toBe('cover');
  expect(() => writeKaraokeBackground('graph')).not.toThrow();
});
