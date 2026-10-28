/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import KaraokeGraphBackground, {
  useKaraokeGraphHost,
} from '../../../renderer/karaoke/KaraokeGraphBackground';
import {
  readKaraokeBackground,
  writeKaraokeBackground,
} from '../../../renderer/karaoke/karaokeWorkspacePrefs';

function GraphShell() {
  const host = useKaraokeGraphHost();
  const graph = (
    <div data-testid="current-graph">Current graph + visualizer</div>
  );
  return host ? createPortal(graph, host) : <aside>{graph}</aside>;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  jest.restoreAllMocks();
});

it('moves the one graph into the stage and returns it when the stage leaves', () => {
  const { container, rerender } = render(
    <>
      <GraphShell />
      <KaraokeGraphBackground />
    </>,
  );
  const backdrop = container.querySelector('.karaoke-graph-background');
  expect(backdrop).toContainElement(screen.getByTestId('current-graph'));
  expect(backdrop).toHaveAttribute('inert');
  expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getAllByTestId('current-graph')).toHaveLength(1);

  rerender(<GraphShell />);
  expect(container.querySelector('aside')).toContainElement(
    screen.getByTestId('current-graph'),
  );
  expect(container.querySelector('.karaoke-graph-background')).toBeNull();
  expect(screen.getAllByTestId('current-graph')).toHaveLength(1);
});

it.each(['cover', 'graph', 'none'] as const)(
  'remembers the %s background',
  (mode) => {
    writeKaraokeBackground(mode);
    expect(readKaraokeBackground()).toBe(mode);
  },
);

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
