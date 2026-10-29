/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import KaraokeGraphBackground from '../../../renderer/karaoke/KaraokeGraphBackground';
import KaraokeBackdrop, {
  karaokeBackdropKind,
} from '../../../renderer/karaoke/KaraokeBackdrop';
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

// The music the stage's lights follow (`KaraokeLights`), set by a test.
const mockMusic: { reading?: Record<string, number> } = {};
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({
    isPaused: false,
    readFrame: () =>
      mockMusic.reading
        ? { sound: { music: () => mockMusic.reading } }
        : undefined,
  }),
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

it('draws no lights of its own while the window’s visualizer is behind the page', () => {
  const playhead = createKaraokeLiveValue(0);
  const { container, rerender } = render(
    <KaraokeBackdrop
      background="none"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay
    />,
  );
  expect(container.querySelector('.karaoke-stage-media')).toBeNull();
  // The control: the same page without the visualizer has its lights.
  rerender(
    <KaraokeBackdrop
      background="none"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay={false}
    />,
  );
  expect(container.querySelector('.karaoke-ambient')).toBeInTheDocument();
  expect(karaokeBackdropKind('none', undefined, true)).toBe('none');
  expect(karaokeBackdropKind('graph', undefined, true)).toBe('graph');
});

it('lights the stage with the music while the song plays, and lets it go when it stops', () => {
  // Frames by hand, and a cancelled one never runs: the loop that stops
  // when the song does must not keep going behind the new one.
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id) => frames.delete(id));
  const runFrames = (count: number, from: number) => {
    for (let i = 0; i < count; i += 1) {
      const due = [...frames.values()];
      frames.clear();
      act(() => due.forEach((callback) => callback(from + i * 16)));
    }
  };
  const lightOf = (layer: Element | null, key: string) =>
    Number(
      (layer as HTMLElement).style.getPropertyValue(`--karaoke-light-${key}`),
    );
  mockMusic.reading = { level: 0.8, bass: 0.9, treble: 0.6, beat: 1 };
  const playhead = createKaraokeLiveValue(0);
  const { container, rerender } = render(
    <KaraokeBackdrop
      background="none"
      playhead={playhead}
      isPlaying
      isGraphOverlay={false}
    />,
  );
  runFrames(30, 0);
  const layer = container.querySelector('.karaoke-ambient');
  expect(lightOf(layer, 'level')).toBeGreaterThan(0.7);
  expect(lightOf(layer, 'bass')).toBeGreaterThan(0.8);
  expect(lightOf(layer, 'treble')).toBeGreaterThan(0.5);
  rerender(
    <KaraokeBackdrop
      background="none"
      playhead={playhead}
      isPlaying={false}
      isGraphOverlay={false}
    />,
  );
  runFrames(200, 1000);
  expect(lightOf(layer, 'level')).toBeLessThan(0.01);
  // Back at rest, the loop has stopped asking for frames.
  expect(frames.size).toBe(0);
  mockMusic.reading = undefined;
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
