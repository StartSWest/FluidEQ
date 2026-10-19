/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One account's scenes on the admin's card: a member's own scene, played
 * from their looks and never published (server 0058, Ivan, 2026-10-19: "I
 * wanna see their scenes or published scenes"), says so; a published one
 * does not.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IAccountScene } from '../../../common/sceneTaste';
import AdminAccountScenes from '../../../renderer/plus/AdminAccountScenes';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/plus/GalleryParts', () => ({
  ...jest.requireActual('../../../renderer/plus/GalleryParts'),
  ScenePicture: () => null,
}));

const MEMBER = '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

const scenes: IAccountScene[] = [
  {
    authorId: MEMBER,
    sceneId: 'supernova',
    authorName: 'Ivan',
    seconds: 2169,
    days: 1,
    lastPlayed: '2026-10-18',
  },
  {
    sceneId: 'alpine',
    version: 57,
    names: { en: 'Alpine' },
    category: 'nature',
    seconds: 2763,
    days: 2,
    lastPlayed: '2026-10-13',
  },
];

beforeEach(() => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        adminAccountScenes: jest.fn(async () => ({ ok: true, value: scenes })),
      },
    },
  });
});

it("marks a member's own scene that was never published, and only that one", async () => {
  render(<AdminAccountScenes userId={MEMBER} />);
  const chips = await screen.findAllByText('insights.chip.unpublished');
  expect(chips).toHaveLength(1);
  expect(chips[0].closest('li')).toHaveTextContent('supernova');
  expect(screen.queryByText('insights.account.notPlayed')).toBeNull();
});
