/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
import QueueDropNotice from 'renderer/player/QueueDropNotice';
import { clearDropNotice, showDropNotice } from 'renderer/player/dropNotice';

/**
 * A drop on the amp that puts nothing on Up next says why: a drop that
 * visibly does nothing is a bug. The word stays until it is dismissed or the
 * next thing happens, and no timer takes it away.
 */
const at = (position: number, total: number) => (
  <QueueDropNotice position={position} total={total} />
);

afterEach(() => act(() => clearDropNotice()));

describe('the word over the queue after a drop', () => {
  it('says nothing until a drop has something to say', () => {
    render(at(1, 5));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['empty', en['library.drop.empty']],
    ['already', en['library.drop.already']],
    ['failed', en['library.drop.failed']],
  ] as const)('names what a %s drop came to', (outcome, words) => {
    render(at(1, 5));
    act(() => showDropNotice(outcome));
    expect(screen.getByRole('status')).toHaveTextContent(words);
  });

  it('goes when it is dismissed', () => {
    render(at(1, 5));
    act(() => showDropNotice('empty'));
    fireEvent.click(screen.getByRole('button', { name: en['app.dismiss'] }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays while the queue stands still, and goes when the song changes', () => {
    const view = render(at(1, 5));
    act(() => showDropNotice('already'));
    view.rerender(at(1, 5));
    expect(screen.getByRole('status')).toBeInTheDocument();
    view.rerender(at(2, 5));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('goes when Up next changes', () => {
    const view = render(at(1, 5));
    act(() => showDropNotice('empty'));
    view.rerender(at(1, 6));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
