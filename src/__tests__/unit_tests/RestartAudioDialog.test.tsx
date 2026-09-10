/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import en from 'common/i18n/en';
import RestartAudioDialog from 'renderer/components/RestartAudioDialog';

const restartButton = () =>
  screen.getByRole('button', { name: en['restart.action'] });

describe('RestartAudioDialog', () => {
  it('asks in the app, with the loud style on the restart', () => {
    render(<RestartAudioDialog onRestart={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(en['notice.restartConfirm'])).toBeInTheDocument();
    expect(restartButton()).toHaveClass('button', 'small');
    expect(restartButton()).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: en['config.cancel'] }),
    ).toHaveClass('button', 'small', 'subtle');
    expect(restartButton()).toHaveFocus();
  });

  it('closes on Cancel and on Escape, but never mid-restart', async () => {
    const onClose = jest.fn();
    let finish: (error: string) => void = () => {};
    const onRestart = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    render(<RestartAudioDialog onRestart={onRestart} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(restartButton());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Progress from the first second: the button breathes and the foot says
    // what is happening, because Windows takes seconds to answer.
    expect(restartButton()).toHaveClass('is-running');
    expect(screen.getByText(en['restart.running'])).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: en['config.cancel'] }),
    ).toBeDisabled();

    finish('');
    await waitFor(() =>
      expect(screen.getByText(en['notice.restartDone'])).toBeInTheDocument(),
    );
    const ok = screen.getByRole('button', { name: en['whatsNew.ok'] });
    expect(ok).toHaveFocus();
    fireEvent.click(ok);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows the reason it failed and offers to try again', async () => {
    const onRestart = jest
      .fn()
      .mockResolvedValueOnce('Windows said no')
      .mockResolvedValueOnce('');
    render(<RestartAudioDialog onRestart={onRestart} onClose={jest.fn()} />);

    fireEvent.click(restartButton());
    expect(await screen.findByText(en['restart.failed'])).toBeInTheDocument();
    expect(screen.getByText('Windows said no')).toBeInTheDocument();

    const again = screen.getByRole('button', { name: en['restart.tryAgain'] });
    fireEvent.click(again);
    expect(onRestart).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText(en['notice.restartDone']),
    ).toBeInTheDocument();
    expect(screen.queryByText('Windows said no')).not.toBeInTheDocument();
  });

  it('refuses a second press while the first is still in flight', () => {
    const onRestart = jest.fn(() => new Promise<string>(() => {}));
    render(<RestartAudioDialog onRestart={onRestart} onClose={jest.fn()} />);

    fireEvent.click(restartButton());
    fireEvent.click(restartButton());
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
