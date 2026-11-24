/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene tile in the look picker plays its clip only while the pointer or
 * the focus is on it (Ivan, 2026-11-23: "having all scenes playing preview
 * at the same time is too much resources, only when user hovers we play").
 * Every tile half in view used to play, up to twelve at once. Beside it, the
 * tile at rest: its picture, and no clip asked for.
 */

const asked: boolean[] = [];
jest.mock('../../../renderer/plus/cardClip', () => ({
  useSceneClip: (_scene: unknown, _me: unknown, active: boolean) => {
    asked.push(active);
    return active ? 'blob:clip' : undefined;
  },
}));
jest.mock('../../../renderer/plus/SceneClip', () => () => (
  <span data-testid="clip" />
));
jest.mock('../../../renderer/graph/lookPickerParts', () => ({
  SceneThumbnail: () => <span data-testid="picture" />,
  LockBadge: () => null,
}));
jest.mock('../../../renderer/graph/GraphSceneReport', () => () => null);
jest.mock('../../../renderer/graph/GraphSceneRemove', () => () => null);
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { LookPickerSceneTile } from '../../../renderer/graph/LookPickerTiles';
import type { IPlusRow } from '../../../renderer/graph/lookPickerRows';
/* eslint-enable import/first */

const row = {
  id: 'member:koi-pond',
  name: 'Koi Pond',
  swatch: ['#000000', '#ffffff'],
  maker: 'fluideq',
  categories: ['nature'],
  locked: false,
  thumbnail: {
    published: {
      authorId: 'prime',
      sceneId: 'koi-pond',
      version: 4,
      revision: '2026-11-20T00:00:00Z',
    },
  },
} as unknown as IPlusRow;

beforeEach(() => {
  asked.length = 0;
});

const tile = () =>
  render(
    <LookPickerSceneTile
      row={row}
      fresh={undefined}
      selected={false}
      tabbable
      onChoose={jest.fn()}
    />,
  );

it('shows its picture at rest and asks for no clip', () => {
  tile();
  expect(screen.getByTestId('picture')).toBeInTheDocument();
  expect(screen.queryByTestId('clip')).not.toBeInTheDocument();
  expect(asked.every((active) => !active)).toBe(true);
});

it('plays its clip under the pointer, and stops when the pointer leaves', () => {
  const { container } = tile();
  const item = container.querySelector('.look-picker__item');
  if (!item) {
    throw new Error('the tile has its item');
  }
  fireEvent.pointerEnter(item);
  expect(screen.getByTestId('clip')).toBeInTheDocument();
  fireEvent.pointerLeave(item);
  expect(screen.queryByTestId('clip')).not.toBeInTheDocument();
});

it('plays its clip while the keyboard is on it', () => {
  tile();
  const pick = screen.getByRole('button', { name: /Koi Pond/ });
  fireEvent.focus(pick);
  expect(screen.getByTestId('clip')).toBeInTheDocument();
  fireEvent.blur(pick);
  expect(screen.queryByTestId('clip')).not.toBeInTheDocument();
});
