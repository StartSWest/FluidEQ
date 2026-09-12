/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PLUS_TERMS_VERSION,
  PLUS_TERMS_EDITION,
} from '../../../common/plusTerms';
import type { TPlusTermsNoticeState } from '../../../main/ipc/plusTermsNotice';
import { subscribeAccountPanelRequests } from '../../../renderer/account/accountPanel';
import { resetPlusTermsNoticeStore } from '../../../renderer/account/plusTermsNoticeStore';
import PlusTermsNotice from '../../../renderer/components/PlusTermsNotice';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const CURRENT = PLUS_TERMS_VERSION;

let pushNotice: (notice: TPlusTermsNoticeState) => void = () => undefined;

const bridge = {
  getPlusTermsNotice: jest.fn(),
  plusTermsNoticeSeen: jest.fn(),
  onPlusTermsNotice: jest.fn(
    (listener: (notice: TPlusTermsNoticeState) => void) => {
      pushNotice = listener;
      return () => undefined;
    },
  ),
};

/** Mounted, with the main process's first answer already in. */
const showing = async (notice: TPlusTermsNoticeState) => {
  bridge.getPlusTermsNotice.mockResolvedValue(notice);
  await act(async () => {
    render(<PlusTermsNotice />);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  resetPlusTermsNoticeStore();
  bridge.plusTermsNoticeSeen.mockResolvedValue(null);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('the Plus terms notice', () => {
  it('says what the one missed version changed, with its version and date', async () => {
    await showing({ version: CURRENT, changes: [CURRENT] });
    const notice = await screen.findByRole('dialog', {
      name: 'termsNotice.title',
    });
    expect(notice).toHaveTextContent(`termsNotice.change.${CURRENT}`);
    expect(
      screen.getByText(new RegExp(`^terms\\.meta:${PLUS_TERMS_EDITION},`)),
    ).toBeInTheDocument();
    // The recommendation is the loud button, the decline the quiet one.
    expect(
      screen.getByRole('button', { name: 'termsNotice.read' }),
    ).toHaveClass('button', 'small');
    expect(
      screen.getByRole('button', { name: 'termsNotice.read' }),
    ).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: 'termsNotice.gotIt' }),
    ).toHaveClass('button', 'small', 'subtle');
  });

  it('does not present pre-release revisions as published editions', async () => {
    await showing({ version: CURRENT, changes: [CURRENT, 4, 3, 2] });
    const notice = await screen.findByRole('dialog');
    expect(notice).toHaveTextContent('termsNotice.change.5');
    expect(notice).not.toHaveTextContent('termsNotice.change.4');
    expect(notice).not.toHaveTextContent('termsNotice.version:5');
    expect(screen.getByText(/^terms\.meta:1,/)).toBeInTheDocument();
  });

  it('draws nothing when there is nothing to tell', async () => {
    await showing(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('appears when the main process learns a member is owed it', async () => {
    await showing(null);
    act(() => pushNotice({ version: CURRENT, changes: [CURRENT] }));
    expect(
      await screen.findByRole('dialog', { name: 'termsNotice.title' }),
    ).toBeInTheDocument();
  });

  it('never shows a notice about a version this window does not carry', async () => {
    await showing({ version: CURRENT + 1, changes: [CURRENT + 1] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('goes away at once on Got it, and says which version was seen', async () => {
    await showing({ version: CURRENT, changes: [CURRENT] });
    await userEvent.click(
      await screen.findByRole('button', { name: 'termsNotice.gotIt' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bridge.plusTermsNoticeSeen).toHaveBeenCalledWith(CURRENT);
  });

  it('opens the terms in the Account panel, and counts that as seen', async () => {
    const pages: string[] = [];
    const stop = subscribeAccountPanelRequests((page) => pages.push(page));
    await showing({ version: CURRENT, changes: [CURRENT] });
    await userEvent.click(
      await screen.findByRole('button', { name: 'termsNotice.read' }),
    );
    expect(pages).toEqual(['terms']);
    expect(bridge.plusTermsNoticeSeen).toHaveBeenCalledWith(CURRENT);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    stop();
  });
});
