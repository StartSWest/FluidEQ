/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import en from 'common/i18n/en';
import EngineUpdateNotice from 'renderer/components/EngineUpdateNotice';
import type {
  IAudioRestart,
  TRestartPhase,
} from 'renderer/utils/useAudioRestart';

const updateIn = (
  phase: TRestartPhase,
  outcome?: IAudioRestartOutcome,
  isOpen = true,
): IAudioRestart => ({
  isOpen,
  phase,
  outcome,
  open: jest.fn(),
  close: jest.fn(),
  run: jest.fn(async () => undefined),
});

const button = (name: string) => screen.getByRole('button', { name });

describe('EngineUpdateNotice', () => {
  it('offers the update, loud, with a quiet way to put it off', () => {
    const update = updateIn('ask');
    render(<EngineUpdateNotice update={update} isHidden={false} />);

    expect(
      screen.getByRole('dialog', { name: en['engineUpdate.title'] }),
    ).toHaveTextContent(en['engineUpdate.body']);
    expect(screen.getByText(en['engineUpdate.badge'])).toBeInTheDocument();
    // Emphasis follows the recommendation.
    expect(button(en['engineUpdate.action'])).toHaveClass('button', 'small');
    expect(button(en['engineUpdate.action'])).not.toHaveClass('subtle');
    expect(button(en['output.notNow'])).toHaveClass('subtle');

    fireEvent.click(button(en['engineUpdate.action']));
    expect(update.run).toHaveBeenCalledTimes(1);
    fireEvent.click(button(en['output.notNow']));
    expect(update.close).toHaveBeenCalledTimes(1);
  });

  it('shows that it is working from the first moment, and can be closed while it does', () => {
    const update = updateIn('running');
    render(<EngineUpdateNotice update={update} isHidden={false} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(en['engineUpdate.running'])).toBeInTheDocument();
    expect(button(en['engineUpdate.action'])).toHaveClass('is-running');

    // Closing hides the card; the update is not the card's to stop.
    fireEvent.click(button(en['restart.close']));
    expect(update.close).toHaveBeenCalledTimes(1);
    expect(update.run).not.toHaveBeenCalled();
  });

  it('says when it is done, with one button to put it away', () => {
    const update = updateIn('done', { ok: true, declined: false });
    render(<EngineUpdateNotice update={update} isHidden={false} />);

    expect(
      screen.getByRole('dialog', { name: en['engineUpdate.doneTitle'] }),
    ).toHaveTextContent(en['engineUpdate.doneBody']);
    expect(screen.getByText(en['engineUpdate.doneBadge'])).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(button(en['output.gotIt']));
    expect(update.close).toHaveBeenCalledTimes(1);
  });

  it('tells a declined prompt apart from a run that failed', () => {
    const { unmount } = render(
      <EngineUpdateNotice
        update={updateIn('failed', { ok: false, declined: true })}
        isHidden={false}
      />,
    );
    expect(screen.getByText(en['engineUpdate.declined'])).toBeInTheDocument();
    expect(screen.queryByText(en['engineUpdate.failed'])).toBeNull();
    unmount();

    render(
      <EngineUpdateNotice
        update={updateIn('failed', { ok: false, declined: false })}
        isHidden={false}
      />,
    );
    expect(screen.getByText(en['engineUpdate.failed'])).toBeInTheDocument();
    expect(screen.queryByText(en['engineUpdate.declined'])).toBeNull();
  });

  it("puts the helper's own reason under a failure, and offers the update again", () => {
    const update = updateIn('failed', {
      ok: false,
      declined: false,
      detail: 'could not copy FluidEQ-Engine.dll: Access is denied. (5)',
    });
    render(<EngineUpdateNotice update={update} isHidden={false} />);

    expect(
      screen.getByText(
        'could not copy FluidEQ-Engine.dll: Access is denied. (5)',
      ),
    ).toBeInTheDocument();
    fireEvent.click(button(en['restart.tryAgain']));
    expect(update.run).toHaveBeenCalledTimes(1);
  });

  it('is put away with Escape, as the other notices here are', () => {
    const update = updateIn('ask');
    render(<EngineUpdateNotice update={update} isHidden={false} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(update.close).toHaveBeenCalledTimes(1);
  });

  // Out of sight behind the output or the engine trouble notice, an Escape
  // meant for that one would have put this away before it was ever read.
  it('keeps out of an Escape meant for the notice in front of it', () => {
    const update = updateIn('ask');
    const inFront = document.createElement('aside');
    inFront.className = 'device-apo-notice engine-trouble-notice';
    document.body.appendChild(inFront);
    render(<EngineUpdateNotice update={update} isHidden={false} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(update.close).not.toHaveBeenCalled();

    // Positive control: with the spot to itself, the same key puts it away.
    inFront.remove();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(update.close).toHaveBeenCalledTimes(1);
  });

  it('keeps out of an Escape a dialog has already answered', () => {
    const update = updateIn('ask');
    render(<EngineUpdateNotice update={update} isHidden={false} />);
    const dialogAnswers = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', dialogAnswers);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(update.close).not.toHaveBeenCalled();
    document.removeEventListener('keydown', dialogAnswers);
  });

  it('shows nothing while it is not offered, or while something covers the window', () => {
    const closed = updateIn('ask', undefined, false);
    const { rerender } = render(
      <EngineUpdateNotice update={closed} isHidden={false} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    const open = updateIn('ask');
    rerender(<EngineUpdateNotice update={open} isHidden />);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Nothing covered, nothing heard: Escape belongs to what is on screen.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(open.close).not.toHaveBeenCalled();

    // Positive control: the same update, uncovered, is on screen.
    rerender(<EngineUpdateNotice update={open} isHidden={false} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
