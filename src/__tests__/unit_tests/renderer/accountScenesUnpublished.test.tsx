/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The account's collection marks a scene its maker unpublished (premium
 * 0103): it is still theirs and plays, it is just no longer in the gallery.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AccountScenes from '../../../renderer/account/AccountScenes';

const MAKER = '22222222-2222-4222-8222-222222222222';
const KEPT = `member:${MAKER}:lake`;
const LISTED = `member:${MAKER}:pond`;

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [],
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () =>
    ['lake', 'pond'].map((id) => ({
      lookId: `member:${MAKER}:${id}`,
      authorId: MAKER,
      packId: id,
      version: 3,
      names: { en: id },
    })),
}));
jest.mock('../../../renderer/plus/GalleryParts', () => ({
  ScenePicture: () => null,
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  setGraphLook: jest.fn(),
  useSelectedLookId: () => undefined,
}));

it('marks the unpublished scene, and only it', () => {
  render(
    <AccountScenes
      owned={[KEPT, LISTED]}
      unpublished={[{ lookId: KEPT, version: 3 }]}
      onLeave={jest.fn()}
    />,
  );
  const marks = screen.getAllByText('account.scenes.unpublished');
  expect(marks).toHaveLength(1);
  expect(marks[0].closest('button')).toHaveAccessibleName(
    'account.scenes.play:lake',
  );
  expect(marks[0]).toHaveAttribute('title', 'account.scenes.unpublishedHint');
});

it('marks nothing when the server said nothing was unpublished', () => {
  render(<AccountScenes owned={[KEPT, LISTED]} onLeave={jest.fn()} />);
  expect(screen.queryByText('account.scenes.unpublished')).toBeNull();
});
