/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
import RestartAudioDialog from 'renderer/components/RestartAudioDialog';

const restartButton = () =>
  screen.getByRole('button', { name: en['restart.action'] });

describe('RestartAudioDialog', () => {
  it('asks in the app, with the loud style on the restart', () => {
    render(
      <RestartAudioDialog
        phase="ask"
        onRestart={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(en['notice.restartConfirm'])).toBeInTheDocument();
    expect(restartButton()).toHaveClass('button', 'small');
    expect(restartButton()).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: en['config.cancel'] }),
    ).toHaveClass('button', 'small', 'subtle');
    expect(restartButton()).toHaveFocus();
  });

  // A vendor service that hangs on its way up used to leave the card on
  // "Restarting audio…" with every way out disabled. Closing now sends the
  // restart to the background instead.
  it('can be closed while Windows is still restarting', () => {
    const onClose = jest.fn();
    const onRestart = jest.fn();
    render(
      <RestartAudioDialog
        phase="running"
        onRestart={onRestart}
        onClose={onClose}
      />,
    );

    expect(restartButton()).toHaveClass('is-running');
    expect(screen.getByText(en['restart.running'])).toBeInTheDocument();
    const close = screen.getByRole('button', { name: en['restart.close'] });
    expect(close).toBeEnabled();
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('says in the language on screen that permission was declined', () => {
    render(
      <RestartAudioDialog
        phase="failed"
        outcome={{ ok: false, declined: true }}
        onRestart={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText(en['restart.declined'])).toBeInTheDocument();
    expect(screen.queryByText(en['restart.failed'])).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: en['restart.tryAgain'] }),
    ).toHaveFocus();
  });

  it('shows the helper’s reason under a failure', () => {
    render(
      <RestartAudioDialog
        phase="failed"
        outcome={{
          ok: false,
          declined: false,
          detail: 'Audiosrv started and then stopped again',
        }}
        onRestart={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText(en['restart.failed'])).toBeInTheDocument();
    expect(
      screen.getByText('Audiosrv started and then stopped again'),
    ).toBeInTheDocument();
  });

  it('closes with its OK once the restart is done', () => {
    const onClose = jest.fn();
    render(
      <RestartAudioDialog
        phase="done"
        outcome={{ ok: true, declined: false }}
        onRestart={jest.fn()}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(en['notice.restartDone'])).toBeInTheDocument();
    const ok = screen.getByRole('button', { name: en['whatsNew.ok'] });
    expect(ok).toHaveFocus();
    fireEvent.click(ok);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The troubleshooter underneath listens on the document, subscribed
  // before the card was, and heard every Escape first.
  it('keeps its Escape from the listeners behind it', () => {
    const behind = jest.fn();
    document.addEventListener('keydown', behind);
    try {
      const { unmount } = render(
        <RestartAudioDialog
          phase="ask"
          onRestart={jest.fn()}
          onClose={jest.fn()}
        />,
      );
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(behind).not.toHaveBeenCalled();
      unmount();

      // Positive control: with the card gone, the same key reaches them.
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(behind).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', behind);
    }
  });
});
