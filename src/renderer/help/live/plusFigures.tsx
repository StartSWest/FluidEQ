/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo, type ReactNode } from 'react';
import {
  FLUIDEQ_CREATOR_ID,
  type IGalleryScene,
  type TPlusCategory,
} from 'common/plusGallery';
import { PLACES } from '../../community/CommunityPanel';
import Avatar from '../../community/Avatar';
import Glyph from '../../community/Glyph';
import { identityStyle } from '../../community/identity';
import BrandMark from '../../icons/BrandMark';
import GalleryCard from '../../plus/GalleryCard';
import GalleryList from '../../plus/GalleryList';
import {
  categoriesLabel,
  OfficialBadge,
  SceneHeart,
  ScenePicture,
} from '../../plus/GalleryParts';
import GalleryToolbar from '../../plus/GalleryToolbar';
import { officialLine } from '../../plus/SceneGet';
import type { TPlusPlace } from '../../plus/plusNavigation';
import { SceneStillsContext } from '../../plus/scenePictures';
import { useTranslation } from '../../utils/I18nContext';
import { SetDesktopButton } from '../../wallpaper/WallpaperControls';
import alpine from '../../../../assets/tour/scene-alpine.jpg';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import bloom from '../../../../assets/tour/scene-bloom.jpg';
import chrome from '../../../../assets/tour/scene-chrome.jpg';
import neonCity from '../../../../assets/tour/scene-neon-city.jpg';
import nebulaHeart from '../../../../assets/plus/nebula-heart.jpg';
import reefLight from '../../../../assets/plus/reef-light.jpg';
import '../../styles/CommunityRail.scss';
import '../../styles/Community.scss';
import '../../styles/Gallery.scss';
import '../../styles/PlusRail.scss';

/**
 * The Visualizers tab's chapters, drawn by the tab's own parts
 * (`helpChapters/plus.ts`) for a made-up member: Mara Quinn, signed in,
 * with a scene playing on her desktop.
 *
 * The gallery's toolbar and cards are the gallery's own components, handed
 * seven made-up scenes — five of FluidEQ's, two by members — each pictured
 * by a still the app already ships (`SceneStillsContext`), where the
 * gallery fetches a scene's published picture or draws one on the graphics
 * card. The rail, the head and its desktop line are their markup, class for
 * class, as `CommunityPanel`, `VisualizersView` and `WallpaperStatus` draw
 * them, over the rail's own list of places: each of those reads the
 * reader's own account, place and desktop.
 */

const nothing = () => undefined;

const DAY = 86_400_000;

const MEMBER = { name: 'Mara Quinn', handle: 'maraq' } as const;

interface IMadeUpScene {
  lookId: string;
  name: string;
  category: TPlusCategory;
  still: string;
  likes: number;
  daysAgo: number;
  version: number;
  author?: { id: string; name: string; handle: string };
}

const SCENES: readonly IMadeUpScene[] = [
  {
    lookId: 'help-bloom',
    name: 'Bloom',
    category: 'abstract',
    still: bloom,
    likes: 412,
    daysAgo: 6,
    version: 10,
  },
  {
    lookId: 'help-neon-city',
    name: 'Neon City',
    category: 'cities',
    still: neonCity,
    likes: 388,
    daysAgo: 15,
    version: 7,
  },
  {
    lookId: 'help-reef-light',
    name: 'Reef Light',
    category: 'water',
    still: reefLight,
    likes: 301,
    daysAgo: 3,
    version: 4,
    author: { id: 'help-member-iris', name: 'Iris Vale', handle: 'irisvale' },
  },
  {
    lookId: 'help-chrome',
    name: 'Chrome',
    category: 'abstract',
    still: chrome,
    likes: 276,
    daysAgo: 16,
    version: 8,
  },
  {
    lookId: 'help-aurora',
    name: 'Aurora',
    category: 'nature',
    still: aurora,
    likes: 254,
    daysAgo: 17,
    version: 8,
  },
  {
    lookId: 'help-alpine',
    name: 'Alpine',
    category: 'nature',
    still: alpine,
    likes: 219,
    daysAgo: 18,
    version: 52,
  },
  {
    lookId: 'help-nebula-heart',
    name: 'Nebula Heart',
    category: 'space',
    still: nebulaHeart,
    likes: 187,
    daysAgo: 9,
    version: 3,
    author: { id: 'help-member-theo', name: 'Theo Lind', handle: 'theolind' },
  },
];

const STILLS: ReadonlyMap<string, string> = new Map(
  SCENES.map((scene) => [scene.lookId, scene.still]),
);

