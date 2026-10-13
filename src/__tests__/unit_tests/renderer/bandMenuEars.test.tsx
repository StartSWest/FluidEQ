/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Which ear a band plays on is chosen in the band's own menu and nowhere
 * else: two of the menu's lines, Both ears and Left + right, with a tick on
 * the one in use (Ivan, 2026-10-13: "something really nice and simple",
 * then of three lines with each ear alone, "no too confusing lets do both
 * and left + right").
 */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, type IFilter } from 'common/constants';
import BandMenu from 'renderer/components/BandMenu';
import { ENGINE_UPDATE_REQUEST_EVENT } from 'renderer/utils/engineUpdateRequest';

let mockEngine: {
  engine: string;
  fluidUpdateReady?: boolean;
  fluid?: { dllVersion?: string };
} = {
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
  it('offers both ears and left + right as two lines, ticking the one in use', () => {
    show([band('a', 'left')]);
    expect(earLines().map((line) => line.textContent)).toEqual([
      'Both ears',
      'Left + right',
    ]);
    expect(earLines().map((line) => line.getAttribute('aria-checked'))).toEqual(
      ['false', 'true'],
    );
    // No joined track anywhere: the lines are the menu's own.
    expect(document.querySelector('.segmented')).toBeNull();
  });

  it('ticks Both for a band that names no ear', () => {
    show([band('a')]);
    expect(earLines()[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('ticks nothing over a selection holding a pair and a band on both', () => {
    show([band('a', 'left'), band('b')]);
    expect(
      earLines().filter((line) => line.getAttribute('aria-checked') === 'true'),
    ).toHaveLength(0);
  });

  it('sets the ear of every band it acts on and closes', () => {
    const filters = [band('a'), band('b')];
    const { onSetChannel, onClose } = show(filters);
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Left + right' }),
    );
    expect(onSetChannel).toHaveBeenCalledWith(filters, 'split');
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes the bands it acts on, and offers it only where the EQ allows', () => {
    const filters = [band('a'), band('b')];
    const onDelete = jest.fn();
    render(
      <BandMenu
        filter={filters[0]}
        filters={filters}
        x={10}
        y={10}
        onReset={jest.fn()}
        onSetEnabled={jest.fn()}
        onAddBeside={jest.fn()}
        onDelete={onDelete}
        onClose={jest.fn()}
      />,
    );
    // The first press asks; only the second deletes.
    fireEvent.click(screen.getByText('Delete 2 bands'));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Press again to delete'));
    expect(onDelete).toHaveBeenCalledWith(filters);
    cleanup();
    show([band('a')]);
    expect(screen.queryByText('Delete band')).toBeNull();
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

  it('offers the update itself where this build carries a newer engine', () => {
    const asked = jest.fn();
    window.addEventListener(ENGINE_UPDATE_REQUEST_EVENT, asked);
    mockEngine = {
      engine: 'fluid',
      fluidUpdateReady: true,
      fluid: { dllVersion: '1.20.0.0' },
    };
    const { onClose } = show([band('a', 'left')]);
    fireEvent.click(screen.getByRole('button', { name: 'Update engine' }));
    expect(asked).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    window.removeEventListener(ENGINE_UPDATE_REQUEST_EVENT, asked);
    cleanup();
    // The control: nothing newer to install, so the note stands alone.
    mockEngine = {
      engine: 'fluid',
      fluidUpdateReady: false,
      fluid: { dllVersion: '1.20.0.0' },
    };
    show([band('a', 'left')]);
    expect(screen.getByText(/plays this band on both ears/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Update engine' })).toBeNull();
  });
});
