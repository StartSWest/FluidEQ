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
import { act, render, screen, waitFor } from '@testing-library/react';
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
  render(<SceneVersions scene={scene} mayKeep={false} />);
  expect(await screen.findByText('plus.version.all:4')).toBeInTheDocument();
  expect(playButtons()).toHaveLength(0);
  expect(screen.queryByRole('status')).toBeNull();
});

it('offers Play only on the versions this computer kept', async () => {
  kept = { versions: [3, 2] };
  render(<SceneVersions scene={scene} mayKeep />);
  await waitFor(() => expect(playButtons()).toHaveLength(2));
  expect(
    playButtons().map((button) => button.getAttribute('aria-label')),
  ).toEqual(['plus.version.playLabel:3', 'plus.version.playLabel:2']);
  // Quiet: playing an earlier version is never the recommended action.
  playButtons().forEach((button) => expect(button).toHaveClass('subtle'));
});

it('plays a kept version, says so, and goes back to the newest', async () => {
  kept = { versions: [3, 2] };
  render(<SceneVersions scene={scene} mayKeep />);
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
  render(<SceneVersions scene={scene} mayKeep />);
  expect(await screen.findByText('plus.version.keptHere')).toBeInTheDocument();
  expect(playButtons()).toHaveLength(1);
});

describe('saving a version the server still holds', () => {
  // Ivan, 2026-11-09: the server keeps each scene's last 10 versions, and
  // "a member can pick any of those 10 and save it locally".
  const saveCalls = jest.fn<Promise<unknown>, [string, string, number]>();
  const cancelCalls = jest.fn<Promise<void>, [string, string, number]>();
  let answer: (value: unknown) => void = () => undefined;

  const withSaving = (available: Record<number, boolean>) => {
    const bridge = window.electron?.ipcRenderer;
    window.electron = {
      ipcRenderer: {
        ...bridge,
        galleryVersions: async () => ({
          ok: true,
          versions: [4, 3, 2, 1].map((version) => ({
            version,
            publishedAt: `2026-0${version + 5}-01T10:00:00Z`,
            available: available[version] ?? false,
          })),
        }),
        saveGalleryVersion: saveCalls,
        cancelGallerySaveVersion: cancelCalls,
      },
    } as unknown as typeof window.electron;
  };

  const saveButtons = () =>
    screen.queryAllByRole('button', { name: /^plus.version.saveLabel/ });

  beforeEach(() => {
    saveCalls.mockReset();
    cancelCalls.mockReset();
    cancelCalls.mockResolvedValue(undefined);
    saveCalls.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
  });

  it('marks the current version, offers Save on the ones the server holds, and says which it let go', async () => {
    withSaving({ 4: true, 3: true, 2: true });
    render(<SceneVersions scene={scene} mayKeep />);
    await waitFor(() => expect(saveButtons()).toHaveLength(2));
    expect(
      saveButtons().map((button) => button.getAttribute('aria-label')),
    ).toEqual(['plus.version.saveLabel:3', 'plus.version.saveLabel:2']);
    expect(screen.getByText('plus.version.current')).toBeInTheDocument();
    expect(screen.getByText('plus.version.gone')).toBeInTheDocument();
    // Quiet: keeping an old version is never the recommended action.
    saveButtons().forEach((button) => expect(button).toHaveClass('subtle'));
  });

  it('offers nothing to save to somebody who does not own the scene', async () => {
    withSaving({ 4: true, 3: true, 2: true });
    render(<SceneVersions scene={scene} mayKeep={false} />);
    expect(await screen.findByText('plus.version.current')).toBeInTheDocument();
    expect(saveButtons()).toHaveLength(0);
    expect(screen.queryByText('plus.version.gone')).toBeNull();
  });

  it('runs from the press, can be cancelled, and once saved is a kept version with its Play', async () => {
    withSaving({ 4: true, 3: true, 2: true });
    render(<SceneVersions scene={scene} mayKeep />);
    await waitFor(() => expect(saveButtons()).toHaveLength(2));
    await userEvent.click(saveButtons()[1]);
    expect(saveCalls).toHaveBeenCalledWith(scene.authorId, 'alpine', 2);
    const running = screen.getByRole('button', {
      name: 'plus.version.saveLabel:2',
    });
    expect(running).toHaveAttribute('aria-busy', 'true');
    expect(running).toHaveClass('is-running');
    expect(screen.getByRole('status')).toHaveTextContent('plus.version.saving');
    // One at a time.
    expect(saveButtons()[0]).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: 'plus.version.cancelSave' }),
    );
    expect(cancelCalls).toHaveBeenCalledWith(scene.authorId, 'alpine', 2);

    // The save had landed before the cancel: saved is what it answers.
    kept = { versions: [2] };
    await act(async () => answer({ ok: true, version: 2 }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'plus.version.saved:2',
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'plus.version.playLabel:2' }),
      ).toBeInTheDocument(),
    );
    expect(saveButtons()).toHaveLength(1);
  });

  it('says why a version could not be saved, and says nothing of a cancel', async () => {
    withSaving({ 4: true, 3: true });
    render(<SceneVersions scene={scene} mayKeep />);
    await waitFor(() => expect(saveButtons()).toHaveLength(1));
    await userEvent.click(saveButtons()[0]);
    await act(async () => answer({ ok: false, reason: 'gone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'plus.version.failGone:3',
    );
    // It can be tried again.
    expect(saveButtons()).toHaveLength(1);

    await userEvent.click(saveButtons()[0]);
    await act(async () => answer({ ok: false, reason: 'cancelled' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButtons()).toHaveLength(1);
  });

  it('reads an answer it does not understand as a failure', async () => {
    withSaving({ 4: true, 3: true });
    render(<SceneVersions scene={scene} mayKeep />);
    await waitFor(() => expect(saveButtons()).toHaveLength(1));
    await userEvent.click(saveButtons()[0]);
    await act(async () => answer({ saved: 'yes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'plus.version.failFailed:3',
    );
  });

  it('offers no Save in a window whose bridge cannot save yet', async () => {
    withSaving({ 4: true, 3: true });
    const bridge = window.electron?.ipcRenderer as Record<string, unknown>;
    delete bridge.saveGalleryVersion;
    render(<SceneVersions scene={scene} mayKeep />);
    expect(await screen.findByText('plus.version.current')).toBeInTheDocument();
    expect(saveButtons()).toHaveLength(0);
  });
});
