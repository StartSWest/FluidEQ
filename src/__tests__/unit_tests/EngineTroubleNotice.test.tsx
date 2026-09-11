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
import useEngineTrouble from 'renderer/audio/useEngineTrouble';
import EngineTroubleNotice from 'renderer/components/EngineTroubleNotice';

jest.mock('renderer/audio/useEngineTrouble', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const trouble = useEngineTrouble as jest.MockedFunction<
  typeof useEngineTrouble
>;

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

const renderNotice = (isHidden = false) => {
  const onRestartAudio = jest.fn();
  const onUseApo = jest.fn();
  const view = render(
    <EngineTroubleNotice
      engine="fluid"
      fluid={undefined}
      isHidden={isHidden}
      onRestartAudio={onRestartAudio}
      onUseApo={onUseApo}
    />,
  );
  const rerender = (hidden = isHidden) =>
    view.rerender(
      <EngineTroubleNotice
        engine="fluid"
        fluid={undefined}
        isHidden={hidden}
        onRestartAudio={onRestartAudio}
        onUseApo={onUseApo}
      />,
    );
  return { onRestartAudio, onUseApo, rerender };
};

const title = (key: 'engineHealth.offTitle' | 'engineHealth.problemsTitle') =>
  en[key].replace('{device}', speakers.name);

describe('EngineTroubleNotice', () => {
  beforeEach(() => {
    trouble.mockReset();
  });

  it('shows nothing while the engine is fine', () => {
    trouble.mockReturnValue(undefined);
    renderNotice();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('says the engine is off, and offers the restart first', () => {
    trouble.mockReturnValue(off);
    const { onRestartAudio, onUseApo } = renderNotice();

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
    trouble.mockReturnValue(problems(['dsp-rack', 'reload-failed']));
    renderNotice();

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
    trouble.mockReturnValue(problems(['from-the-future', 'also-new']));
    renderNotice();
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([en['engineHealth.problem.other']]);
  });

  it('does not offer a restart that cannot mend a file', () => {
    trouble.mockReturnValue(problems(['convolution'], false));
    renderNotice();
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([en['output.gotIt'], en['engineHealth.useApo']]);
  });

  it('stays put away for this trouble, and comes back for the next one', () => {
    trouble.mockReturnValue(off);
    const { rerender } = renderNotice();

    fireEvent.click(screen.getByRole('button', { name: en['output.notNow'] }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    rerender();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // It ended, and then it happened again: that is worth saying again.
    trouble.mockReturnValue(undefined);
    rerender();
    trouble.mockReturnValue(off);
    rerender();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('is put away by Escape', () => {
    trouble.mockReturnValue(off);
    renderNotice();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('steps aside while a dialog is open, and comes back after it', () => {
    trouble.mockReturnValue(off);
    const { rerender } = renderNotice(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    rerender(false);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
