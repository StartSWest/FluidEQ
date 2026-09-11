/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IAudioDevice } from 'common/constants';
import en from 'common/i18n/en';
import type { TEngineTrouble } from 'renderer/audio/engineTrouble';
import EngineTroubleNotice from 'renderer/components/EngineTroubleNotice';

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'USB Speakers',
  guid: '{AAAA}',
  isDefault: true,
  isActive: true,
  isFluidEngineAttached: true,
};

const off: TEngineTrouble = {
  kind: 'off',
  device: speakers,
  key: 'off:{AAAA}',
};

const problems = (codes: string[], canRestartHelp = true): TEngineTrouble => ({
  kind: 'problems',
  device: speakers,
  problems: codes,
  canRestartHelp,
  key: `problems:{AAAA}:${codes.join(',')}`,
});

interface IShown {
  trouble: TEngineTrouble | undefined;
  isHidden?: boolean;
}

const renderNotice = ({ trouble, isHidden = false }: IShown) => {
  const onRestartAudio = jest.fn();
  const onUseApo = jest.fn();
  const notice = (shown: IShown) => (
    <EngineTroubleNotice
      trouble={shown.trouble}
      isHidden={shown.isHidden ?? false}
      onRestartAudio={onRestartAudio}
      onUseApo={onUseApo}
    />
  );
  const view = render(notice({ trouble, isHidden }));
  const rerender = (shown: IShown) => view.rerender(notice(shown));
  return { onRestartAudio, onUseApo, rerender };
};

const title = (key: 'engineHealth.offTitle' | 'engineHealth.problemsTitle') =>
  en[key].replace('{device}', speakers.name);

describe('EngineTroubleNotice', () => {
  it('shows nothing while the engine is fine', () => {
    renderNotice({ trouble: undefined });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('says the engine is off, and offers the restart first', () => {
    const { onRestartAudio, onUseApo } = renderNotice({ trouble: off });

    const notice = screen.getByRole('alertdialog');
    expect(notice).toHaveTextContent(title('engineHealth.offTitle'));
    expect(notice).toHaveTextContent(en['engineHealth.offBody']);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      en['app.menu.restartAudio'],
      en['engineHealth.useApo'],
      en['output.notNow'],
    ]);
    // The recommendation wears the loud style, the rest the quiet one.
    expect(buttons[0]).toHaveClass('small');
    expect(buttons[0]).not.toHaveClass('subtle');
    expect(buttons[1]).toHaveClass('subtle');
    expect(buttons[2]).toHaveClass('subtle');

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onRestartAudio).toHaveBeenCalledTimes(1);
    expect(onUseApo).toHaveBeenCalledTimes(1);
  });

  it('lists what is missing, one line per thing', () => {
    renderNotice({ trouble: problems(['dsp-rack', 'reload-failed']) });

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      title('engineHealth.problemsTitle'),
    );
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([
      en['engineHealth.problem.dsp-rack'],
      en['engineHealth.problem.reload-failed'],
    ]);
    expect(screen.getByText(en['engineHealth.partlyOff'])).toBeInTheDocument();
  });

  it('gives codes it does not know one line between them', () => {
    renderNotice({ trouble: problems(['from-the-future', 'also-new']) });
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([en['engineHealth.problem.other']]);
  });

  it('does not offer a restart that cannot mend a file', () => {
    renderNotice({ trouble: problems(['convolution'], false) });
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([en['output.gotIt'], en['engineHealth.useApo']]);
  });

  it('stays put away for this trouble, and comes back for the next one', () => {
    const { rerender } = renderNotice({ trouble: off });

    fireEvent.click(screen.getByRole('button', { name: en['output.notNow'] }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    rerender({ trouble: off });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // It ended, and then it happened again: that is worth saying again.
    rerender({ trouble: undefined });
    rerender({ trouble: off });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('is put away by Escape', () => {
    renderNotice({ trouble: off });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps an unseen notice when Escape belongs to the output notice', () => {
    const inFront = document.createElement('aside');
    inFront.className = 'device-apo-notice';
    document.body.appendChild(inFront);
    renderNotice({ trouble: off });
    try {
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    } finally {
      inFront.remove();
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('leaves the notice alone when a later dialog handles Escape', () => {
    renderNotice({ trouble: off });
    const dialogAnswers = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', dialogAnswers);
    try {
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    } finally {
      document.removeEventListener('keydown', dialogAnswers);
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('still answers Escape when only the lower-priority update notice is present', () => {
    const update = document.createElement('aside');
    update.className = 'device-apo-notice engine-update-notice';
    document.body.appendChild(update);
    renderNotice({ trouble: off });
    try {
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    } finally {
      update.remove();
    }
  });

  it('steps aside while a dialog is open, and comes back after it', () => {
    const { rerender } = renderNotice({ trouble: off, isHidden: true });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    rerender({ trouble: off, isHidden: false });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
