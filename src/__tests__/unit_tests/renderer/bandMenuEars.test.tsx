/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Which ear a band plays on is chosen in the band's own menu and nowhere
 * else: three of the menu's lines with a tick on the one in use (Ivan,
 * 2026-10-13: "something really nice and simple and not really messing with
 * ui", "I dont like the joined left right pill").
 */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, type IFilter } from 'common/constants';
import BandMenu from 'renderer/components/BandMenu';

let mockEngine: { engine: string; fluid?: { dllVersion?: string } } = {
  engine: 'apo',
};
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => mockEngine,
}));

afterEach(() => {
  cleanup();
  mockEngine = { engine: 'apo' };
});

const band = (id: string, channel?: IFilter['channel']): IFilter => ({
  id,
  frequency: 5600,
  gain: -2.5,
  quality: 3,
  type: FilterTypeEnum.PK,
  ...(channel ? { channel } : {}),
});

const show = (filters: IFilter[]) => {
  const onSetChannel = jest.fn();
  const onClose = jest.fn();
  render(
    <BandMenu
      filter={filters[0]}
      filters={filters}
      x={10}
      y={10}
      onReset={jest.fn()}
      onSetEnabled={jest.fn()}
      onAddBeside={jest.fn()}
      onSetChannel={onSetChannel}
      onClose={onClose}
    />,
  );
  return { onSetChannel, onClose };
};

const earLines = () => screen.getAllByRole('menuitemradio');

describe("a band's menu chooses its ear", () => {
  it('offers both ears, the left and the right as three lines, ticking the one in use', () => {
    show([band('a', 'left')]);
    expect(earLines().map((line) => line.textContent)).toEqual([
      'Both ears',
      'Left ear only',
      'Right ear only',
    ]);
    expect(earLines().map((line) => line.getAttribute('aria-checked'))).toEqual(
      ['false', 'true', 'false'],
    );
    // No joined track anywhere: the lines are the menu's own.
    expect(document.querySelector('.segmented')).toBeNull();
  });

  it('ticks Both for a band that names no ear', () => {
    show([band('a')]);
    expect(earLines()[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('ticks nothing over a selection split between the ears', () => {
    show([band('a', 'left'), band('b', 'right')]);
    expect(
      earLines().filter((line) => line.getAttribute('aria-checked') === 'true'),
    ).toHaveLength(0);
  });

  it('sets the ear of every band it acts on and closes', () => {
    const filters = [band('a'), band('b')];
    const { onSetChannel, onClose } = show(filters);
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Right ear only' }),
    );
    expect(onSetChannel).toHaveBeenCalledWith(filters, 'right');
    expect(onClose).toHaveBeenCalled();
  });

  it('says an older FluidEQ Engine plays a one-ear band on both, and only then', () => {
    mockEngine = { engine: 'fluid', fluid: { dllVersion: '1.20.0.0' } };
    show([band('a', 'left')]);
    expect(screen.getByText(/plays this band on both ears/)).toBeVisible();
    cleanup();
    // The controls: an up-to-date engine, and a band on both ears.
    mockEngine = { engine: 'fluid', fluid: { dllVersion: '1.21.0.0' } };
    show([band('a', 'left')]);
    expect(screen.queryByText(/plays this band on both ears/)).toBeNull();
    cleanup();
    mockEngine = { engine: 'fluid', fluid: { dllVersion: '1.20.0.0' } };
    show([band('a')]);
    expect(screen.queryByText(/plays this band on both ears/)).toBeNull();
  });
});
