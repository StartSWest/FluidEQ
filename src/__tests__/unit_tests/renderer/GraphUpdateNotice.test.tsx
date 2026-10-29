/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { translate as mockTranslate } from '../../../common/i18n';
import type { IGalleryScene } from '../../../common/plusGallery';
import GraphUpdateNotice from '../../../renderer/graph/GraphUpdateNotice';
import { reportScenePlayed } from '../../../renderer/graph/sceneUpdateStore';
import { openGalleryPage } from '../../../renderer/plus/plusNavigation';
import { requestPlusTab } from '../../../renderer/plus/plusTabRequest';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (
      key: Parameters<typeof mockTranslate>[1],
      vars: Parameters<typeof mockTranslate>[2],
    ) => mockTranslate('en', key, vars),
  }),
}));
jest.mock('../../../renderer/plus/galleryStore', () => ({
  findGalleryScene: () => undefined,
}));
jest.mock('../../../renderer/plus/plusNavigation', () => ({
  openGalleryPage: jest.fn(),
}));
jest.mock('../../../renderer/plus/plusTabRequest', () => ({
  requestPlusTab: jest.fn(),
}));

const names = { en: 'Neon Horizon' };
const played = (lookId: string, version: number) =>
  act(async () => reportScenePlayed({ lookId, version, names }));
const mount = () =>
  render(
    <StrictMode>
      <GraphUpdateNotice />
    </StrictMode>,
  );
const cards = () => document.querySelectorAll('.plus-toast-slot');
const finishExit = () => {
  document.querySelectorAll('.plus-toast-slot.is-leaving').forEach((slot) => {
    fireEvent.animationEnd(slot);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'electron');
});

it.each(['close', 'lifetime'] as const)(
  'shows version 11 once across %s, repeated play, reselect and graph remount',
  async (dismiss) => {
    const lookId = `premium:neon-${dismiss}`;
    await played(lookId, 10);
    const graph = mount();
    expect(cards()).toHaveLength(0);
    await played(lookId, 11);
    expect(screen.getByText('Neon Horizon is now version 11')).toBeVisible();
    if (dismiss === 'close') {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    } else {
      const life = document.querySelector('.plus-toast__life');
      if (!life) {
        throw new Error('the success lifetime is missing');
      }
      fireEvent.animationEnd(life);
    }
    finishExit();
    expect(cards()).toHaveLength(0);
    await played(lookId, 11);
    await played(lookId, 10);
    await played(lookId, 11);
    graph.unmount();
    mount();
    expect(cards()).toHaveLength(0);
    // A genuinely newer confirmed version still gets its own toast.
    await played(lookId, 12);
    expect(screen.getByText('Neon Horizon is now version 12')).toBeVisible();
  },
);

it('does not replay even when the graph unmounts before dismissal', async () => {
  const lookId = 'premium:neon-pending-life';
  await played(lookId, 10);
  await played(lookId, 11);
  const graph = mount();
  expect(cards()).toHaveLength(1);
  graph.unmount();
  mount();
  await played(lookId, 11);
  expect(cards()).toHaveLength(0);
});

it('delivers once when two graph surfaces are mounted together', async () => {
  const lookId = 'premium:two-surfaces';
  await played(lookId, 10);
  await played(lookId, 11);
  render(
    <StrictMode>
      <GraphUpdateNotice />
      <GraphUpdateNotice />
    </StrictMode>,
  );
  expect(cards()).toHaveLength(1);
  await played(lookId, 11);
  expect(cards()).toHaveLength(1);
});

it("keeps See what's new and treats another scene at version 11 independently", async () => {
  const lookId = 'premium:neon-action';
  const scene = {
    lookId,
    version: 11,
    names,
    versionNote: 'The skyline stays whole',
  } as IGalleryScene;
  window.electron = {
    ipcRenderer: {
      listGallery: jest.fn(async () => ({ ok: true, scenes: [scene] })),
    },
  } as unknown as typeof window.electron;
  await played(lookId, 10);
  const graph = mount();
  await played(lookId, 11);
  expect(
    screen.getByText('Neon Horizon is now version 11: The skyline stays whole'),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: "See what's new" }));
  expect(openGalleryPage).toHaveBeenCalledWith({ kind: 'scene', scene });
  expect(requestPlusTab).toHaveBeenCalledTimes(1);
  finishExit();
  graph.unmount();
  mount();
  await played(lookId, 11);
  expect(cards()).toHaveLength(0);
  await played('premium:another-scene', 10);
  await played('premium:another-scene', 11);
  expect(screen.getByText('Neon Horizon is now version 11')).toBeVisible();
});
