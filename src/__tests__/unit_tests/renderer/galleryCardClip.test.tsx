/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A gallery card plays its scene's published clip while hovered or focused
 * (Ivan, 2026-11-13: "add hover and play the video only not the scene"). What
 * is held: nothing is asked for before a hover, the scene itself is never
 * asked for, the clip shows only once it plays, a pointer that left before
 * the clip landed leaves nothing playing, one card plays at a time, a scene
 * with no clip is asked once, and reduced motion plays nothing.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { IGalleryScene } from '../../../common/plusGallery';
import { resetCardClips } from '../../../renderer/plus/cardClip';
import GalleryCard from '../../../renderer/plus/GalleryCard';
import { resetGalleryActions } from '../../../renderer/plus/galleryActions';
import { resetScenePictures } from '../../../renderer/plus/scenePictures';

const SOMEONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
let mockReduced = false;

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'active' }),
  getEntitlementSnapshot: () => ({ state: 'active' }),
  subscribeEntitlement: () => () => undefined,
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({ status: 'signed-in', identity: { id: 'me' } }),
  getAccountSnapshot: () => ({ status: 'signed-in', identity: { id: 'me' } }),
  subscribeAccount: () => () => undefined,
}));

jest.mock('../../../renderer/graph/sceneStill', () => ({
  renderSceneStill: async () => undefined,
  blobAsDataUrl: async () => 'data:image/webp;base64,ZHJhd24=',
}));

jest.mock('../../../renderer/utils/bandReveal', () => ({
  prefersReducedMotion: () => mockReduced,
}));

const scene = (over: Partial<IGalleryScene> = {}): IGalleryScene => ({
  lookId: `member:${SOMEONE}:neon-city`,
  authorId: SOMEONE,
  sceneId: 'neon-city',
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  version: 3,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  hasPhoto: false,
  likes: 12,
  likesWeek: 2,
  adds: 5,
  updatedAt: '2026-09-10T12:00:00Z',
  liked: false,
  added: false,
  ...over,
});

const CLIP = {
  bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
  mimeType: 'video/webm' as const,
};

const bridge = {
  galleryPicture: jest.fn(),
  galleryClip: jest.fn(),
  previewGalleryScene: jest.fn(),
  listScenePacks: jest.fn(),
  listMemberScenes: jest.fn(),
  onMemberScenesChanged: jest.fn(() => () => undefined),
};

const createUrl = jest.fn();
const revokeUrl = jest.fn();
const pause = jest.fn();
const load = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockReduced = false;
  resetCardClips();
  resetScenePictures();
  resetGalleryActions();
  let made = 0;
  createUrl.mockImplementation(() => {
    made += 1;
    return `blob:clip-${made}`;
  });
  bridge.galleryPicture.mockResolvedValue(undefined);
  bridge.galleryClip.mockResolvedValue(CLIP);
  bridge.listScenePacks.mockResolvedValue({ packs: [], locked: [] });
  bridge.listMemberScenes.mockResolvedValue({ scenes: [], locked: [] });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeUrl,
  });
  // jsdom plays nothing; these are only called on the way out.
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: pause,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: load,
  });
});

const renderCard = (over: Partial<IGalleryScene> = {}, name = 'Neon City') => {
  const view = render(
    <GalleryCard
      scene={scene({ names: { en: name }, ...over })}
      local={undefined}
      me="me"
      onOpen={jest.fn()}
    />,
  );
  return view;
};

const thumbOf = (name: string) =>
  screen.getByRole('button', { name: `plus.card.open:${name}` });

const clipIn = (container: HTMLElement) =>
  container.querySelector<HTMLVideoElement>('video.gallery-card__clip');

it('asks for nothing until the card is hovered, and never for the scene', async () => {
  const { container } = renderCard();
  await act(async () => undefined);
  expect(bridge.galleryClip).not.toHaveBeenCalled();

  fireEvent.pointerEnter(thumbOf('Neon City'));
  await waitFor(() => expect(clipIn(container)).not.toBeNull());
  expect(bridge.galleryClip).toHaveBeenCalledWith(
    SOMEONE,
    'neon-city',
    3,
    '2026-09-10T12:00:00Z',
  );
  expect(bridge.previewGalleryScene).not.toHaveBeenCalled();
});

