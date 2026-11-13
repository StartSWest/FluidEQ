/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { createRoot } from 'react-dom/client';
import type { IGalleryScene, TPlusCategory } from 'common/plusGallery';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import GalleryCard from 'renderer/plus/GalleryCard';
import GalleryList from 'renderer/plus/GalleryList';
import GalleryToolbar from 'renderer/plus/GalleryToolbar';
import { SceneStillsContext } from 'renderer/plus/scenePictures';
import Glyph from 'renderer/community/Glyph';
import { PlusTab } from 'renderer/help/live/plusFigures';
import { I18nProvider, useTranslation } from 'renderer/utils/I18nContext';
import 'renderer/styles/cascade';
import 'renderer/styles/App.scss';
import 'renderer/styles/Community.scss';
import 'renderer/styles/Gallery.scss';
import hyperdrive from '../../../assets/plus/hyperdrive.jpg';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import lanternNight from '../../../assets/plus/lantern-night-band.jpg';
import nebulaHeart from '../../../assets/plus/nebula-heart.jpg';
import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import prismBloom from '../../../assets/plus/prism-bloom.jpg';
import reefLight from '../../../assets/plus/reef-light.jpg';
import alpine from '../../../assets/tour/scene-alpine.jpg';
import aurora from '../../../assets/tour/scene-aurora.jpg';
import bloom from '../../../assets/tour/scene-bloom.jpg';
import chrome from '../../../assets/tour/scene-chrome.jpg';
import neonCity from '../../../assets/tour/scene-neon-city.jpg';

/**
 * The gallery as the signed-out Visualizers page shows it behind its glass
 * (`VisualizersSignedOut`): the gallery's own head, toolbar and cards, handed
 * FluidEQ's own scenes, each pictured by a still the app already ships
 * (`SceneStillsContext`), the way Help draws the gallery
 * (`help/live/plusFigures.tsx`), in Help's own frame of the tab with its
 * rail (`PlusTab`, its made-up member at the foot). Every scene is FluidEQ's.
 */

const nothing = () => undefined;
const DAY = 86_400_000;

const SCENES: readonly [string, TPlusCategory, string, number][] = [
  ['Neon Horizon', 'cities', neonHorizon, 2],
  ['Alpine', 'nature', alpine, 18],
  ['Nebula Heart', 'space', nebulaHeart, 9],
  ['Aurora', 'nature', aurora, 4],
  ['Lantern Lake', 'water', lanternLake, 1],
  ['Chrome', 'abstract', chrome, 16],
  ['Hyperdrive', 'space', hyperdrive, 5],
  ['Neon City', 'cities', neonCity, 3],
  ['Reef Light', 'water', reefLight, 12],
  ['Bloom', 'abstract', bloom, 6],
  ['Prism Bloom', 'abstract', prismBloom, 20],
  ['Lantern Night', 'water', lanternNight, 2],
];

// Two walls of the twelve, so the grid reaches the bottom of a tall window.
const WALL = [...SCENES, ...SCENES.slice(6), ...SCENES.slice(0, 6)];
const now = Date.now();
const scenes: IGalleryScene[] = WALL.map(
  ([name, category, , daysAgo], index) => ({
    official: true,
    lookId: `ground-${index}`,
    authorId: FLUIDEQ_CREATOR_ID,
    sceneId: `ground-${index}`,
    authorName: 'FluidEQ',
    authorHandle: 'fluideq',
    version: 3 + (index % 5),
    category,
    names: { en: name },
    swatch: [],
    hasPhoto: true,
    likes: 420 - index * 11,
    likesWeek: 40 - index,
    adds: 1300 - index * 31,
    updatedAt: new Date(now - (daysAgo + 30) * DAY).toISOString(),
    liked: false,
    added: false,
  }),
);
const STILLS: ReadonlyMap<string, string> = new Map(
  WALL.map(([, , still], index) => [`ground-${index}`, still]),
);

function Gallery() {
  const { t } = useTranslation();
  return (
    <SceneStillsContext.Provider value={STILLS}>
      <div style={{ padding: '8px 0 0' }}>
        <PlusTab shown="visualizers" height={1070}>
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
          </header>
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
      </div>
    </SceneStillsContext.Provider>
  );
}

const host = document.getElementById('root');
if (host) {
  createRoot(host).render(
    <I18nProvider>
      <Gallery />
    </I18nProvider>,
  );
}
