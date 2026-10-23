/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's versions on its page: the history the server keeps, and for an
 * owner the earlier versions this computer kept, each playable again from
 * the copy on disk. What is held: Play only where a copy is kept, the line
 * saying which plays with the way back, and a page for somebody who owns
 * nothing showing the history alone.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IGalleryScene } from '../../../common/plusGallery';
import type { IKeptSceneVersions } from '../../../common/sceneStore';
import SceneVersions from '../../../renderer/plus/SceneVersions';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const scene = {
  authorId: '00000000-0000-4000-8000-000000000001',
  sceneId: 'alpine',
  lookId: 'premium:alpine',
  version: 4,
  updatedAt: '2026-10-15T10:00:00Z',
} as unknown as IGalleryScene;

let kept: IKeptSceneVersions;
const play = jest.fn<Promise<boolean>, [string, string, number | null]>();

beforeEach(() => {
  kept = { versions: [] };
  play.mockReset();
  play.mockImplementation(async (_author, _scene, version) => {
    kept =
      version === null
        ? { versions: kept.versions }
        : { versions: kept.versions, playing: version };
    return true;
  });
  window.electron = {
    ipcRenderer: {
      galleryVersions: async () => ({
        ok: true,
        versions: [
          {
            version: 3,
            note: 'Brighter lake.',
            publishedAt: '2026-09-02T10:00:00Z',
          },
          { version: 2, publishedAt: '2026-08-11T10:00:00Z' },
          { version: 1, publishedAt: '2026-07-20T10:00:00Z' },
        ],
      }),
      keptSceneVersions: async () => kept,
      playSceneVersion: play,
      onSceneStoreChanged: () => () => undefined,
    },
  } as unknown as typeof window.electron;
});

const playButtons = () =>
  screen.queryAllByRole('button', { name: /^plus\.version\.playLabel/ });

it('shows the history alone to somebody with nothing kept', async () => {
  render(<SceneVersions scene={scene} />);
  expect(await screen.findByText('plus.version.earlier:3')).toBeInTheDocument();
  expect(playButtons()).toHaveLength(0);
  expect(screen.queryByRole('status')).toBeNull();
});

it('offers Play only on the versions this computer kept', async () => {
  kept = { versions: [3, 2] };
  render(<SceneVersions scene={scene} />);
  await waitFor(() => expect(playButtons()).toHaveLength(2));
  expect(
    playButtons().map((button) => button.getAttribute('aria-label')),
  ).toEqual(['plus.version.playLabel:3', 'plus.version.playLabel:2']);
  // Quiet: playing an earlier version is never the recommended action.
  playButtons().forEach((button) => expect(button).toHaveClass('subtle'));
});

it('plays a kept version, says so, and goes back to the newest', async () => {
  kept = { versions: [3, 2] };
  render(<SceneVersions scene={scene} />);
  await waitFor(() => expect(playButtons()).toHaveLength(2));
  await userEvent.click(playButtons()[1]);
  expect(play).toHaveBeenCalledWith(scene.authorId, 'alpine', 2);
  expect(await screen.findByRole('status')).toHaveTextContent(
    'plus.version.playingLine:2',
  );
  expect(screen.getByText('plus.version.playing')).toBeInTheDocument();
  // The playing one has no Play of its own; the other keeps its.
  expect(playButtons()).toHaveLength(1);

  await userEvent.click(
    screen.getByRole('button', { name: 'plus.version.backToNewest' }),
  );
  expect(play).toHaveBeenLastCalledWith(scene.authorId, 'alpine', null);
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(playButtons()).toHaveLength(2);
});

it('lists a kept version the server history no longer names', async () => {
  window.electron = {
    ipcRenderer: {
      ...window.electron?.ipcRenderer,
      galleryVersions: async () => ({ ok: true, versions: [] }),
    },
  } as unknown as typeof window.electron;
  kept = { versions: [2] };
  render(<SceneVersions scene={scene} />);
  expect(await screen.findByText('plus.version.keptHere')).toBeInTheDocument();
  expect(playButtons()).toHaveLength(1);
});