it('shows the clip only once it plays, muted and looping, and lets it go on leaving', async () => {
  const { container } = renderCard();
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await waitFor(() => expect(clipIn(container)).not.toBeNull());
  const video = clipIn(container);
  expect(video).toHaveAttribute('src', 'blob:clip-1');
  expect(video?.muted).toBe(true);
  expect(video?.loop).toBe(true);
  // Over the cover, not instead of it: the picture is still there.
  expect(container.querySelector('.gallery-picture')).not.toBeNull();
  expect(video).not.toHaveClass('is-playing');
  fireEvent.playing(video as HTMLVideoElement);
  expect(video).toHaveClass('is-playing');

  fireEvent.pointerLeave(thumbOf('Neon City'));
  expect(clipIn(container)).toBeNull();
  expect(revokeUrl).toHaveBeenCalledWith('blob:clip-1');
  expect(pause).toHaveBeenCalled();
  expect(load).toHaveBeenCalled();
});

it('leaves nothing playing when the pointer left before the clip landed', async () => {
  let land: (clip: typeof CLIP) => void = () => undefined;
  bridge.galleryClip.mockImplementation(
    () =>
      new Promise((resolve) => {
        land = resolve;
      }),
  );
  const { container } = renderCard();
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await waitFor(() => expect(bridge.galleryClip).toHaveBeenCalled());
  fireEvent.pointerLeave(thumbOf('Neon City'));
  await act(async () => land(CLIP));
  expect(clipIn(container)).toBeNull();
  expect(createUrl).not.toHaveBeenCalled();
});

it('plays one card at a time', async () => {
  const first = renderCard({}, 'Neon City');
  const second = renderCard(
    { lookId: `member:${SOMEONE}:deep-sea`, sceneId: 'deep-sea' },
    'Deep Sea',
  );
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await waitFor(() => expect(clipIn(first.container)).not.toBeNull());

  // The keyboard lands on the other card while the pointer rests on the first.
  fireEvent.focus(thumbOf('Deep Sea'));
  await waitFor(() => expect(clipIn(second.container)).not.toBeNull());
  expect(clipIn(first.container)).toBeNull();
  expect(revokeUrl).toHaveBeenCalledWith('blob:clip-1');

  fireEvent.blur(thumbOf('Deep Sea'));
  expect(clipIn(second.container)).toBeNull();
});

it('keeps the cover of a scene with no clip, and asks for it once', async () => {
  bridge.galleryClip.mockResolvedValue(undefined);
  const { container } = renderCard();
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await waitFor(() => expect(bridge.galleryClip).toHaveBeenCalledTimes(1));
  fireEvent.pointerLeave(thumbOf('Neon City'));
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await act(async () => undefined);
  expect(bridge.galleryClip).toHaveBeenCalledTimes(1);
  expect(clipIn(container)).toBeNull();
  expect(createUrl).not.toHaveBeenCalled();
});

it('plays nothing under reduced motion', async () => {
  mockReduced = true;
  const { container } = renderCard();
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await act(async () => undefined);
  expect(bridge.galleryClip).not.toHaveBeenCalled();
  expect(clipIn(container)).toBeNull();

  // The control: the same hover with motion welcome plays.
  mockReduced = false;
  fireEvent.pointerLeave(thumbOf('Neon City'));
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await waitFor(() => expect(clipIn(container)).not.toBeNull());
});

it('plays for a hand anywhere on the card, and keeps playing while focus moves inside it', async () => {
  const { container } = renderCard();
  const name = screen.getByRole('button', { name: 'Neon City' });
  fireEvent.pointerEnter(name);
  await waitFor(() => expect(clipIn(container)).not.toBeNull());
  fireEvent.pointerLeave(name);
  expect(clipIn(container)).toBeNull();

  fireEvent.focus(thumbOf('Neon City'));
  await waitFor(() => expect(clipIn(container)).not.toBeNull());
  // From the picture to the card's own name: still on the card.
  fireEvent.blur(thumbOf('Neon City'), { relatedTarget: name });
  fireEvent.focus(name);
  expect(clipIn(container)).not.toBeNull();
  // The control: focus leaving the card stops it.
  fireEvent.blur(name, { relatedTarget: document.body });
  expect(clipIn(container)).toBeNull();
});
