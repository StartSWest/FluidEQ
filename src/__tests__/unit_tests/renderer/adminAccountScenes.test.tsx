/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One account's scenes on the admin's card: a member's own scene, never
 * published (Ivan, 2026-10-19: "I wanna see their scenes or published
 * scenes"), says so; a published one does not. Nothing on the card says how
 * long anything played: that is not kept (premium 0071).
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
    addedAt: Date.parse('2026-10-18T10:00:00Z'),
  },
  {
    sceneId: 'alpine',
    version: 57,
    names: { en: 'Alpine' },
    category: 'nature',
    likedAt: Date.parse('2026-10-13T10:00:00Z'),
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
  // What it added and liked, counted; nothing about time on screen.
  expect(screen.getByText('insights.account.added')).toBeInTheDocument();
  expect(screen.getByText('insights.chip.liked')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/played|seconds|time/i);
});
