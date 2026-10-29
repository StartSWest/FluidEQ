/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IPublishedScene } from 'common/plusGallery';
import type { ISceneSubmission } from 'common/plusReview';
import type { TMineOutcome } from 'main/ipc/plusPublishing';
import type { TMySubmissionsOutcome } from 'main/ipc/plusReview';
import { loadMyScenes } from 'renderer/plus/myScenes';
import YourScenes from 'renderer/plus/YourScenes';
import { subscribeAccountPanelRequests } from 'renderer/account/accountPanel';

const published = jest.fn<Promise<TMineOutcome>, []>();
const submitted = jest.fn<Promise<TMySubmissionsOutcome>, []>();
const scene: IPublishedScene = {
  sceneId: 'neon-lake',
  names: { en: 'Neon Lake' },
  version: 1,
  swatch: ['#112233'],
  category: 'water',
  likes: 2,
  adds: 3,
  publishedAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  blocked: false,
};
const waiting: ISceneSubmission = {
  sceneId: 'quiet-pond',
  names: { en: 'Quiet Pond' },
  version: 1,
  category: 'water',
  swatch: ['#112233'],
  state: 'pending',
  submittedAt: '2026-10-27T12:00:00Z',
  sha256: 'a'.repeat(64),
};

beforeEach(() => {
  published.mockReset().mockResolvedValue({ ok: true, scenes: [], floors: [] });
  submitted.mockReset().mockResolvedValue({ ok: true, submissions: [] });
  window.electron = {
    ipcRenderer: {
      myPublishedScenes: published,
      mySceneSubmissions: submitted,
    },
  } as unknown as typeof window.electron;
});

test('a failed review request cannot become an empty creator account', async () => {
  submitted.mockResolvedValue({ ok: false, reason: 'server' });
  render(<YourScenes me="maker" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The gallery could not be loaded',
  );
  expect(
    screen.queryByText('You have not published anything yet.'),
  ).not.toBeInTheDocument();
  expect(await loadMyScenes()).toEqual({
    state: 'failed',
    key: 'plus.gallery.error.server',
  });
});

test('a rejected review transport is offline, never an empty queue', async () => {
  submitted.mockRejectedValue(new Error('connection lost'));
  expect(await loadMyScenes()).toEqual({
    state: 'failed',
    key: 'plus.gallery.error.offline',
  });
});

test('a first submission with no publication stays visible as under review', async () => {
  submitted.mockResolvedValue({ ok: true, submissions: [waiting] });
  render(<YourScenes me="maker" />);
  expect(await screen.findByText('Quiet Pond')).toBeVisible();
  expect(screen.getByText('Under review')).toBeVisible();
  expect(
    screen.queryByText('You have not published anything yet.'),
  ).not.toBeInTheDocument();
});

test.each(['offline', 'server', 'forbidden'] as const)(
  'a %s failure stays an error until a successful retry',
  async (reason) => {
    published.mockResolvedValueOnce({ ok: false, reason });
    render(<YourScenes me="maker" />);
    expect(await screen.findByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('You have not published anything yet.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(published).toHaveBeenCalledTimes(2);
  },
);

test('guests and expired sessions get an account action, never an empty publication list', async () => {
  const auth = jest.fn();
  const stop = subscribeAccountPanelRequests(auth);
  const view = render(<YourScenes me={undefined} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign in again');
  expect(published).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(auth).toHaveBeenCalledTimes(1);
  published.mockResolvedValueOnce({ ok: false, reason: 'signed-out' });
  view.rerender(<YourScenes me="maker" />);
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible();
  stop();
});

test('published scenes and a pending update remain separate from first submissions', async () => {
  published.mockResolvedValue({ ok: true, scenes: [scene], floors: [] });
  submitted.mockResolvedValue({
    ok: true,
    submissions: [
      waiting,
      {
        ...waiting,
        sceneId: scene.sceneId,
        names: scene.names,
        version: 2,
        liveVersion: 1,
      },
    ],
  });
  render(<YourScenes me="maker" />);
  expect(await screen.findByText('Neon Lake')).toBeVisible();
  expect(screen.getByText('Quiet Pond')).toBeVisible();
  expect(screen.getByText('Version 2 under review')).toBeVisible();
});

test('an old account result cannot overwrite the new account or a newer retry', async () => {
  let finishOld: ((outcome: TMineOutcome) => void) | undefined;
  published.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  const view = render(<YourScenes me="first" />);
  view.rerender(<YourScenes me="second" />);
  await screen.findByText('You have not published anything yet.');
  await act(async () => {
    finishOld?.({ ok: true, scenes: [scene], floors: [] });
  });
  expect(screen.queryByText('Neon Lake')).not.toBeInTheDocument();
});
