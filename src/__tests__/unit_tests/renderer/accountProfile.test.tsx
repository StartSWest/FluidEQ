/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Account panel's profile (Ivan, 2026-10-24, "go with A"): the three
 * numbers under the name, the account's own scenes a press away from the
 * graph, and what it published with where each stands.
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { memberLookId } from 'common/memberScenes';
import type { IPublishedScene } from 'common/plusGallery';
import type { ISceneSubmission } from 'common/plusReview';
import { premiumLookId } from 'common/scenePacks';
import AccountPublished from 'renderer/account/AccountPublished';
import AccountScenes from 'renderer/account/AccountScenes';
import AccountStats from 'renderer/account/AccountStats';
import type { TMine } from 'renderer/plus/myScenes';

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const ADA = '0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';

const mockSetGraphLook = jest.fn();
let mockSelected = '';
const mockOpenPlace = jest.fn();
const mockOpenPage = jest.fn();
const mockPlusTab = jest.fn();

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('renderer/utils/graphStyle', () => ({
  setGraphLook: (id: string) => mockSetGraphLook(id),
  useSelectedLookId: () => mockSelected,
}));
jest.mock('renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    {
      id: 'alpine',
      version: 3,
      lookId: 'premium:alpine',
      names: { en: 'Alpine' },
    },
    {
      id: 'ember',
      version: 2,
      lookId: 'premium:ember',
      names: { en: 'Ember' },
    },
  ],
}));
jest.mock('renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [
    {
      kind: 'member',
      lookId: 'member:0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b:neon',
      authorId: '0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b',
      packId: 'neon',
      version: 1,
      names: { en: 'Neon City' },
    },
  ],
}));
// The pictures are the gallery's, tested there; here only which scene.
jest.mock('renderer/plus/GalleryParts', () => ({
  ScenePicture: ({ scene }: { scene: { sceneId: string } }) => (
    <span data-testid="picture">{scene.sceneId}</span>
  ),
}));
jest.mock('renderer/plus/plusNavigation', () => ({
  openPlusPlace: (place: string) => mockOpenPlace(place),
  openGalleryPage: (page: unknown) => mockOpenPage(page),
}));
jest.mock('renderer/plus/plusTabRequest', () => ({
  requestPlusTab: () => mockPlusTab(),
}));
jest.mock('renderer/plus/SubmittedSceneRow', () => ({
  ReviewState: ({ submission }: { submission: ISceneSubmission }) => (
    <span>{`review:${submission.state}`}</span>
  ),
}));

const scene = (
  sceneId: string,
  over: Partial<IPublishedScene> = {},
): IPublishedScene => ({
  sceneId,
  version: 1,
  category: 'abstract',
  names: { en: sceneId },
  swatch: ['#112233'],
  likes: 0,
  adds: 0,
  publishedAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  blocked: false,
  ...over,
});
const waiting = (sceneId: string): ISceneSubmission =>
  ({
    sceneId,
    version: 1,
    category: 'space',
    names: { en: sceneId },
    swatch: ['#112233'],
    state: 'pending',
    submittedAt: '2026-10-24T00:00:00Z',
  }) as ISceneSubmission;
const ready = (
  scenes: IPublishedScene[],
  sent: ISceneSubmission[] = [],
): TMine => ({ state: 'ready', scenes, sent });

beforeEach(() => {
  jest.clearAllMocks();
  mockSelected = '';
});

describe('the three numbers under the name', () => {
  const figure = (label: string) =>
    screen.getByText(label).parentElement?.querySelector('dd')?.textContent;

  it('counts what is owned, what is in the gallery, and the hearts on it', () => {
    render(
      <AccountStats
        owned={5}
        publishedFromStore={9}
        mine={ready([
          scene('lava', { likes: 32 }),
          scene('tide', { likes: 8 }),
          scene('gone', { likes: 100, blocked: true }),
        ])}
      />,
    );
    expect(figure('account.stats.owned')).toBe('5');
    // A scene taken down is neither published nor liked any more.
    expect(figure('account.published.title')).toBe('2');
    expect(figure('account.stats.likes')).toBe('40');
  });

  it('waits for the account’s own list for the likes, rather than saying none', () => {
    render(
      <AccountStats
        owned={1}
        publishedFromStore={3}
        mine={{ state: 'loading' }}
      />,
    );
    expect(figure('account.published.title')).toBe('3');
    expect(screen.queryByText('account.stats.likes')).not.toBeInTheDocument();
  });
});

describe('the account’s scenes', () => {
  const owned = [
    premiumLookId('alpine'),
    memberLookId(ADA, 'neon'),
    premiumLookId('not-installed'),
    premiumLookId('ember'),
  ];

  it('shows the newest first, only those on this computer, and plays one on a press', () => {
    render(<AccountScenes owned={owned} onLeave={jest.fn()} />);
    expect(
      screen.getAllByTestId('picture').map((element) => element.textContent),
    ).toEqual(['ember', 'neon', 'alpine']);
    fireEvent.click(
      screen.getByRole('button', { name: 'account.scenes.play:Neon City' }),
    );
    expect(mockSetGraphLook).toHaveBeenCalledWith(memberLookId(ADA, 'neon'));
  });

  it('marks the one on the graph, and only it', () => {
    mockSelected = premiumLookId('ember');
    render(<AccountScenes owned={owned} onLeave={jest.fn()} />);
    expect(
      screen.getByRole('button', { name: 'account.scenes.play:Ember' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'account.scenes.play:Alpine' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByText('account.scenes.playing')).toHaveLength(1);
  });

  it('says what the list is for when there is nothing in it, and opens the gallery', () => {
    const onLeave = jest.fn();
    render(<AccountScenes owned={[]} onLeave={onLeave} />);
    expect(screen.getByText('account.scenes.empty')).toBeInTheDocument();
    fireEvent.click(screen.getByText('account.scenes.openGallery'));
    expect(mockOpenPlace).toHaveBeenCalledWith('visualizers');
    expect(mockPlusTab).toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalled();
  });
});

describe('what the account published', () => {
  it('lists published scenes with their place and hearts, then what waits', () => {
    render(
      <AccountPublished
        me={ME}
        mine={ready(
          [
            scene('lava', { likes: 32, adds: 9 }),
            scene('gone', { blocked: true }),
          ],
          [waiting('nova')],
        )}
        onLeave={jest.fn()}
      />,
    );
    expect(screen.getByText('account.published.live')).toBeInTheDocument();
    expect(screen.getByText('plus.mine.blocked')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('review:pending')).toBeInTheDocument();
  });

  it('shows three at most', () => {
    render(
      <AccountPublished
        me={ME}
        mine={ready([scene('a'), scene('b'), scene('c'), scene('d')])}
        onLeave={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('picture')).toHaveLength(3);
  });

  it('draws nothing while the list comes, or when nothing was ever published', () => {
    const { container, rerender } = render(
      <AccountPublished
        me={ME}
        mine={{ state: 'loading' }}
        onLeave={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<AccountPublished me={ME} mine={ready([])} onLeave={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
