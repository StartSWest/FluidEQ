/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene reported from the looks says so on its button — for the account
 * that reported it. Another account signing in on the same computer has
 * reported nothing, and its Report must not read as already sent.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IAccountState } from '../../../main/account/session';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import {
  closeSceneReport,
  requestSceneReport,
  resetSceneReportRequest,
  useSceneReport,
} from '../../../renderer/plus/sceneReportRequest';

const MEI = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const LOOK = `member:${MEI}:neon-city`;
const FIRST = '10000000-0000-4000-8000-000000000001';
const SECOND = '20000000-0000-4000-8000-000000000002';

const signedIn = (id: string): IAccountState => ({
  status: 'signed-in',
  identity: { id },
});

let pushAccount: (state: IAccountState) => void = () => {};

function ReportButtonState() {
  const { reported } = useSceneReport();
  return <p>{reported.has(LOOK) ? 'sent' : 'not sent'}</p>;
}

beforeEach(() => {
  resetAccountStore();
  resetSceneReportRequest();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        getAccountState: jest.fn().mockResolvedValue(signedIn(FIRST)),
        onAccountState: (listener: (state: IAccountState) => void) => {
          pushAccount = listener;
          return () => {};
        },
      },
    },
  });
});

it('remembers a report for the account that sent it, and only that one', async () => {
  render(<ReportButtonState />);
  expect(await screen.findByText('not sent')).toBeInTheDocument();
  act(() => {
    requestSceneReport({
      lookId: LOOK,
      authorId: MEI,
      sceneId: 'neon-city',
      name: 'Neon City',
    });
    closeSceneReport(true);
  });
  expect(screen.getByText('sent')).toBeInTheDocument();

  act(() => pushAccount(signedIn(SECOND)));
  expect(screen.getByText('not sent')).toBeInTheDocument();

  act(() => pushAccount(signedIn(FIRST)));
  expect(screen.getByText('sent')).toBeInTheDocument();
});

it('remembers nothing for a report that never reached the server', async () => {
  render(<ReportButtonState />);
  await screen.findByText('not sent');
  act(() => {
    requestSceneReport({
      lookId: LOOK,
      authorId: MEI,
      sceneId: 'neon-city',
      name: 'Neon City',
    });
    closeSceneReport(false);
  });
  expect(screen.getByText('not sent')).toBeInTheDocument();
});
