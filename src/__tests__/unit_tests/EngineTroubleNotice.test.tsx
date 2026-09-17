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

const problems = (
  codes: string[],
  canRestartHelp = true,
  canApoHelp = true,
): TEngineTrouble => ({
  kind: 'problems',
  device: speakers,
  problems: codes,
  canRestartHelp,
  canApoHelp,
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
  it('explains a refused linear filter without claiming the original EQ stopped', () => {
    renderNotice({ trouble: problems(['eq-phase'], false) });
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      en['engineHealth.problem.eq-phase'],
    );
    expect(
      screen.queryByRole('button', { name: en['app.menu.restartAudio'] }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: en['output.gotIt'] }),
    ).toBeVisible();
  });
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

    // The card asks; nothing ran on its own while it was shown. The restart
    // is an elevated run of the setup helper, and it used to happen without
    // a press the moment sound was heard — a Windows prompt on every change
    // of output to one Windows had built before the engine was on it.
    expect(onRestartAudio).not.toHaveBeenCalled();
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

  it('does not offer Equalizer APO for a DSP failure it has no answer to', () => {
    // The rack could not start: a restart may bring it back, and Equalizer
    // APO — which has no rack — is not an alternative to it.
    renderNotice({ trouble: problems(['dsp-rack'], true, false) });
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([en['app.menu.restartAudio'], en['output.notNow']]);
  });

  it('leaves only an acknowledgement for a DSP failure nothing here mends', () => {
    renderNotice({ trouble: problems(['eq-phase'], false, false) });
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([en['output.gotIt']]);
  });

  it('stays put away for this trouble, even after it goes and returns', () => {
    const { rerender } = renderNotice({ trouble: off });

    fireEvent.click(screen.getByRole('button', { name: en['output.notNow'] }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    rerender({ trouble: off });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // The live capture stops with the DSP page and starts with it, so this
    // pair happens on every visit to that page while music plays. A user
    // reported exactly that as the card coming back every single time.
    rerender({ trouble: undefined });
    rerender({ trouble: off });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('offers Equalizer APO, not a restart, when Windows never started the engine', () => {
    // A user's machine: installed, attached, and never once created by
    // Windows. The old card led with "Restart Windows audio" under a line
    // saying a restart usually brings it back — neither was true there.
    renderNotice({ trouble: { ...off, neverRan: true } });

    expect(
      screen.getByText(en['engineHealth.neverRanTitle']),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en['app.menu.restartAudio'] }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([en['engineHealth.useApo'], en['output.notNow']]);
  });

  it('still speaks up for a different trouble on the same output', () => {
    const { rerender } = renderNotice({ trouble: off });
    fireEvent.click(screen.getByRole('button', { name: en['output.notNow'] }));

    rerender({ trouble: problems(['convolution']) });
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
