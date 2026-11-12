/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { TSceneReviewNotice } from '../../../common/sceneReviewNotice';
import SceneReviewNotice from '../../../renderer/components/SceneReviewNotice';

// A refusal the admin blocked with (premium 0105) says the block where it
// would have said "fix it and send it again"; the control is the same
// refusal with no block, which still says that.

const mockReview: { notice?: TSceneReviewNotice } = {};

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join('|')}` : key,
  }),
}));
jest.mock('../../../renderer/plus/sceneReviewStore', () => ({
  useSceneReview: () => ({ notice: mockReview.notice }),
  markSceneReviewSeen: () => Promise.resolve(),
}));
jest.mock('../../../renderer/utils/noticeTurn', () => ({
  useNoticeTurn: (_claim: string, wants: boolean) => wants,
}));

const refused = (
  more: Partial<Extract<TSceneReviewNotice, { kind: 'rejected' }>>,
) => {
  mockReview.notice = {
    kind: 'rejected',
    sceneId: 'reef',
    version: 2,
    names: { en: 'Reef' },
    swatch: ['#112233', '#445566'],
    reason: 'rights',
    keys: ['answer:reef@2:rejected:x'],
    ...more,
  };
};

describe('a refusal with a block', () => {
  it('says the scene is kept from review for its days', () => {
    refused({ block: { days: 30, scope: 'scene' } });
    render(<SceneReviewNotice />);
    expect(screen.getByText('review.notice.blockScene:30')).toBeInTheDocument();
    expect(screen.queryByText('review.next')).toBeNull();
  });

  it('says every scene is kept from review when the block is on the account', () => {
    refused({ block: { days: 90, scope: 'account' } });
    render(<SceneReviewNotice />);
    expect(
      screen.getByText('review.notice.blockAccount:90'),
    ).toBeInTheDocument();
  });

  it('control: with no block, it says to fix it and send it again', () => {
    refused({});
    render(<SceneReviewNotice />);
    expect(screen.getByText('review.next')).toBeInTheDocument();
    expect(screen.queryByText(/review\.notice\.block/)).toBeNull();
  });
});
