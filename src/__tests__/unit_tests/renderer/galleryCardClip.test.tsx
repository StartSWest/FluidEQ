/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A gallery card plays its scene's published clip, never the scene (Ivan,
 * 2026-11-13: "add hover and play the video only not the scene"): in the
 * Gallery while it is in view, within the bound every list of scenes shares
 * (2026-11-24: "in the gallery too I want to show all animating ... but
 * always only the ones in the view"), and anywhere while hovered or focused.
 * What is held: a card drawn alone asks for nothing before a hover, the
 * scene itself is never asked for, the clip shows only once it plays, a
 * pointer that left before the clip landed leaves nothing playing, a scene
 * with no clip is asked once, and Animations off plays nothing.
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
import {
  ClipSlotsScope,
  forgetClipDecoder,
} from '../../../renderer/plus/clipSlots';
import GalleryCard from '../../../renderer/plus/GalleryCard';
import { resetGalleryActions } from '../../../renderer/plus/galleryActions';
import { resetScenePictures } from '../../../renderer/plus/scenePictures';
import { applyMotionPreference } from '../../../renderer/utils/motionPreference';

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

it('asks for nothing until a card drawn alone is hovered, and never for the scene', async () => {
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

describe('in the Gallery', () => {
  // The Gallery's scroller: every card in it unless a test scrolls one out.
  const observed = new Map<Element, IntersectionObserverCallback>();
  // Each observer forgets only its own elements: the pictures watch the same
  // cards for their own loading and let go once loaded.
  const ScrollerObserver = jest.fn((report: IntersectionObserverCallback) => {
    const mine = new Set<Element>();
    return {
      observe: (element: Element) => {
        mine.add(element);
        observed.set(element, report);
        report(
          [
            {
              target: element,
              isIntersecting: true,
              intersectionRatio: 1,
            } as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        );
      },
      unobserve: (element: Element) => {
        mine.delete(element);
        if (observed.get(element) === report) {
          observed.delete(element);
        }
      },
      disconnect: () =>
        mine.forEach((element) => {
          if (observed.get(element) === report) {
            observed.delete(element);
          }
        }),
    };
  });

  const NAMES = [
    'Laser',
    'Lantern Lake',
    'Kaleidoscope',
    'Jellyfish',
    'Koi',
    'Aurora',
  ];

  const gallery = (count: number) =>
    render(
      <div className="gallery-visualizers">
        <ClipSlotsScope scroller=".gallery-visualizers">
          {NAMES.slice(0, count).map((name, index) => (
            <GalleryCard
              key={name}
              scene={scene({
                lookId: `member:${SOMEONE}:scene-${index}`,
                sceneId: `scene-${index}`,
                names: { en: name },
              })}
              local={undefined}
              me="me"
              onOpen={jest.fn()}
            />
          ))}
        </ClipSlotsScope>
      </div>,
    );

  const cardOf = (container: HTMLElement, name: string) => {
    const card = [...container.querySelectorAll('.gallery-card')].find(
      (each) => each.querySelector('.gallery-card__name')?.textContent === name,
    );
    if (!card) {
      throw new Error(`${name} is in the gallery`);
    }
    return card as HTMLElement;
  };

  const playingIn = (container: HTMLElement) =>
    NAMES.filter((name) => {
      const card = [...container.querySelectorAll('.gallery-card')].find(
        (each) =>
          each.querySelector('.gallery-card__name')?.textContent === name,
      );
      return card?.querySelector('video.gallery-card__clip');
    });

  const scrollOut = (card: Element) => {
    const report = observed.get(card);
    if (!report) {
      throw new Error('the card is watched');
    }
    act(() =>
      report(
        [{ target: card, isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  };

  beforeAll(() => {
    window.IntersectionObserver =
      ScrollerObserver as unknown as typeof IntersectionObserver;
  });

  afterAll(() => {
    // The cards drawn alone above have no scroller to be in.
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
  });

  beforeEach(() => {
    observed.clear();
    forgetClipDecoder();
  });

  it('plays every card in view with no hover, its picture first, and stops one scrolled out', async () => {
    const { container } = gallery(3);
    // The pictures are there from the first frame, before any clip.
    expect(container.querySelectorAll('.gallery-card__thumb')).toHaveLength(3);
    await waitFor(() =>
      expect(playingIn(container)).toEqual([
        'Laser',
        'Lantern Lake',
        'Kaleidoscope',
      ]),
    );
    expect(bridge.previewGalleryScene).not.toHaveBeenCalled();
    scrollOut(cardOf(container, 'Lantern Lake'));
    expect(playingIn(container)).toEqual(['Laser', 'Kaleidoscope']);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });

  it('gives no slot to a scene that has no clip, and keeps its picture', async () => {
    bridge.galleryClip.mockImplementation(async (_author, sceneId: string) =>
      sceneId === 'scene-1' ? undefined : CLIP,
    );
    const { container } = gallery(6);
    await waitFor(() =>
      expect(playingIn(container)).toEqual([
        'Laser',
        'Kaleidoscope',
        'Jellyfish',
        'Koi',
      ]),
    );
    expect(
      cardOf(container, 'Lantern Lake').querySelector('.gallery-picture'),
    ).not.toBeNull();
  });

  it('plays at most four where the clips decode in software, and the hovered one past them', async () => {
    const { container } = gallery(6);
    await waitFor(() => expect(playingIn(container)).toHaveLength(4));
    expect(playingIn(container)).toEqual(NAMES.slice(0, 4));
    fireEvent.pointerEnter(cardOf(container, 'Aurora'));
    await waitFor(() => expect(playingIn(container)).toContain('Aurora'));
    expect(playingIn(container)).toHaveLength(5);
  });
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

// Ivan, 2026-11-24: "if user selects animation off in the app we don't show
// the videos ... on those lists or even gallery". The switch is felt while
// the card is still hovered, not at the next hover.
it('lets a playing clip go the moment Animations are switched off, and plays it again when on', async () => {
  const { container } = renderCard();
  fireEvent.pointerEnter(thumbOf('Neon City'));
  await waitFor(() => expect(clipIn(container)).not.toBeNull());
  mockReduced = true;
  act(() => applyMotionPreference('reduced'));
  expect(clipIn(container)).toBeNull();
  expect(revokeUrl).toHaveBeenCalledWith('blob:clip-1');
  mockReduced = false;
  act(() => applyMotionPreference('full'));
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
