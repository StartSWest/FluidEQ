/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlusToastStack from '../../../renderer/plus/PlusToastStack';
import type { TPlusToastSources } from '../../../renderer/plus/toastStack';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

interface INotice {
  ok: boolean;
  key: string;
  file?: string;
}

const stack = (sources: TPlusToastSources<INotice>) => (
  <PlusToastStack<INotice>
    sources={sources}
    text={(notice) =>
      `said ${notice.key}${notice.file ? ` ${notice.file}` : ''}`
    }
  />
);

/** Every toast's parts, found by the classes the stylesheet animates. */
const partsOf = (text: string) => {
  const card = screen.getByText(text).closest('.plus-toast');
  const slot = card?.parentElement;
  if (!(card instanceof HTMLElement) || !(slot instanceof HTMLElement)) {
    throw new Error(`no toast shows "${text}"`);
  }
  return { slot, card, life: card.querySelector('.plus-toast__life') };
};

describe('the Plus toast stack', () => {
  it('shows each notice through the text it is given', () => {
    render(
      stack({
        export: { ok: true, key: 'studio.notice.exported', file: 'a.json' },
      }),
    );
    expect(
      screen.getByText('said studio.notice.exported a.json'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('studio.notice.exported'),
    ).not.toBeInTheDocument();
  });

  it('drains a line under a success and never raises it as an alert', () => {
    render(stack({ publish: { ok: true, key: 'published' } }));
    const { card, life } = partsOf('said published');
    expect(card).not.toHaveAttribute('role');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(life).toBeInTheDocument();
  });

  // A problem stays until it is closed: it has no line to run out.
  it('raises a problem as an alert, with no line to run out', () => {
    render(stack({ publish: { ok: false, key: 'failed' } }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('said failed');
    expect(partsOf('said failed').life).toBeNull();
  });

  it('sends a closed toast out, and removes it once its place has closed', async () => {
    render(stack({ publish: { ok: false, key: 'failed' } }));
    const { slot } = partsOf('said failed');
    expect(slot).not.toHaveClass('is-leaving');

    await userEvent.click(screen.getByRole('button', { name: 'app.dismiss' }));
    // Still drawn while it leaves: removing it here would cut the exit off.
    expect(slot).toHaveClass('plus-toast-slot', 'is-leaving');
    expect(screen.getByText('said failed')).toBeInTheDocument();

    fireEvent.animationEnd(slot);
    expect(screen.queryByText('said failed')).not.toBeInTheDocument();
  });

  // The card's own exit and the mark's stroke end inside the place and bubble
  // up to it; taking either for the place closing would remove the toast
  // before its gap had closed, and the cards under it would jump.
  it('keeps a leaving toast while animations inside its place end', async () => {
    render(stack({ publish: { ok: false, key: 'failed' } }));
    const { slot, card } = partsOf('said failed');
    await userEvent.click(screen.getByRole('button', { name: 'app.dismiss' }));

    fireEvent.animationEnd(card);
    const mark = card.querySelector('.plus-toast__mark');
    if (!mark) {
      throw new Error('the toast has no mark');
    }
    fireEvent.animationEnd(mark);
    expect(screen.getByText('said failed')).toBeInTheDocument();
    expect(slot).toHaveClass('is-leaving');

    // The control: the place's own end does remove it.
    fireEvent.animationEnd(slot);
    expect(screen.queryByText('said failed')).not.toBeInTheDocument();
  });

  it('never removes a toast that was not sent out', () => {
    render(stack({ publish: { ok: false, key: 'failed' } }));
    const { slot } = partsOf('said failed');
    fireEvent.animationEnd(slot);
    expect(screen.getByText('said failed')).toBeInTheDocument();
    expect(slot).not.toHaveClass('is-leaving');
  });

  it('sends a success out when its line has run out', () => {
    render(stack({ publish: { ok: true, key: 'published' } }));
    const { slot, card, life } = partsOf('said published');
    if (!life) {
      throw new Error('the success has no life line');
    }
    // The card arriving is not the line running out.
    fireEvent.animationEnd(card);
    expect(slot).not.toHaveClass('is-leaving');

    fireEvent.animationEnd(life);
    expect(slot).toHaveClass('is-leaving');
    fireEvent.animationEnd(slot);
    expect(screen.queryByText('said published')).not.toBeInTheDocument();
  });

  it('puts an action speaking again on top and sends its old toast out', () => {
    const { rerender } = render(
      stack({ publish: { ok: false, key: 'failed' } }),
    );
    rerender(stack({ publish: { ok: true, key: 'published' } }));
    const slots = screen
      .getAllByText(/^said /)
      .map((text) => text.closest('.plus-toast-slot'));
    expect(slots.map((slot) => slot?.textContent)).toEqual([
      'said published',
      'said failed',
    ]);
    expect(slots.map((slot) => slot?.classList.contains('is-leaving'))).toEqual(
      [false, true],
    );
  });
});
