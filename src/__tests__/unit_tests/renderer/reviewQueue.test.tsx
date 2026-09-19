/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The admin's scenes to approve: a list that is never shown stale, a scene
 * that is approved only once it has played on the admin's own screen, and an
 * answer whose reply lands on the page it was sent from and no other.
 */

import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IReviewItem } from '../../../common/plusReview';
import type { ISceneReviewState } from '../../../main/ipc/plusReview';
import {
  resetGalleryActions,
  useGalleryNotice,
} from '../../../renderer/plus/galleryActions';
import { resetModerationStore } from '../../../renderer/plus/moderationStore';
import {
  isReviewing,
  openAdminSection,
  openReviewItem,
  resetPlusNavigation,
} from '../../../renderer/plus/plusNavigation';
import ReviewQueue from '../../../renderer/plus/ReviewQueue';
import { resetSceneReviewStore } from '../../../renderer/plus/sceneReviewStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

// The runner owns WebGL. What the page needs of it is the two things it says:
// that a frame reached the screen, and that something went wrong.
jest.mock('../../../renderer/plus/ScenePreview', () => {
  // eslint-disable-next-line global-require -- the factory runs before imports
  const { createElement } = require('react');
  return {
    __esModule: true,
    default: ({
      onDrawn,
      onTrouble,
    }: {
      onDrawn: () => void;
      onTrouble: (trouble: string) => void;
    }) =>
      createElement(
        'div',
        null,
        createElement('button', { type: 'button', onClick: onDrawn }, 'drawn'),
        createElement(
          'button',
          { type: 'button', onClick: () => onTrouble('compile') },
          'fails',
        ),
      ),
  };
});

const MEI = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const ADMIN = '10000000-0000-4000-8000-000000000001';

const item = (over: Partial<IReviewItem> = {}): IReviewItem => ({
  authorId: MEI,
  lookId: `member:${MEI}:neon-city`,
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  sceneId: 'neon-city',
  version: 3,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  hasPhoto: true,
  sha256: 'a'.repeat(64),
  submittedAt: '2026-09-18T10:00:00.000Z',
  liveVersion: 2,
  takenDown: false,
  authorBanned: false,
  openReports: 0,
  ...over,
});

const other = item({
  lookId: `member:${MEI}:ember`,
  sceneId: 'ember',
  names: { en: 'Ember' },
  sha256: 'b'.repeat(64),
});

let pushState: (state: ISceneReviewState) => void = () => {};

const bridge = {
  listReviewQueue: jest.fn(),
  reviewScene: jest.fn(),
  reviewPicture: jest.fn(),
  answerReview: jest.fn(),
  getSceneReviewNotice: jest.fn(),
  onSceneReviewNotice: jest.fn(),
};

/** What the admin place's own line says: the answers' replies land there. */
function NoticeLine() {
  const notice = useGalleryNotice();
  return <p data-testid="notice">{notice?.key ?? ''}</p>;
}

const show = () =>
  render(
    <>
      <ReviewQueue me={ADMIN} />
      <NoticeLine />
    </>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  resetPlusNavigation();
  resetSceneReviewStore();
  resetGalleryActions();
  resetModerationStore();
  bridge.listReviewQueue.mockResolvedValue({ ok: true, items: [] });
  bridge.reviewScene.mockResolvedValue({
    ok: true,
    pack: { id: 'neon-city', version: 3 },
  });
  bridge.reviewPicture.mockResolvedValue(undefined);
  bridge.answerReview.mockResolvedValue({ ok: true });
  bridge.getSceneReviewNotice.mockResolvedValue({ notice: null });
  bridge.onSceneReviewNotice.mockImplementation(
    (listener: (state: ISceneReviewState) => void) => {
      pushState = listener;
      return () => {};
    },
  );
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('the list of scenes waiting', () => {
  it('is read afresh each time it is opened, the page already showing included', async () => {
    show();
    expect(await screen.findByText('review.empty.title')).toBeInTheDocument();
    bridge.listReviewQueue.mockResolvedValue({ ok: true, items: [item()] });
    // "Review now" on a notice, or the tab pressed again.
    act(() => openAdminSection('review'));
    expect(await screen.findByText('Neon City')).toBeInTheDocument();
    expect(bridge.listReviewQueue).toHaveBeenCalledTimes(2);
  });

  it('is read again once when a scene arrives while it is open', async () => {
    show();
    await screen.findByText('review.empty.title');
    bridge.listReviewQueue.mockResolvedValue({ ok: true, items: [item()] });
    act(() => pushState({ accountId: ADMIN, notice: null, waiting: 1 }));
    expect(await screen.findByText('Neon City')).toBeInTheDocument();
    // The same count again is not news.
    act(() => pushState({ accountId: ADMIN, notice: null, waiting: 1 }));
    expect(bridge.listReviewQueue).toHaveBeenCalledTimes(2);
  });
});

describe('a scene waiting, opened', () => {
  const approveButton = () =>
    screen.getByRole('button', { name: /review\.approve/ });

  it('is approved only once it has played here, with nothing wrong', async () => {
    act(() => openReviewItem(item()));
    show();
    await screen.findByRole('button', { name: 'drawn' });
    expect(approveButton()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'drawn' }));
    expect(approveButton()).toBeEnabled();
    // A scene that breaks is one to refuse, never to approve.
    await userEvent.click(screen.getByRole('button', { name: 'fails' }));
    expect(approveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'review.reject' })).toBeEnabled();
  });

  it('takes no new version while its scene is taken down, and says how to bring it back', async () => {
    act(() => openReviewItem(item({ takenDown: true })));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'drawn' }));
    expect(approveButton()).toBeDisabled();
    expect(screen.getByText('review.flag.takenDownHint')).toBeInTheDocument();
  });

  it('keeps the page when the approval stands but its files did not follow', async () => {
    bridge.answerReview.mockResolvedValue({
      ok: false,
      reason: 'files-failed',
    });
    act(() => openReviewItem(item()));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'drawn' }));
    await userEvent.click(approveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'review.filesFailed',
    );
    // Answering again is what finishes it.
    expect(approveButton()).toBeEnabled();
    expect(isReviewing(item())).toBe(true);
  });

  it("lets a late reply move nothing but the admin place's own line", async () => {
    let reply: (outcome: unknown) => void = () => {};
    bridge.answerReview.mockReturnValue(
      new Promise((resolve) => {
        reply = resolve;
      }),
    );
    act(() => openReviewItem(item()));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'drawn' }));
    await userEvent.click(approveButton());
    // Back, and into another scene, before the answer to the first returns.
    act(() => openReviewItem(other));
    await screen.findByRole('button', { name: 'drawn' });
    await act(async () => {
      reply({ ok: false, reason: 'offline' });
    });
    expect(isReviewing(other)).toBe(true);
    expect(screen.getByTestId('notice')).toHaveTextContent('review.failed');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('goes back to the list once an answer is in', async () => {
    act(() => openReviewItem(item()));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'drawn' }));
    await userEvent.click(approveButton());
    await waitFor(() => expect(isReviewing(item())).toBe(false));
    expect(screen.getByTestId('notice')).toHaveTextContent(
      'review.done.approved',
    );
    expect(bridge.answerReview).toHaveBeenCalledWith(
      MEI,
      'neon-city',
      3,
      'a'.repeat(64),
      { action: 'approve' },
    );
  });
});
