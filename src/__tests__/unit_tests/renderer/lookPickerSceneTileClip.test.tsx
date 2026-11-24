/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene tile in the look picker, through the real clip and picture code:
 * a tile only ever shows its published clip or its picture (Ivan,
 * 2026-11-24: "remember we only show videos as thumbnail, not the actual
 * viz; if the viz doesn't have a video we show the thumbnail picture that
 * comes with scenes"), Animations off takes the clips away while the picker
 * is open and on brings them back ("if user selects animation off in the app
 * we don't show the videos"), and closing the picker lets every clip go.
 */

let mockReduced = false;
const drawn: string[] = [];

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'active' }),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({ status: 'signed-in', identity: { id: 'me' } }),
}));
jest.mock('../../../renderer/utils/bandReveal', () => ({
  prefersReducedMotion: () => mockReduced,
}));
// The scene itself, drawn: what a tile must never start.
jest.mock('../../../renderer/graph/sceneStillClient', () => ({
  drawShowcaseInWorker: async (pack: { id: string }) => {
    drawn.push(pack.id);
    return { blob: undefined, uncompiled: false };
  },
}));
jest.mock('../../../renderer/graph/sceneHealth', () => ({
  isSceneRenderingAvailable: () => true,
}));
jest.mock('../../../renderer/graph/GraphSceneReport', () => () => null);
jest.mock('../../../renderer/graph/GraphSceneRemove', () => () => null);

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, render, waitFor } from '@testing-library/react';
import { LookPickerSceneTile } from '../../../renderer/graph/LookPickerTiles';
import type { IPlusRow } from '../../../renderer/graph/lookPickerRows';
import {
  SceneClipScope,
  forgetClipDecoder,
} from '../../../renderer/graph/lookTileClips';
import { resetLookThumbnails } from '../../../renderer/graph/lookThumbnails';
import { resetCardClips } from '../../../renderer/plus/cardClip';
import { applyMotionPreference } from '../../../renderer/utils/motionPreference';
/* eslint-enable import/first */

const CLIP = {
  bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
  mimeType: 'video/webm' as const,
};

const scene = (sceneId: string) =>
  ({
    id: `member:${sceneId}`,
    name: sceneId,
    swatch: ['#000000', '#ffffff'],
    maker: 'fluideq',
    categories: ['nature'],
    locked: false,
    thumbnail: {
      lookId: `member:${sceneId}`,
      version: '1',
      published: { authorId: 'prime', sceneId, version: 1 },
      // Installed too: a picture could be drawn from it, and must not be.
      load: async () => ({ id: sceneId }),
    },
  }) as unknown as IPlusRow;

const bridge = {
  galleryPicture: jest.fn(
    async (_author: string, sceneId: string) => `data:image/webp;${sceneId}`,
  ),
  galleryClip: jest.fn(),
  previewGalleryScene: jest.fn(),
};

const revokeUrl = jest.fn();

const InView = jest.fn((report: IntersectionObserverCallback) => ({
  observe: (element: Element) =>
    report(
      [{ target: element, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  unobserve: () => undefined,
  disconnect: () => undefined,
}));

const picker = (ids: string[]) =>
  render(
    <div data-look-picker-scroll>
      <SceneClipScope>
        {ids.map((id) => (
          <LookPickerSceneTile
            key={id}
            row={scene(id)}
            fresh={undefined}
            selected={false}
            tabbable={false}
            onChoose={jest.fn()}
          />
        ))}
      </SceneClipScope>
    </div>,
  );

const tile = (container: HTMLElement, id: string) => {
  const found = [...container.querySelectorAll('.look-picker__item')].find(
    (item) => item.querySelector('.look-picker__name')?.textContent === id,
  );
  if (!found) {
    throw new Error(`${id} is in the picker`);
  }
  return found;
};

const clipOf = (container: HTMLElement, id: string) =>
  tile(container, id).querySelector('video.look-picker__clip');

const pictureOf = (container: HTMLElement, id: string) =>
  tile(container, id).querySelector('.look-picker__thumb img');

beforeAll(() => {
  window.IntersectionObserver =
    InView as unknown as typeof IntersectionObserver;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockReduced = false;
  drawn.length = 0;
  resetCardClips();
  resetLookThumbnails();
  forgetClipDecoder();
  let made = 0;
  bridge.galleryClip.mockImplementation(async (_author, sceneId: string) =>
    sceneId === 'no-clip' ? undefined : CLIP,
  );
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => {
      made += 1;
      return `blob:clip-${made}`;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeUrl,
  });
  // jsdom plays nothing; these are only called on the way out.
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: () => undefined,
  });
});

it('shows the picture of a scene with no clip and starts no rendering of it', async () => {
  const { container } = picker(['with-clip', 'no-clip']);
  // The control: the scene with a clip plays it, over its picture.
  await waitFor(() => expect(clipOf(container, 'with-clip')).not.toBeNull());
  await waitFor(() =>
    expect(pictureOf(container, 'no-clip')).toHaveAttribute(
      'src',
      'data:image/webp;no-clip',
    ),
  );
  expect(clipOf(container, 'no-clip')).toBeNull();
  // Asked once, and nothing of the scene itself: no frame drawn from the
  // installed copy, no scene fetched to run.
  expect(
    bridge.galleryClip.mock.calls.filter((call) => call[1] === 'no-clip'),
  ).toHaveLength(1);
  expect(drawn).toEqual([]);
  expect(bridge.previewGalleryScene).not.toHaveBeenCalled();
});

it('takes the clips away while Animations are off, keeps the pictures, and plays again when on', async () => {
  const { container } = picker(['koi', 'aurora']);
  await waitFor(() => expect(clipOf(container, 'aurora')).not.toBeNull());
  expect(clipOf(container, 'koi')).not.toBeNull();
  mockReduced = true;
  act(() => applyMotionPreference('reduced'));
  expect(container.querySelectorAll('video')).toHaveLength(0);
  expect(revokeUrl).toHaveBeenCalledTimes(2);
  expect(pictureOf(container, 'koi')).not.toBeNull();
  expect(pictureOf(container, 'aurora')).not.toBeNull();
  mockReduced = false;
  act(() => applyMotionPreference('full'));
  await waitFor(() =>
    expect(container.querySelectorAll('video')).toHaveLength(2),
  );
});

it('lets every clip go when the picker closes', async () => {
  const { container, unmount } = picker(['koi', 'aurora']);
  await waitFor(() =>
    expect(container.querySelectorAll('video')).toHaveLength(2),
  );
  unmount();
  expect(revokeUrl).toHaveBeenCalledTimes(2);
});