/** A made-up scene as the gallery lists it, its times counted from `now`. */
const galleryScene = (scene: IMadeUpScene, now: number): IGalleryScene => ({
  official: !scene.author,
  lookId: scene.lookId,
  authorId: scene.author?.id ?? FLUIDEQ_CREATOR_ID,
  sceneId: scene.lookId,
  authorName: scene.author?.name ?? 'FluidEQ',
  authorHandle: scene.author?.handle ?? 'fluideq',
  version: scene.version,
  category: scene.category,
  names: { en: scene.name },
  swatch: [],
  hasPhoto: true,
  likes: scene.likes,
  likesWeek: Math.round(scene.likes / 9),
  adds: scene.likes * 3,
  updatedAt: new Date(now - scene.daysAgo * DAY).toISOString(),
  liked: false,
  added: false,
});

/**
 * The tab's rail, as `CommunityPanel` draws it: the pin, the tab's name, its
 * places, and the member at its foot.
 */
const PlusRailDrawing = ({ shown }: { shown: TPlusPlace }) => {
  const { t } = useTranslation();
  return (
    <div className="community__rail-slot">
      <nav className="community__rail" aria-label={t('tabs.plus')}>
        <div className="community__rail-head">
          <button
            type="button"
            className="community__rail-pin"
            aria-pressed
            aria-label={t('plus.rail.collapse')}
          >
            <Glyph name="rail-collapse" />
          </button>
          <span className="community__rail-title">{t('tabs.plus')}</span>
        </div>
        <div className="community__channels">
          {PLACES.map((entry) => (
            <button
              key={entry.place}
              type="button"
              className={`community__channel${entry.place === shown ? ' is-active' : ''}`}
              aria-current={entry.place === shown ? 'true' : undefined}
            >
              <span className="community__channel-mark">
                <Glyph name={entry.glyph} />
              </span>
              <span className="community__channel-text">
                <span className="community__channel-name">{t(entry.name)}</span>
                <span className="community__channel-blurb">
                  {t(entry.blurb)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="community__foot">
          <button
            type="button"
            className="community__account"
            style={identityStyle(MEMBER.handle)}
          >
            <Avatar
              handle={MEMBER.handle}
              displayName={MEMBER.name}
              size="rail"
            />
            <span className="community__account-text">
              <span className="community__name community__name--hued">
                {MEMBER.name}
              </span>
              <span className="community__account-line">
                <span className="community__handle">@{MEMBER.handle}</span>
              </span>
            </span>
            <span className="community__account-chevron" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
};

/** The tab, with `shown` open beside the rail, in the workspace's card. */
export const PlusTab = ({
  shown,
  height,
  children,
}: {
  shown: TPlusPlace;
  height: number;
  children: ReactNode;
}) => (
  <div
    className="workspace-tab-panel workspace-tab-panel--community"
    style={{ height }}
  >
    <div className="community community--plus">
      <PlusRailDrawing shown={shown} />
      <section className="community__main">{children}</section>
    </div>
  </div>
);

/**
 * The Visualizers head, as `VisualizersView` draws it, with the desktop line
 * `WallpaperStatus` shows while a scene plays on one monitor.
 */
const VisualizersHead = () => {
  const { t } = useTranslation();
  return (
    <header className="community__head gallery-head">
      <span className="community__head-mark" aria-hidden="true">
        <Glyph name="looks" />
      </span>
      <span className="community__head-text">
        <span className="community__head-name">
          {t('plus.visualizers.title')}
        </span>
        <span className="community__head-description">
          {t('plus.visualizers.description')}
        </span>
      </span>
      <div className="wallpaper-status wallpaper-status--running">
        <span className="wallpaper-status__mark" aria-hidden="true">
          <Glyph name="monitor" />
        </span>
        <span className="wallpaper-status__text">
          {t('wallpaper.status.running')}
        </span>
        <button type="button" className="button small subtle">
          {t('wallpaper.manage')}
        </button>
        <button type="button" className="button small subtle">
          {t('wallpaper.stop')}
        </button>
      </div>
    </header>
  );
};

/** The gallery's front page, most liked first. */
export const VisualizersDrawing = () => {
  const scenes = useMemo(() => {
    const now = Date.now();
    return SCENES.map((scene) => galleryScene(scene, now));
  }, []);
  return (
    <SceneStillsContext.Provider value={STILLS}>
      <PlusTab shown="visualizers" height={440}>
        <VisualizersHead />
        <div className="gallery-visualizers">
          <div className="gallery-page gallery-gallery">
            <GalleryToolbar
              filters={{ sort: 'liked', text: '' }}
              onFilters={nothing}
              onMine={nothing}
            />
            <GalleryList
              list={{ scenes, more: false, loading: false, loaded: true }}
              onMore={nothing}
              onRetry={nothing}
              empty={null}
            >
              {scenes.map((scene) => (
                <GalleryCard
                  key={scene.lookId}
                  scene={scene}
                  me={undefined}
                  local={undefined}
                  onOpen={nothing}
                  onMaker={nothing}
                />
              ))}
            </GalleryList>
          </div>
        </div>
      </PlusTab>
    </SceneStillsContext.Provider>
  );
};

/** The step arrows' chevron, as `SceneSteps` draws it. */
const StepChevron = ({ back }: { back: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d={back ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} />
  </svg>
);

/**
 * A scene's page, as `ScenePage` draws Neon City for a member who has it in
 * her looks and is watching it play: its picture on the stage with the
 * arrows to the scenes beside it, what it is and who made it, its version
 * and likes, Play on the graph, the desktop and the Studio, and more by
 * FluidEQ under it. The page itself downloads the scene, plays it on the
 * graphics card and asks the server for its versions and its maker's other
 * scenes; here the picture is the still the app ships, and the rest is the
 * page's markup, class for class, around its own heart, badge and cards.
 */
export const SceneDrawing = () => {
  const { t, locale } = useTranslation();
  const scenes = useMemo(() => {
    const now = Date.now();
    return SCENES.map((scene) => galleryScene(scene, now));
  }, []);
  const scene = scenes[1];
  const name = scene.names.en;
  const others = scenes
    .filter((entry) => entry.official && entry.lookId !== scene.lookId)
    .slice(0, 4);
  const numbers = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    Date.parse(scene.updatedAt),
  );
  return (
    <SceneStillsContext.Provider value={STILLS}>
      <PlusTab shown="visualizers" height={1020}>
        <VisualizersHead />
        <div className="gallery-visualizers">
          <div className="gallery-pagebar">
            <button type="button" className="gallery-back">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" />
              </svg>
              {t('plus.scene.back')}
            </button>
            <span className="gallery-pagebar__title">{name}</span>
          </div>
          <div className="gallery-page gallery-scene">
            <div className="gallery-scene__main">
              <div className="gallery-preview">
                <div className="gallery-preview__ground" aria-hidden="true" />
                <ScenePicture
                  scene={scene}
                  className="gallery-preview__still"
                />
                <span className="gallery-preview__tag">
                  <span className="gallery-preview__live" aria-hidden="true" />
                  {t('plus.scene.playing')}
                </span>
                <button
                  type="button"
                  className="gallery-step gallery-step--back"
                >
                  <StepChevron back />
                </button>
                <button
                  type="button"
                  className="gallery-step gallery-step--next"
                >
                  <StepChevron back={false} />
                </button>
              </div>
            </div>

            <aside className="gallery-scene__info">
              <header className="gallery-scene__head">
                <span className="eyebrow gallery-scene__kicker">
                  {categoriesLabel(t, { ...scene, category2: 'fire-light' })}
                </span>
                <h3 className="gallery-scene__name">{name}</h3>
                <div className="gallery-scene__byline">
                  <button type="button" className="gallery-scene__maker">
                    <BrandMark className="gallery-scene__brand" />
                    <span className="gallery-scene__maker-name">
                      {t('plus.card.by', { name: 'FluidEQ' })}
                    </span>
                  </button>
                  <OfficialBadge />
                </div>
              </header>
              <section className="gallery-versions">
                <p className="gallery-versions__line">
                  {t('plus.version.pageLine', {
                    version: String(scene.version),
                    date,
                  })}
                </p>
              </section>
              <dl className="gallery-figures gallery-figures--two">
                <div>
                  <dt>{t('plus.scene.likes')}</dt>
                  <dd>{numbers.format(scene.likes)}</dd>
                </div>
                <div>
                  <dt>{t('plus.scene.week')}</dt>
                  <dd>{numbers.format(scene.likesWeek)}</dd>
                </div>
              </dl>
              <p className="gallery-included">
                <Glyph name="check" />
                {officialLine(t, true, false)}
              </p>
              <div className="gallery-scene__actions">
                <button type="button" className="button small">
                  {t('plus.scene.play')}
                </button>
                <SceneHeart
                  scene={scene}
                  name={name}
                  own={false}
                  className="gallery-like--large"
                />
              </div>
              <p className="gallery-scene__have">
                <Glyph name="shield" />
                {t('plus.scene.inLooksPlus')}
              </p>
              <SetDesktopButton lookId={scene.lookId} />
              <div className="gallery-scene__inspect">
                <button type="button" className="button small subtle">
                  <Glyph name="studio" />
                  {t('plus.inspect.open')}
                </button>
                <p className="gallery-scene__inspect-hint">
                  {t('plus.inspect.hint')}
                </p>
              </div>
              <footer className="gallery-scene__foot">
                <p className="gallery-fine">{t('store.official.fine')}</p>
              </footer>
            </aside>

            <section className="gallery-scene__more">
              <h4 className="gallery-section-title">
                {t('plus.scene.moreBy', { name: 'FluidEQ' })}
              </h4>
              <div className="gallery-grid gallery-grid--row">
                {others.map((entry) => (
                  <GalleryCard
                    key={entry.lookId}
                    scene={entry}
                    me={undefined}
                    local={undefined}
                    onOpen={nothing}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </PlusTab>
    </SceneStillsContext.Provider>
  );
};
