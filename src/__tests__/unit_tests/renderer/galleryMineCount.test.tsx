/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IPublishedScene } from 'common/plusGallery';
import type { ISceneSubmission } from 'common/plusReview';
import GalleryToolbar from 'renderer/plus/GalleryToolbar';
import {
  rememberMyScenes,
  resetMyScenesCount,
  useMyScenesCount,
} from 'renderer/plus/myScenesCount';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * Ivan, 2026-11-25: "In the gallery, on 'Your scenes', I want to see the
 * total of my scenes there too". The button counts the rows its page lists,
 * which for the account that publishes FluidEQ's own scenes hold those too.
 */

const published = (sceneId: string, official = false) =>
  ({ sceneId, official, version: 1 }) as unknown as IPublishedScene;
const sent = (sceneId: string, state: ISceneSubmission['state']) =>
  ({ sceneId, state, version: 2 }) as unknown as ISceneSubmission;

interface IAnswer {
  scenes: IPublishedScene[];
  submissions: ISceneSubmission[];
}

/**
 * Each ask - the published list and the submissions, asked together - waits
 * until the case answers it.
 */
interface IAsk {
  published: (value: unknown) => void;
  sent?: (value: unknown) => void;
}
const asks: IAsk[] = [];
const answer = async (next: IAnswer) => {
  const ask = asks.shift();
  if (!ask?.sent) {
    throw new Error('nothing was asked');
  }
  const { sent: reply } = ask;
  await act(async () => {
    ask.published({ ok: true, scenes: next.scenes });
    reply({ ok: true, submissions: next.submissions });
  });
};

beforeEach(() => {
  resetMyScenesCount();
  asks.length = 0;
  window.electron = {
    ipcRenderer: {
      myPublishedScenes: jest.fn(
        () =>
          new Promise((resolve) => {
            asks.push({ published: resolve });
          }),
      ),
      mySceneSubmissions: jest.fn(
        () =>
          new Promise((resolve) => {
            const last = asks[asks.length - 1];
            if (last) {
              last.sent = resolve;
            }
          }),
      ),
    },
  } as unknown as typeof window.electron;
});

function Gallery({ me }: { me: string | undefined }) {
  const count = useMyScenesCount(me);
  return (
    <I18nProvider>
      <GalleryToolbar
        filters={{ sort: 'new', text: '' }}
        onFilters={jest.fn()}
        onMine={jest.fn()}
        mineCount={me === undefined ? undefined : (count ?? null)}
        signedIn={me !== undefined}
      />
    </I18nProvider>
  );
}

const countOnButton = () =>
  screen
    .getByRole('button', { name: /Your scenes/ })
    .querySelector('.gallery-toolbar__count');

it('keeps the count’s room while it is asked, then shows every row the page lists', async () => {
  render(<Gallery me="me" />);
  const placeholder = countOnButton();
  expect(placeholder).toBeInTheDocument();
  expect(placeholder).toHaveTextContent('');
  expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  await answer({
    scenes: [published('reef'), published('ember')],
    // Waiting and declined are rows of their own; an approved one, or a new
    // version of a scene already listed, is not.
    submissions: [
      sent('fresh', 'pending'),
      sent('odd', 'rejected'),
      sent('reef', 'pending'),
      sent('gone', 'approved'),
    ],
  });
  expect(countOnButton()).toHaveTextContent('4');
  expect(countOnButton()).not.toHaveAttribute('aria-hidden');
  expect(
    screen.getByRole('button', { name: /Your scenes/ }),
  ).toHaveAccessibleName('Your scenes 4');
});

it('counts FluidEQ’s own scenes for the account that publishes them', async () => {
  render(<Gallery me="publisher" />);
  await answer({
    scenes: [
      published('alpine', true),
      published('aurora', true),
      published('reef', true),
      published('my-own'),
    ],
    submissions: [],
  });
  expect(countOnButton()).toHaveTextContent('4');
});

it('takes the page’s own number over an older answer still on its way', async () => {
  render(<Gallery me="me" />);
  // The page took a scene down while the button's ask was out.
  act(() => {
    rememberMyScenes('me', {
      state: 'ready',
      scenes: [published('reef')],
      sent: [],
    });
  });
  expect(countOnButton()).toHaveTextContent('1');
  await answer({
    scenes: [published('reef'), published('ember')],
    submissions: [],
  });
  expect(countOnButton()).toHaveTextContent('1');
});

it('never shows another account’s number, and no count to somebody signed out', async () => {
  const { rerender } = render(<Gallery me="first" />);
  await answer({ scenes: [published('a'), published('b')], submissions: [] });
  expect(countOnButton()).toHaveTextContent('2');
  rerender(<Gallery me="second" />);
  expect(countOnButton()).toHaveTextContent('');
  await answer({ scenes: [published('c')], submissions: [] });
  expect(countOnButton()).toHaveTextContent('1');
  rerender(<Gallery me={undefined} />);
  expect(countOnButton()).toBeNull();
});
