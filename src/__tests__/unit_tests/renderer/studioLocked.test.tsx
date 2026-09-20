/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio for somebody who may not use it: what it is, the free trial,
 * and the way to Plus — instead of a bench where every press is refused.
 *
 * What is held here is which of the two the tab shows, and that the loud
 * button is whichever one is the thing to press: the trial while there is
 * one to start, Plus when there is not.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IPlusTrialOffer } from '../../../common/plusTrial';
import { requestAccountPanel } from '../../../renderer/account/accountPanel';
import StudioPanel from '../../../renderer/studio/StudioPanel';
import {
  resetStudioStore,
  type IStudioView,
} from '../../../renderer/studio/studioStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

jest.mock('../../../renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
}));

// A build with a price to show, which is every shipped one; a build without
// offers nothing to buy and shows no button at all.
jest.mock('../../../common/accountConfig', () => ({
  ...jest.requireActual('../../../common/accountConfig'),
  isCheckoutConfigured: () => true,
}));

// The bench is the other half of this decision, and it brings the whole
// editor with it. What matters here is which one is on the page.
jest.mock('../../../renderer/studio/StudioBench', () => ({
  __esModule: true,
  default: () => <div data-testid="studio-bench" />,
}));

const offer = (state: IPlusTrialOffer['state']): IPlusTrialOffer => ({
  enabled: true,
  days: 15,
  state,
  termsVersion: 8,
  trialTermsVersion: 1,
});

let trial: IPlusTrialOffer | undefined;
jest.mock('../../../renderer/plus/trialStore', () => ({
  usePlusTrial: () => ({ offer: trial, owner: 'me', loading: false }),
}));

const view = (over: Partial<IStudioView['state']>): IStudioView => ({
  loaded: true,
  serial: 0,
  state: {
    entitled: false,
    maker: false,
    mayAddProject: false,
    projectsRoot: 'D:\\Studio',
    projects: [],
    ...over,
  },
});

let shown: IStudioView = view({});
jest.mock('../../../renderer/studio/studioStore', () => ({
  ...jest.requireActual('../../../renderer/studio/studioStore'),
  useStudio: () => shown,
  openStudioSession: () => () => undefined,
}));

beforeEach(() => {
  resetStudioStore();
  trial = offer('eligible');
  shown = view({});
  (requestAccountPanel as jest.Mock).mockReset();
});

test('a member with neither Plus nor a scene approved is met by what the Studio is', () => {
  render(<StudioPanel />);

  expect(screen.queryByTestId('studio-bench')).not.toBeInTheDocument();
  expect(screen.getByText('studio.locked.title')).toBeInTheDocument();
  // Every step of it, in the order somebody would do them.
  expect(screen.getByText('studio.locked.write')).toBeInTheDocument();
  expect(screen.getByText('studio.locked.test')).toBeInTheDocument();
  expect(screen.getByText('studio.locked.publish')).toBeInTheDocument();
  // And what makes it free again, which is the whole rule.
  expect(screen.getByText('studio.locked.earn')).toBeInTheDocument();
});

test.each([
  ['with Plus', { entitled: true, maker: false }],
  ['a maker whose month has run out', { entitled: false, maker: true }],
])('%s gets the bench, not the offer', (_label, state) => {
  shown = view(state);
  render(<StudioPanel />);

  expect(screen.getByTestId('studio-bench')).toBeInTheDocument();
  expect(screen.queryByText('studio.locked.title')).not.toBeInTheDocument();
});

test('the loud button is the trial while there is one, and Plus when there is not', async () => {
  const { unmount } = render(<StudioPanel />);
  const plus = screen.getByRole('button', { name: 'plus.gate.cta' });
  // Quiet: the trial card beside it carries the press to make.
  expect(plus.className).toContain('subtle');
  unmount();

  trial = offer('ineligible');
  render(<StudioPanel />);
  const alone = screen.getByRole('button', { name: 'plus.gate.cta' });
  expect(alone.className).not.toContain('subtle');

  await userEvent.click(alone);
  await waitFor(() =>
    expect(requestAccountPanel).toHaveBeenCalledWith('subscribe'),
  );
});
