/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IAudioDevice } from 'common/constants';
import en from 'common/i18n/en';
import type { TEngineTrouble } from 'renderer/audio/engineTrouble';
import EngineTroubleNotice from 'renderer/components/EngineTroubleNotice';
import { claimNotice } from 'renderer/utils/noticeTurn';

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

interface IWhatHelps {
  canRestartHelp?: boolean;
  canApoHelp?: boolean;
  canInstallHelp?: boolean;
  updateReady?: boolean;
}

const problems = (
  codes: string[],
  {
    canRestartHelp = true,
    canApoHelp = true,
    canInstallHelp = false,
    updateReady = false,
  }: IWhatHelps = {},
): TEngineTrouble => ({
  kind: 'problems',
  device: speakers,
  problems: codes,
  canRestartHelp,
  canApoHelp,
  canInstallHelp,
  updateReady,
  key: `problems:{AAAA}:${codes.join(',')}`,
});

interface IShown {
  trouble: TEngineTrouble | undefined;
  isHidden?: boolean;
}

const renderNotice = ({ trouble, isHidden = false }: IShown) => {
  const onRestartAudio = jest.fn();
  const onUseApo = jest.fn();
  const onTryAnotherSlot = jest.fn();
  const onInstallEngine = jest.fn();
  const notice = (shown: IShown) => (
    <EngineTroubleNotice
      trouble={shown.trouble}
      isHidden={shown.isHidden ?? false}
      onRestartAudio={onRestartAudio}
      onUseApo={onUseApo}
      onTryAnotherSlot={onTryAnotherSlot}
      onInstallEngine={onInstallEngine}
    />
  );
  const view = render(notice({ trouble, isHidden }));
  const rerender = (shown: IShown) => view.rerender(notice(shown));
  return {
    onRestartAudio,
    onUseApo,
    onTryAnotherSlot,
    onInstallEngine,
    rerender,
  };
};

const title = (
  key:
    | 'engineHealth.offTitle'
    | 'engineHealth.problemsTitle'
    | 'engineHealth.bypassedTitle',
) => en[key].replace('{device}', speakers.name);

describe('EngineTroubleNotice', () => {
  it('explains a refused linear filter without claiming the original EQ stopped', () => {
    renderNotice({
      trouble: problems(['eq-phase'], { canRestartHelp: false }),
    });
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
    renderNotice({
      trouble: problems(['convolution'], { canRestartHelp: false }),
    });
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([en['output.gotIt'], en['engineHealth.useApo']]);
  });

  it('leads with a fresh engine, not a restart, when the rack would not start', () => {
    // A user installed FluidEQ on a second PC: the EQ played, every DSP
    // effect was off, and this card offered "Restart Windows audio" — which
    // starts the same engine again and failed the same way, every time. What
    // mended it was putting this app's own engine in place, which he found
    // by hand on the help page. So that leads here now, and it says why.
    // Equalizer APO has no rack at all, so it is not offered either.
    const { onInstallEngine, onRestartAudio } = renderNotice({
      trouble: problems(['dsp-rack'], {
        canApoHelp: false,
        canInstallHelp: true,
      }),
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      en['engineUpdate.action'],
      en['app.menu.restartAudio'],
      en['output.notNow'],
    ]);
    // The recommendation wears the loud style; the restart is demoted, not
    // removed — it still mends whatever else on the card a restart mends.
    expect(buttons[0]).not.toHaveClass('subtle');
    expect(buttons[1]).toHaveClass('subtle');
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      en['engineHealth.rackNeedsEngine'],
    );
    // Nothing runs until it is pressed: this is an elevated run of the
    // setup helper, so it is one Windows prompt the user asked for.
    expect(onInstallEngine).not.toHaveBeenCalled();
    fireEvent.click(buttons[0]);
    expect(onInstallEngine).toHaveBeenCalledTimes(1);
    expect(onRestartAudio).not.toHaveBeenCalled();
  });

  it('says outright when the installed engine is not the one this app carries', () => {
    // The extra sentence is only shown where it is known to be true — the
    // comparison of the two engines by content, which main already makes for
    // the update notice. Without it the card offers the button and no claim.
    const { rerender } = renderNotice({
      trouble: problems(['dsp-rack'], {
        canApoHelp: false,
        canInstallHelp: true,
      }),
    });
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(
      en['engineHealth.engineIsOld'],
    );

    rerender({
      trouble: problems(['dsp-rack'], {
        canApoHelp: false,
        canInstallHelp: true,
        updateReady: true,
      }),
    });
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      en['engineHealth.engineIsOld'],
    );
  });

  it('leaves only an acknowledgement for a DSP failure nothing here mends', () => {
    renderNotice({
      trouble: problems(['eq-phase'], {
        canRestartHelp: false,
        canApoHelp: false,
      }),
    });
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

  it('offers another slot when Windows is playing the output past the engine', () => {
    // Ivan's laptop speaker: the engine installed, attached, locked, saying
    // it was processing — and the music going through a chain it is not in,
    // so every reading said healthy while the EQ did nothing. A restart
    // rebuilds the very same chains, so it is not offered.
    const { onTryAnotherSlot } = renderNotice({
      trouble: { ...off, bypassed: true },
    });

    expect(
      screen.getByText(title('engineHealth.bypassedTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(en['engineHealth.bypassedBody']),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en['app.menu.restartAudio'] }),
    ).not.toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      en['engineHealth.tryAnotherSlot'],
      en['engineHealth.useApo'],
      en['output.notNow'],
    ]);
    // The move is the recommendation, and nothing runs until it is pressed.
    expect(buttons[0]).not.toHaveClass('subtle');
    expect(onTryAnotherSlot).not.toHaveBeenCalled();
    fireEvent.click(buttons[0]);
    expect(onTryAnotherSlot).toHaveBeenCalledWith(off.device.guid);
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

  it('waits behind the output notice, and keeps out of its Escape', () => {
    const release = claimNotice('output');
    renderNotice({ trouble: off });
    try {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
    } finally {
      act(release);
    }
    // Still there once the spot is its own: the Escape was not its.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it("waits behind the Room's 7.1 offer too", () => {
    const release = claimNotice('room');
    renderNotice({ trouble: off });
    try {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    } finally {
      act(release);
    }
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
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
    const release = claimNotice('engineUpdate');
    renderNotice({ trouble: off });
    try {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    } finally {
      act(release);
    }
  });

  it('steps aside while a dialog is open, and comes back after it', () => {
    const { rerender } = renderNotice({ trouble: off, isHidden: true });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    rerender({ trouble: off, isHidden: false });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
