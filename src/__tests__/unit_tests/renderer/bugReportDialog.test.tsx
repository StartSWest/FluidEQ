/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The report dialog's email. It used to be sent through `window.open`, whose
 * handler in main opens only the web, and the dialog announced an email before
 * anything had been tried — so every press said an email opened and none ever
 * did. What is held here is the order of it: the report on the clipboard first,
 * the link through its own route, and the email said to be open only once main
 * answers that the mail app has it.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { IGatheredFacts, isSupportMailto } from 'common/bugReport';
import BugReportDialog from '../../../renderer/components/BugReportDialog';
import {
  gatherBugReport,
  markBugReportDelivered,
  openSupportEmail,
} from '../../../renderer/utils/equalizerApi';

const SUPPORT = 'support@fluideq.example';

// The address is read when the module loads, and the email button exists only
// in a build that has one.
jest.mock('common/bugReport', () => {
  process.env.FLUIDEQ_SUPPORT_EMAIL = 'support@fluideq.example';
  return jest.requireActual('common/bugReport');
});

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../renderer/utils/equalizerApi', () => ({
  gatherBugReport: jest.fn(),
  markBugReportDelivered: jest.fn(),
  openSupportEmail: jest.fn(),
}));

const gather = jest.mocked(gatherBugReport);
const handOver = jest.mocked(openSupportEmail);

const FACTS: IGatheredFacts = {
  appVersion: '1.2.3',
  platform: 'win32 10.0.26200',
  arch: 'x64',
  electron: '40.0.0',
  audioEngine: 'fluid',
  isEqualizerApoInstalled: false,
  fluidEngineInstalled: true,
  appLog: 'Engine started',
  installLog: '',
  engineReport: '',
  engineLog: '',
  helperLog: '',
  gatheredAt: '2026-09-15T12:00:00.000Z',
};

let writeText: jest.Mock<Promise<void>, [string]>;

beforeEach(() => {
  gather.mockResolvedValue(FACTS);
  handOver.mockResolvedValue(true);
  writeText = jest.fn<Promise<void>, [string]>(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  gather.mockReset();
  handOver.mockReset();
  jest.mocked(markBugReportDelivered).mockReset();
});

const openDialog = async () => {
  await act(async () => {
    render(<BugReportDialog onClose={jest.fn()} />);
  });
};

const emailButton = () =>
  screen.getByRole('button', { name: 'bugReport.email' });

const pressEmail = async () => {
  await act(async () => {
    fireEvent.click(emailButton());
  });
};

/** The notice's own line, which is what takes a notice that went well away. */
const lifeLine = () =>
  screen.getByRole('status').querySelector('.bug-report__notice-life');

describe('where the next report begins', () => {
  // Every route delivers by way of the clipboard, so the clipboard write is
  // the moment the report has left — and the mark it sends is the gather
  // time this report carried, never "now": lines written while the dialog
  // was open belong to the next report.
  it('marks the gather moment delivered on copy', async () => {
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bugReport.copy' }));
    });
    expect(jest.mocked(markBugReportDelivered)).toHaveBeenCalledWith(
      FACTS.gatheredAt,
    );
  });

  it('marks it on email too, even when no mail app opened', async () => {
    handOver.mockResolvedValue(false);
    await openDialog();
    await pressEmail();
    // The clipboard still has it, which is delivery.
    expect(jest.mocked(markBugReportDelivered)).toHaveBeenCalledWith(
      FACTS.gatheredAt,
    );
  });

  it('marks nothing while the facts are still being gathered', async () => {
    // Never resolves: the dialog is stuck on its placeholder facts.
    gather.mockReturnValue(
      new Promise(() => {
        // Left pending on purpose.
      }),
    );
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bugReport.copy' }));
    });
    expect(jest.mocked(markBugReportDelivered)).not.toHaveBeenCalled();
  });
});

describe('emailing a report', () => {
  it('copies it first, and says the email opened only once the mail app has it', async () => {
    const windowOpen = jest.spyOn(window, 'open').mockReturnValue(null);
    let answer: (opened: boolean) => void = () => undefined;
    handOver.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    await openDialog();
    await pressEmail();

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Engine started'),
    );
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(
      handOver.mock.invocationCallOrder[0],
    );
    // What went to main is the report to this build's address — the same
    // check main makes before the operating system sees it.
    const [url] = handOver.mock.calls[0];
    expect(isSupportMailto(url, SUPPORT)).toBe(true);
    // Never the window's link handler, which drops a `mailto:` without a word.
    expect(windowOpen).not.toHaveBeenCalled();

    // Asked, not yet answered: nothing claims an email is open.
    expect(screen.getByRole('status')).toHaveTextContent(
      /^bugReport\.emailOpening$/,
    );
    expect(emailButton()).toBeDisabled();

    await act(async () => answer(true));
    expect(screen.getByRole('status')).toHaveTextContent(
      /^bugReport\.emailOpened$/,
    );
    expect(emailButton()).toBeEnabled();
  });

  it('says no mail app opened, and gives the address to write to instead', async () => {
    handOver.mockResolvedValue(false);
    await openDialog();
    await pressEmail();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(`bugReport.emailNotOpened ${SUPPORT}`);
    expect(screen.getByText(SUPPORT)).toHaveClass('is-selectable');
    // It stays: it has no line to run out.
    expect(lifeLine()).toBeNull();
  });

  it('counts a bridge that would not send the link as nothing opened', async () => {
    handOver.mockImplementation(() => {
      throw new Error('bridge unavailable');
    });
    await openDialog();
    await pressEmail();
    expect(screen.getByRole('status')).toHaveTextContent(
      'bugReport.emailNotOpened',
    );

    handOver.mockRejectedValue(new Error('window going away'));
    await pressEmail();
    expect(screen.getByRole('status')).toHaveTextContent(
      'bugReport.emailNotOpened',
    );
    expect(emailButton()).toBeEnabled();
  });

  it('tells a report too long for an email to be pasted in whole', async () => {
    gather.mockResolvedValue({ ...FACTS, appLog: 'x'.repeat(4000) });
    await openDialog();
    await pressEmail();
    expect(screen.getByRole('status')).toHaveTextContent(
      /^bugReport\.emailOpenedPartial$/,
    );
  });
});

describe('what the dialog says back', () => {
  it('lets a notice that went well leave when its line has run out', async () => {
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bugReport.copy' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('bugReport.copied');

    const line = lifeLine();
    if (!line) {
      throw new Error('the notice has no line');
    }
    fireEvent.animationEnd(line);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('keeps the live region mounted, so each notice is announced', async () => {
    await openDialog();
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bugReport.copy' }));
    });
    expect(screen.getByRole('status')).toBe(region);
  });
});
